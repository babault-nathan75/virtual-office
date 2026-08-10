const CACHE_NAMES = ['secretariatpro-v1', 'secretariatpro-v2', 'secretariatpro-v3', 'secretariatpro-v4',
  'secretariatpro-static-v1', 'secretariatpro-static-v2', 'secretariatpro-static-v3', 'secretariatpro-static-v4',
  'secretariatpro-dynamic-v1', 'secretariatpro-dynamic-v2', 'secretariatpro-dynamic-v3', 'secretariatpro-dynamic-v4'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
