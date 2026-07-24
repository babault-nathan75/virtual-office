import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/connexion?error=missing_token', request.url));
  }

  const { data: confirmation, error: findError } = await supabaseAdmin
    .from('email_confirmations')
    .select('user_id, expires_at, used')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle();

  if (findError || !confirmation) {
    return NextResponse.redirect(new URL('/confirmer-email?status=invalid', request.url));
  }

  if (new Date(confirmation.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/confirmer-email?status=expired', request.url));
  }

  await supabaseAdmin
    .from('email_confirmations')
    .update({ used: true })
    .eq('token', token);

  await supabaseAdmin
    .from('profils')
    .update({ email_confirmed: true })
    .eq('id', confirmation.user_id);

  return NextResponse.redirect(new URL('/connexion?confirmed=1', request.url));
}
