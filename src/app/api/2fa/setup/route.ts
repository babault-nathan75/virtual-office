import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * Démarre l'enrôlement d'une application d'authentification.
 *
 * La méthode « code par email » a été retirée : depuis le durcissement de la
 * connexion, un code email est demandé à TOUS les comptes à chaque connexion.
 * La proposer en option laissait croire à un réglage facultatif alors qu'elle
 * décrivait le comportement par défaut, et son implémentation concaténait le
 * code dans la colonne `secret` — deux appels successifs corrompaient la ligne.
 *
 * L'identité vient exclusivement de la session : l'ancienne version lisait
 * l'identifiant dans le corps de la requête et l'adresse email dans un en-tête
 * `x-user-email` fourni par le client.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rate = await checkRateLimit(`2fa-setup:${user.id}:${getClientIp(request)}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('two_factor_auth')
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.enabled) {
    return NextResponse.json(
      { error: "L'application d'authentification est déjà activée sur ce compte." },
      { status: 409 }
    );
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'SecretariatPro',
    // Le libellé est ce qu'affiche l'application d'authentification : une
    // adresse email est identifiable, contrairement à un UUID.
    label: user.email ?? user.id,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;

  const { error } = await supabase.from('two_factor_auth').upsert(
    {
      user_id: user.id,
      secret,
      method: 'totp',
      enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[2fa/setup]', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  const qrData = await QRCode.toDataURL(totp.toString(), { margin: 1, width: 240 });

  return NextResponse.json({ method: 'totp', qrData, secret });
}
