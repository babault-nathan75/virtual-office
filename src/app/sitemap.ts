import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

/**
 * Le domaine était écrit en dur : un déploiement de prévisualisation ou un
 * changement de domaine produisait un sitemap pointant vers un autre site,
 * ce que les moteurs traitent comme un signal de duplication.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
  }> = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/inscription', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/connexion', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/mentions-legales', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/cgu', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/confidentialite', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
