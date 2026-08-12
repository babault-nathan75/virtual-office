import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const ALLOWED_REDIRECT_PATHS = [
  '/dashboard/admin',
  '/dashboard/secretaire',
  '/dashboard/entreprise',
  '/connexion',
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role') || 'secretaire';

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const nom = data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Utilisateur';
      const roleFromMeta = data.user.user_metadata?.role || role;

      const res = await fetch(`${origin}/api/ensure-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, nom, role: roleFromMeta, email: data.user.email }),
      });
      const profileData = await res.json();
      const roleFinal = profileData.role || roleFromMeta;

      const redirectPath = roleFinal === 'admin' ? '/dashboard/admin'
        : roleFinal === 'secretaire' ? '/dashboard/secretaire'
        : '/dashboard/entreprise';

      if (!ALLOWED_REDIRECT_PATHS.includes(redirectPath)) {
        return NextResponse.redirect(`${origin}/connexion?error=invalid_redirect`);
      }

      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?error=auth_callback_error`);
}
