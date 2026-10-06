// sw.js - MUC Student Offline Engine
const CACHE_NAME = "muc-student-offline-v6";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./firebase.js",
  "./config.js",
  "./logo.jpg",
  "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
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

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("firestore.googleapis.com")) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (e.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
