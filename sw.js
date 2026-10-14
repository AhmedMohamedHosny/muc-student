const CACHE_NAME = "muc-student-offline-v5";

// الملفات الأساسية للموقع ومكتبة الكاميرا والفايربيز
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./firebase.js",
    "./config.js",
    "./logo.jpg",
    "./manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
];

// 1. التثبيت: حفظ كل ملف على حدة حتى لو فشل ملف فرعي لا يتعطل الكاش بالكامل
self.addEventListener("install", (event) => {
    self.skipWaiting(); // تفعيل فوري بدون انتظار إغلاق المتصفح
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const url of CORE_ASSETS) {
                try {
                    await cache.add(new Request(url, { cache: "reload" }));
                } catch (err) {
                    console.warn("SW Cache skip:", url);
                }
            }
        })
    );
});

// 2. التفعيل: مسح أي كاش قديم معلق والسيطرة الفورية على جميع الصفحات المفتوحة
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        ).then(() => self.clients.claim())
    );
});

// 3. الاعتراض الذكي: فتح التطبيق فوراً وهو أوفلاين بدون شاشة خطأ المتصفح
self.addEventListener("fetch", (event) => {
    const req = event.request;

    // تجاهل طلبات فايربيز الحية (POST أو WebSockets)
    if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("identitytoolkit")) {
        return;
    }

    // أ. إذا كان الطالب يفتح التطبيق أو الموقع (Navigation Request)
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
                    return networkRes;
                })
                .catch(async () => {
                    // لو الموبايل أوفلاين: افتح index.html من الكاش فوراً وتجاهل أي إضافات في الرابط
                    const cache = await caches.open(CACHE_NAME);
                    return (
                        (await cache.match("./index.html", { ignoreSearch: true })) ||
                        (await cache.match("index.html", { ignoreSearch: true })) ||
                        (await cache.match("./", { ignoreSearch: true }))
                    );
                })
        );
        return;
    }

    // ب. باقي الملفات (JS, CSS, الصور، المكتبات): Stale-While-Revalidate (يقرأ من الكاش فوراً ويحدث في الخلفية)
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cachedRes) => {
            const fetchPromise = fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return networkRes;
                })
                .catch(() => cachedRes);

            return cachedRes || fetchPromise;
        })
    );
});