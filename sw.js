// sw.js - MUC Student Offline Engine
const CACHE_NAME = "muc-student-offline-v2";

// الملفات الأساسية التي يتم حفظها فوراً
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./firebase.js",
  "./config.js",
  "./logo.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
      )
    )
  );
  self.clients.claim();
});

// الاستراتيجية الذكية: حفظ أي مكتبة (فايربيز، خطوط، قارئ الكاميرا) تلقائياً في الكاش
self.addEventListener("fetch", (e) => {
  // استثناء اتصالات قاعدة بيانات فايربيز المباشرة
  if (e.request.url.includes("firestore.googleapis.com")) return;

  e.respondWith(
    // ignoreSearch: true تضمن فتح الصفحة حتى مع وجود ?session= في الرابط
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).then((networkResponse) => {
        // تخزين أي ملف يتم تحميله بنجاح (مثل مكتبات فايربيز من سيرفرات جوجل)
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // عند انقطاع الإنترنت بالكامل وطلب فتح الصفحة
        if (e.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
