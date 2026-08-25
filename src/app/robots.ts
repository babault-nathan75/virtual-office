import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/profile/',
          '/offline',
          // Écrans transactionnels : sans valeur en recherche, et l'URL de
          // vérification porte une adresse email en paramètre.
          '/verification',
          '/reinitialisation',
          '/monitoring',
        ],
      },
      // Les fiches de secrétaires sont des données personnelles ; les laisser
      // alimenter l'entraînement de modèles tiers n'a jamais été consenti par
      // les personnes concernées.
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
