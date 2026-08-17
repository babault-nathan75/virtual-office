// Version incrémentée pour invalider les caches précédents, qui contenaient
// des réponses d'API authentifiées (voir plus bas).
const CACHE_NAME = 'secretariatpro-v2';
const STATIC_CACHE = 'secretariatpro-static-v2';
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  OFFLINE_URL,
  '/favicon.svg',
  '/logo.png',
  '/icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Requêtes cross-origin : laissées au navigateur.
  if (url.origin !== self.location.origin) return;

  /*
   * Les réponses d'API ne sont jamais mises en cache : elles contiennent des
   * données propres à l'utilisateur connecté (rôle, profils, messages). La
   * version précédente les stockait, si bien qu'elles restaient lisibles
   * après déconnexion et pouvaient être servies à un autre utilisateur du
   * même appareil.
   */
  if (url.pathname.startsWith('/api/')) return;

  // Ressources versionnées de Next.js : le cache d'abord est sûr, leur URL
  // change à chaque déploiement.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Pages : réseau d'abord, repli sur le cache puis sur la page hors ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // L'ancienne version renvoyait « / », ce qui rendait la page
          // /offline inatteignable alors qu'elle existe.
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        })
    );
    return;
  }

  // Autres ressources statiques : cache d'abord, revalidation en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || new Response('Offline', { status: 503, statusText: 'Offline' }));

      return cached || fetchPromise;
    })
  );
});

/*
 * Réception des notifications push.
 *
 * Ce gestionnaire était absent : les notifications envoyées par
 * /api/push/send arrivaient au navigateur sans jamais être affichées.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'SecrétariatPro', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'SecrétariatPro';
  const options = {
    body: payload.body || '',
    icon: '/icon.png',
    badge: '/favicon.svg',
    // `tag` évite l'empilement de notifications identiques.
    tag: payload.tag || 'secretariatpro',
    renotify: true,
    data: { url: payload.url || '/dashboard/messages' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * Clic sur une notification : replace l'onglet existant sur la bonne page
 * plutôt que d'en ouvrir systématiquement un nouveau.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
