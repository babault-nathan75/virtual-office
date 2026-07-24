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

  const { data: tfa } = await supabaseAdmin
    .from('two_factor_auth')
    .select('secret, method, enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tfa?.enabled) {
    return NextResponse.json({ error: '2FA not enabled' }, { status: 400 });
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
    const expires = parseInt(parts[2], 10);
    isValid = code === storedCode && Date.now() < expires;
  }

  if (!isValid) {
    return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
