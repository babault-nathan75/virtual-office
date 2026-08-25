import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as OTPAuth from 'otpauth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres.'),
});

/**
 * Confirme l'enrôlement : l'utilisateur prouve que son application génère bien
 * les mêmes codes avant que le second facteur ne devienne obligatoire.
 *
 * Sans cette étape, un utilisateur qui aurait mal scanné le QR code se
 * retrouverait définitivement enfermé dehors à sa prochaine connexion.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rate = await checkRateLimit(`2fa-verify:${user.id}:${getClientIp(request)}`, 8, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: tfa } = await supabase
    .from('two_factor_auth')
    .select('secret, method, enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tfa) {
    return NextResponse.json(
      { error: "Aucune configuration en cours. Recommencez l'activation." },
      { status: 400 }
    );
  }

  if (tfa.enabled) {
    return NextResponse.json({ error: 'Le second facteur est déjà activé.' }, { status: 409 });
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'SecretariatPro',
    label: user.email ?? user.id,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(tfa.secret),
  });

  if (totp.validate({ token: parsed.data.code, window: 1 }) === null) {
    return NextResponse.json(
      { error: "Code incorrect. Vérifiez l'heure de votre téléphone puis réessayez." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('two_factor_auth')
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    console.error('[2fa/verify]', error.message);
    return NextResponse.json({ error: 'Activation impossible.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
