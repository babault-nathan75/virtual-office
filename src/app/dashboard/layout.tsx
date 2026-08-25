import type { Metadata } from 'next';

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
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
