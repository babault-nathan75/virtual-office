import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const validateSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, 'Le code doit contenir 6 chiffres'),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit('2fa-validate', 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId, code } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
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
