// v18: أي تغيير في الملفات لازم ترفع الرقم ده عشان هواتف الطلبة تسحب التحديث
const CACHE_NAME = "muc-student-offline-v18";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./firebase.js",
  "./config.js",
  "./logo.jpg",
  "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // كل ملف لوحده: لو واحد فشل الباقي يتخزن عادي
      Promise.all(STATIC_ASSETS.map((u) =>
        cache.add(u).catch((err) => console.warn("SW skip:", u, err))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

// جلب من النت أولاً (مع مهلة)، ولو فشل أو النت ضعيف يرجع للكاش
function networkFirst(req, cacheKey) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () =>
      caches.match(cacheKey || req, { ignoreSearch: true }).then((c) => c || caches.match("./index.html"));

    const timer = setTimeout(() => {
      if (done) return;
      fallback().then((c) => { if (c && !done) { done = true; resolve(c); } });
    }, 4000);

    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(cacheKey || req, clone));
      }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!done) fallback().then((c) => { done = true; resolve(c || Response.error()); });
    });
  });
}

// المكتبات الخارجية ثابتة بنسخة محددة: الكاش أولاً
function cacheFirst(req) {
  return caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith("http")) return;
  if (/firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/.test(req.url)) return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, "./index.html"));
  } else if (sameOrigin) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});
