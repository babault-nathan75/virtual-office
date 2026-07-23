import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // CSRF protection pour les API POST
  if (pathname.startsWith('/api/') && request.method === 'POST') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && !origin.includes(host)) {
      console.warn(`[CSRF] Requête bloquée: origin=${origin} host=${host}`);
      return NextResponse.json({ error: 'Requête non autorisée' }, { status: 403 });
    }
  }

  // Routes publiques — pas besoin d'auth
  const publicRoutes = ['/', '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialisation', '/cgu', '/confidentialite', '/mentions-legales', '/profile'];
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
      .single();

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

    // KYC obligatoire pour les entreprises et secrétaires (pas admin, pas page KYC elle-même)
    if (role !== 'admin' && !pathname.startsWith('/dashboard/kyc') && !pathname.startsWith('/dashboard/admin')) {
      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('status')
        .eq('user_id', user.id)
        .single();

      if (!kyc || (kyc.status !== 'approved' && kyc.status !== 'pending' && kyc.status !== 'rejected')) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/kyc';
        return NextResponse.redirect(url);
      }

      // Si KYC en attente ou rejeté, permettre seulement /dashboard, /dashboard/kyc, /profile
      if (kyc && (kyc.status === 'pending' || kyc.status === 'rejected')) {
        const allowedPaths = ['/dashboard', '/dashboard/kyc', '/profile', '/dashboard/secretaire/profil'];
        const isAllowed = allowedPaths.some(p => pathname === p);
        if (!isAllowed) {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard/kyc';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
