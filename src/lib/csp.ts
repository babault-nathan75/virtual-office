/**
 * Construction de la Content-Security-Policy.
 *
 * Deux variantes, appliquées à des ensembles de routes disjoints :
 *
 *  — **avec nonce** sur les écrans d'authentification et le tableau de bord.
 *    `script-src` n'y accepte aucun script en ligne non signé, ce qui est la
 *    seule configuration où le CSP protège réellement d'une injection de
 *    script. Le coût est un rendu dynamique : ces pages lisent de toute façon
 *    des cookies ou des données personnelles et ne bénéficiaient d'aucun cache
 *    partagé.
 *
 *  — **sans nonce** ailleurs (accueil, pages légales). `'unsafe-inline'` y
 *    subsiste, mais ces pages restent pré-rendues et servies par le CDN. Elles
 *    n'affichent aucune donnée utilisateur et ne portent aucune session : le
 *    gain d'un nonce n'y justifie pas de perdre le premier affichage de la
 *    vitrine.
 *
 * Dans les deux cas, les autres directives font le même travail :
 * `connect-src` borne l'exfiltration, `frame-ancestors` bloque le détournement
 * de clic, `base-uri` empêche la réécriture des URL relatives et `form-action`
 * interdit de rediriger la soumission d'un formulaire vers un domaine tiers.
 */

/** Préfixes de chemins servis avec un nonce. */
export const NONCE_PROTECTED_PREFIXES = [
  '/connexion',
  '/inscription',
  '/verification',
  '/dashboard',
] as const;

export function isNonceProtectedPath(pathname: string): boolean {
  return NONCE_PROTECTED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

type Options = {
  /** Valeur base64 du nonce ; absente, la politique retombe sur 'unsafe-inline'. */
  nonce?: string;
  supabaseUrl?: string | null;
  isDev?: boolean;
};

export function buildCsp({ nonce, supabaseUrl, isDev = false }: Options = {}): string {
  let supabaseOrigin = '';
  let supabaseHost = '';
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      supabaseOrigin = parsed.origin;
      supabaseHost = parsed.hostname;
    } catch {
      /* URL malformée : on omet simplement l'origine */
    }
  }

  // En développement, React reconstruit les piles d'erreurs serveur dans le
  // navigateur au moyen de `eval`. Ni React ni Next ne l'utilisent en
  // production.
  const devEval = isDev ? " 'unsafe-eval'" : '';

  const scriptSources = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : "'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://plausible.io',
    'https://va.vercel-scripts.com',
  ].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources}${devEval}`,
    // `style-src` conserve 'unsafe-inline' même en mode nonce : Tailwind,
    // next/font et l'attribut `style` de React produisent des styles en ligne
    // non signables. Une injection de style seule ne permet ni exécution ni
    // exfiltration ici, les autres directives fermant les canaux réseau.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''} https://lh3.googleusercontent.com https://avatars.githubusercontent.com`,
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      supabaseOrigin,
      supabaseHost ? `wss://${supabaseHost}` : '',
      'https://api.pwnedpasswords.com',
      'https://challenges.cloudflare.com',
      'https://plausible.io',
      'https://*.ingest.sentry.io',
      'https://*.ingest.de.sentry.io',
      'https://*.ingest.us.sentry.io',
      'https://vitals.vercel-insights.com',
      isDev ? 'ws://localhost:*' : '',
    ]
      .filter(Boolean)
      .join(' '),
    'frame-src https://challenges.cloudflare.com',
    // blob: pour l'enregistrement vocal du chat et l'aperçu des photos KYC.
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
