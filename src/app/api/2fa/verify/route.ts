import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import { getAuthenticatedUser } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { userId, code } = await request.json();

  if (!userId || !code) {
    return NextResponse.json({ error: 'Missing userId or code' }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  if (user && user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: tfa, error } = await supabaseAdmin
    .from('two_factor_auth')
    .select('secret, method, enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !tfa) {
    return NextResponse.json({ error: '2FA not set up' }, { status: 400 });
  }

  if (tfa.enabled) {
    return NextResponse.json({ error: '2FA already enabled' }, { status: 400 });
  }

  let isValid = false;

  if (tfa.method === 'totp') {
    const totp = new OTPAuth.TOTP({
      issuer: 'SecretariatPro',
      label: userId,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(tfa.secret),
    });
    isValid = totp.validate({ token: code, window: 1 }) !== null;
  } else if (tfa.method === 'email') {
    const parts = tfa.secret.split(':');
    const storedCode = parts[1];
    isValid = code === storedCode;
  }

  if (!isValid) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  }

  await supabaseAdmin
    .from('two_factor_auth')
    .update({ enabled: true })
    .eq('user_id', userId);

  return NextResponse.json({ success: true });
}
