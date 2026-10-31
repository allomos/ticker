// Ticker's service worker: only an offline screen. Pages and prices always come from the
// network; when a page cannot load (no connection), the cached offline screen is shown instead.
const CACHE = "ticker-offline-v1";
const OFFLINE = ["/offline.html", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  } else if (new URL(request.url).pathname === "/favicon.svg") {
    event.respondWith(fetch(request).catch(() => caches.match("/favicon.svg")));
  }
});
