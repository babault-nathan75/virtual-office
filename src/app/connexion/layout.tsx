import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/env';

/*
 * Rendu dynamique imposé.
 *
 * `proxy.ts` sert ces pages sous une Content-Security-Policy à nonce. Le nonce
 * est tiré à chaque requête, et Next ne peut l'appliquer à ses scripts en
 * ligne qu'au moment du rendu. Une page pré-rendue au build porterait un HTML
 * figé, sans nonce — ou avec un nonce périmé : le navigateur bloquerait alors
 * tous ses scripts et la page serait inerte.
 *
 * C'est le coût assumé du nonce, et la raison pour laquelle il n'est appliqué
 * qu'ici et non sur les pages publiques, qui restent pré-rendues et servies
 * par le CDN. Voir src/lib/csp.ts.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connexion',
  description:
    'Connectez-vous à votre espace SecrétariatPro. Accédez à vos missions, discussions et paramètres.',
  // La page n'apporte rien en recherche mais transmet son autorité aux liens
  // qu'elle contient (inscription, mentions légales).
  robots: { index: false, follow: true },
  alternates: { canonical: `${getSiteUrl()}/connexion` },
};

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
