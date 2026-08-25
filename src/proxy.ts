import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/lib/env';
import { buildCsp, isNonceProtectedPath } from '@/lib/csp';

/**
 * Origines autorisées à émettre des requêtes mutantes.
 *
 * Le domaine de production était écrit en dur ici comme dans trois autres
 * fichiers : un changement de domaine cassait silencieusement la protection
 * CSRF. La liste vient désormais de `getSiteUrl()`.
 */
const ALLOWED_ORIGINS = getAllowedOrigins();
const ALLOWED_HOSTS = new Set(
  [
    ...ALLOWED_ORIGINS,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  ]
    .filter(Boolean)
    .map(origin => {
      try {
        return new URL(origin).hostname;
      } catch {
        return '';
      }
    })
    .filter(Boolean)
);

/** Pages accessibles sans session. */
const PUBLIC_ROUTES = new Set([
  '/',
  '/connexion',
  '/inscription',
  '/verification',
  '/mot-de-passe-oublie',
  '/reinitialisation',
  '/cgu',
  '/confidentialite',
  '/mentions-legales',
  '/profile',
  '/offline',
]);

/** Routes d'API joignables sans session (elles gèrent elles-mêmes leur accès). */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/docs',
  '/monitoring',
];

export async function proxy(request: NextRequest) {
  try {
    return await proxyHandler(request);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.next({ request });
  }
}

async function proxyHandler(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Tentative de traversée de répertoire : rejetée avant tout accès réseau.
  if (pathname.includes('..') || pathname.toLowerCase().includes('%2e%2e')) {
    return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 });
  }

  const isApi = pathname.startsWith('/api/');
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

  /*
   * Protection CSRF — désormais « fail-closed ».
   *
   * L'implémentation précédente n'entrait dans le test que si l'en-tête
   * `Origin` était présent : une requête forgée qui l'omettait passait donc
   * sans contrôle. Tout navigateur envoie `Origin` sur une requête mutante
   * cross-origin ; une absence d'origine ET de referer sur une mutation n'a
   * pas de cas d'usage légitime depuis un navigateur.
   */
  if (isApi && isMutation) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    const candidate = origin ?? referer;
    let originHost: string | null = null;
    if (candidate) {
      try {
        originHost = new URL(candidate).hostname;
      } catch {
        originHost = null;
      }
    }

    const sameHost = Boolean(originHost && host && originHost === host.split(':')[0]);
    const allowed = Boolean(originHost && (ALLOWED_HOSTS.has(originHost) || sameHost));

    if (!allowed) {
      console.warn(`[CSRF] Bloqué : origin=${origin} referer=${referer} host=${host} path=${pathname}`);
      return NextResponse.json({ error: 'Requête non autorisée' }, { status: 403 });
    }
  }

  // Méthodes non prévues sur les routes en lecture seule.
  if (isApi && !['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method)) {
    const allowsExtraMethods =
      pathname.startsWith('/api/admin/') ||
      pathname.startsWith('/api/messages/') ||
      // Révocation d'un appareil de confiance : DELETE y est le verbe juste,
      // et la protection CSRF ci-dessus s'applique déjà à cette méthode.
      pathname === '/api/auth/devices';

    if (!allowsExtraMethods) {
      return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405 });
    }
  }

  const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));

  // Les routes d'authentification n'ont pas besoin de résoudre la session, et
  // certaines la modifient : les faire passer par `getUser()` provoquerait un
  // aller-retour réseau inutile sur le chemin le plus sensible en latence.
  if (isPublicApi) {
    const response = NextResponse.next({ request });
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }

  /*
   * Content-Security-Policy à nonce sur les écrans d'authentification et le
   * tableau de bord.
   *
   * Next lit le nonce dans l'en-tête CSP de la REQUÊTE et l'applique
   * lui-même à ses scripts en ligne : d'où la double écriture, sur les
   * en-têtes transmis au rendu et sur ceux de la réponse.
   *
   * Conséquence assumée : ces pages basculent en rendu dynamique. Elles
   * lisent de toute façon des cookies ou des données personnelles et ne
   * bénéficiaient d'aucun cache partagé.
   */
  const nonce = isNonceProtectedPath(pathname)
    ? Buffer.from(crypto.randomUUID()).toString('base64')
    : null;

  const requestHeaders = new Headers(request.headers);
  let csp: string | null = null;

  if (nonce) {
    csp = buildCsp({
      nonce,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      isDev: process.env.NODE_ENV === 'development',
    });
    requestHeaders.set('Content-Security-Policy', csp);
    requestHeaders.set('x-nonce', nonce);
  }

  const nextOptions = nonce
    ? { request: { headers: requestHeaders } }
    : { request };

  let supabaseResponse = NextResponse.next(nextOptions);

  const applyCsp = (response: NextResponse) => {
    if (csp) response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next(nextOptions);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isApi) {
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return applyCsp(supabaseResponse);
  }

  const isPublic = PUBLIC_ROUTES.has(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/connexion';
    // Mémorise la destination pour y revenir après connexion, au lieu de
    // déposer l'utilisateur sur un tableau de bord générique.
    url.search = `?suivant=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return applyCsp(NextResponse.redirect(url));
  }

  if (user && (pathname === '/connexion' || pathname === '/inscription' || pathname === '/verification')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return applyCsp(NextResponse.redirect(url));
  }

  if (user && pathname.startsWith('/dashboard')) {
    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profil?.role;

    const denied =
      (pathname.startsWith('/dashboard/admin') && role !== 'admin') ||
      (pathname.startsWith('/dashboard/entreprise') && role !== 'entreprise' && role !== 'admin') ||
      (pathname.startsWith('/dashboard/secretaire') && role !== 'secretaire' && role !== 'admin');

    if (denied) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return applyCsp(NextResponse.redirect(url));
    }

    /*
     * Application d'authentification obligatoire pour les administrateurs.
     *
     * Cette exigence n'existait que dans le formulaire de connexion, qui
     * redirigeait vers la page d'activation — une redirection côté navigateur,
     * qu'il suffisait d'ignorer pour atteindre le panneau d'administration.
     * Elle est maintenant appliquée à chaque requête, avant le rendu.
     *
     * La requête ne part que sur `/dashboard/admin/*` : les autres tableaux de
     * bord n'en paient pas le coût.
     */
    if (pathname.startsWith('/dashboard/admin') && role === 'admin') {
      const { data: tfa } = await supabase
        .from('two_factor_auth')
        .select('enabled, method')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tfa?.enabled || tfa.method !== 'totp') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/profil/2fa';
        url.search = '?requis=1';
        return applyCsp(NextResponse.redirect(url));
      }
    }
  }

  return applyCsp(supabaseResponse);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|ico|webmanifest|txt|xml|json|js|css|woff|woff2|ttf|eot)$).*)',
  ],
};
