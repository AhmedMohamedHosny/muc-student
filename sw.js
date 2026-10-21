const CACHE_NAME = "muc-student-offline-v25";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./firebase.js",
    "./config.js",
    "./logo.jpg",
    "./may.jpg",
    "./manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
    self.skipWaiting();
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

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // استثناء سيرفرات قواعد البيانات والمصادقة
    if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("identitytoolkit")) {
        return;
    }

    // طلبات فتح التطبيق والصفحات (Navigation)
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    const matched = (await cache.match("./index.html", { ignoreSearch: true })) ||
                                    (await cache.match("index.html", { ignoreSearch: true })) ||
                                    (await cache.match("./", { ignoreSearch: true }));
                    // عدم إرجاع undefined أبداً لمنع انهيار PWA
                    return matched || Response.error();
                })
        );
        return;
    }

    // طلبات الأصول والملفات
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
