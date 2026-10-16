const CACHE_NAME = "muc-student-offline-v9";

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

// دالة جلب بمهلة قصيرة (1.5 ثانية) لمنع تعليق التليفونات في المدرج عندما تكون إشارة الداتا وهمية
function fetchWithFastTimeout(req, timeoutMs = 1500) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("SW_TIMEOUT")), timeoutMs);
        fetch(req).then(res => {
            clearTimeout(timer);
            resolve(res);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

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

    if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("identitytoolkit")) {
        return;
    }

    if (req.mode === "navigate") {
        event.respondWith(
            fetchWithFastTimeout(req, 1500)
                .then((networkRes) => {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
                    return networkRes;
                })
                .catch(async () => {
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

event.respondWith(
        fetchWithFastTimeout(req, 1800)
            .then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return networkRes;
            })
            .catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                return (await cache.match(req, { ignoreSearch: true })) || Response.error();
            })
    );
});