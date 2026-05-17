'use client';

import { useEffect } from 'react';

export default function PWAInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Enregistrement après la fin du chargement initial pour ne pas
    // compétir avec le rendu de la page
    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // Échec d'enregistrement n'est pas critique pour le fonctionnement du site
          console.warn('PWA: service worker registration failed', err);
        });
    };
    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
