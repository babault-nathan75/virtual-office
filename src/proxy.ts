import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : '',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://secretariatpro-drab.vercel.app',
].filter(Boolean);

export async function proxy(request: NextRequest) {
  try {
    return await proxyHandler(request);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.next({ request });
  }
}

async function proxyHandler(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
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

  const pathname = request.nextUrl.pathname;

  // Block path traversal attempts
  if (pathname.includes('..') || pathname.includes('%2e%2e')) {
    return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 });
  }

  // CSRF protection for all API mutations
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin && host) {
      const originHost = new URL(origin).hostname;
      const allowed = ALLOWED_ORIGINS.some(o => {
        try { return new URL(o).hostname === originHost; } catch { return false; }
      });
      if (!allowed && originHost !== host) {
        console.warn(`[CSRF] Blocked: origin=${origin} host=${host} path=${pathname}`);
        return NextResponse.json({ error: 'Requête non autorisée' }, { status: 403 });
      }
    }
  }

  // Block non-GET/HEAD/POST methods on read-only API routes
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method)) {
    if (!pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/messages/')) {
      return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405 });
    }
  }

  // Rate limiting headers for API routes
  if (pathname.startsWith('/api/')) {
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // Routes publiques — pas besoin d'auth
  const publicRoutes = ['/', '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialisation', '/cgu', '/confidentialite', '/mentions-legales', '/profile', '/confirmer-email'];
  const isPublic = publicRoutes.some(r => pathname === r) || pathname.startsWith('/api/');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/connexion';
    return NextResponse.redirect(url);
  }

  if (user && isPublic && (pathname === '/connexion' || pathname === '/inscription')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Vérification du rôle pour les routes protégées
  if (user && pathname.startsWith('/dashboard')) {
    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profil?.role;

    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard/entreprise') && role !== 'entreprise' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard/secretaire') && role !== 'secretaire' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|ico|webmanifest|txt|xml|json|js|css|woff|woff2|ttf|eot)$).*)',
  ],
};
