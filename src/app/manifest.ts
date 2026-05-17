import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SecrétariatPro',
    short_name: 'SecrétariatPro',
    description:
      'Plateforme ivoirienne de mise en relation entre entreprises et secrétaires qualifié(e)s. Saisie, courriers, rendez-vous, dossiers — à la tâche, à la semaine ou au mois.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    lang: 'fr-CI',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
