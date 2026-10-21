const CACHE_NAME = "muc-student-offline-v26";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./firebase.js",
    "./config.js",
    "./logo.png",
    "./logo.jpg",
    "./may.jpg",
    "./manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
];

// 1. التثبيت: سحب أحدث نسخة من السيرفر فوراً وتخزينها للأوفلاين (مع تخطي كاش المتصفح)
self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const url of CORE_ASSETS) {
                try {
                    const freshReq = new Request(url, { cache: "reload" });
                    const res = await fetch(freshReq);
                    if (res && res.status === 200) {
                        await cache.put(url, res);
                    }
                } catch (err) {
                    console.warn("SW Cache skip:", url);
                }
            }
        })
    );
});

// 2. التفعيل: مسح كل الكاش القديم + إجبار صفحات الطلاب المفتوحة على التحديث فوراً في الخلفية
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
            await self.clients.claim();

            // إجبار جميع التبويبات المفتوحة عند الطلاب على التحميل بالنسخة الجديدة فوراً
            const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of clientsList) {
                try {
                    await client.navigate(client.url);
                } catch (e) {}
            }
        })()
    );
});

// 3. جلب الملفات: الأولوية لأحدث نسخة من السيرفر (وحفظها للأوفلاين)، وعند انقطاع النت يعمل من الكاش فوراً
self.addEventListener("fetch", (event) => {
    const req = event.request;

    if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("identitytoolkit")) {
        return;
    }

    const urlObj = new URL(req.url);
    const isCoreCode = req.mode === "navigate" ||
                       urlObj.pathname.endsWith("/") ||
                       urlObj.pathname.endsWith(".html") ||
                       urlObj.pathname.endsWith(".js") ||
                       urlObj.pathname.endsWith(".json");

    // أ) لملفات الكود والصفحة: اسحب الأحدث دائماً من السيرفر بدون كاش، وحدث نسخة الأوفلاين في الخلفية
    if (isCoreCode && urlObj.origin === self.location.origin) {
        event.respondWith(
            fetch(req, { cache: "no-store" })
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            if (req.mode === "navigate") {
                                cache.put("./index.html", clone);
                            } else {
                                cache.put(urlObj.pathname, clone);
                            }
                        });
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    if (req.mode === "navigate") {
                        return (await cache.match("./index.html", { ignoreSearch: true })) ||
                               (await cache.match("index.html", { ignoreSearch: true })) ||
                               (await cache.match("./", { ignoreSearch: true })) ||
                               Response.error();
                    }
                    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
                })
        );
        return;
    }

    // ب) للصور والمكتبات الثابتة: الكاش أولاً لسرعة الفتح، وتحديثها إن لم تكن موجودة
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            return fetch(req).then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return networkRes;
            }).catch(() => Response.error());
        })
    );
});