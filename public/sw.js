// Service worker minimal — rend le site installable comme PWA.
// On ne fait pas de cache offline pour rester aligné avec l'app Next.js
// qui dépend de Supabase en temps réel. Le SW se contente d'exister pour
// satisfaire les critères PWA (installabilité).

const CACHE_NAME = 'secretariatpro-v1';

self.addEventListener('install', (event) => {
  // Activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nettoyage des anciens caches éventuels
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through : aucune interception, le navigateur gère normalement
  // (pas de cache offline pour ne pas servir d'anciennes données Supabase)
  return;
});
