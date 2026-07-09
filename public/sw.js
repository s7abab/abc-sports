const CACHE_VERSION = "abc-sports-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/maskable-icon-192x192.png",
  "/maskable-icon-512x512.png",
  "/apple-touch-icon.png",
];

const MATCHES_CACHE = `${CACHE_VERSION}-matches`;
const CURRENT_CACHES = new Set([STATIC_CACHE, MATCHES_CACHE]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("abc-sports-pwa-") && !CURRENT_CACHES.has(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function shouldBypassCache(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.includes(".m3u8") || url.pathname.includes(".ts")) return true;

  const destination = request.destination;
  return destination === "video" || destination === "audio" || destination === "track";
}

function isStaticAsset(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;

  return ["image", "font", "style", "script"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname === "/api/matches") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(MATCHES_CACHE).then((cache) => cache.put(request, responseToCache));
          }

          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          return cachedResponse || Response.json({ error: "No cached matches available" }, { status: 503 });
        })
    );
    return;
  }

  if (shouldBypassCache(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            return response;
          }

          const cache = await caches.open(STATIC_CACHE);
          return cache.match(OFFLINE_URL) || response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          return cache.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;

          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseToCache));

          return networkResponse;
        });
      })
    );
  }
});
