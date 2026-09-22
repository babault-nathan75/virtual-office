import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ALLOWED_REDIRECT_PATHS = [
  '/dashboard/admin',
  '/dashboard/secretaire',
  '/dashboard/entreprise',
  '/dashboard',
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Role passed from signup (entreprise or secretaire)
  const roleParam = searchParams.get('role');
  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?error=auth_callback_error`);
  }

  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: cookiesToSet => {
          pendingCookies.push(...cookiesToSet.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            options: cookie.options as Record<string, unknown>,
          })));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/connexion?error=auth_callback_error`);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const nom = data.user.user_metadata?.full_name
    || data.user.user_metadata?.name
    || data.user.email?.split('@')[0]
    || 'Utilisateur';
  const { data: existing } = await admin
    .from('profils')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  // If user exists, use their role. If new, use the role from signup param or default to secretaire
  let roleFinal = existing?.role;
  if (!existing) {
    roleFinal = (roleParam === 'entreprise' || roleParam === 'secretaire') ? roleParam : 'secretaire';
    const { data: created, error: profileError } = await admin
      .from('profils')
      .insert({ id: data.user.id, nom, email: data.user.email, role: roleFinal })
      .select('role')
      .single();
    if (profileError && profileError.code !== '23505') {
      console.error('[auth/callback] profile creation error:', profileError.message);
      return NextResponse.redirect(`${origin}/connexion?error=profile_creation_error`);
    }
    roleFinal = created?.role || roleFinal;
  }

  const redirectPath = roleFinal === 'admin'
    ? '/dashboard/admin'
    : roleFinal === 'entreprise'
      ? '/dashboard/entreprise'
      : '/dashboard/secretaire';
  if (!ALLOWED_REDIRECT_PATHS.includes(redirectPath)) {
    return NextResponse.redirect(`${origin}/connexion?error=invalid_redirect`);
  }

  const response = NextResponse.redirect(`${origin}${redirectPath}`);
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);
  }
  return response;
}
