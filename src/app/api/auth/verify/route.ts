import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as OTPAuth from 'otpauth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyOtp, verifyFailureMessage, normalizeEmail, OTP_LENGTH } from '@/lib/otp';
import { logAuthEvent } from '@/lib/authEvents';
import { readChallengeCookie, clearChallengeCookie } from '@/lib/authChallenge';
import { issueSessionFor } from '@/lib/sessionIssuer';
import { roleHomePath } from '@/lib/roles';
import { trustCurrentDevice } from '@/lib/trustedDevice';

export const runtime = 'nodejs';

const bodySchema = z.object({
  code: z
    .string()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Le code doit contenir ${OTP_LENGTH} chiffres.`),
  purpose: z.enum(['signup', 'login']),
  /**
   * Mémoriser l'appareil pour 30 jours.
   *
   * Coché par défaut dans l'interface, mais décochable : sur un poste partagé
   * — cybercafé, ordinateur familial — mémoriser l'appareil reviendrait à
   * dispenser le suivant du second facteur.
   */
  trustDevice: z.boolean().optional(),
  // Utilisée uniquement pour l'inscription, où aucun cookie de défi n'existe
  // encore. Pour la connexion, l'adresse provient du cookie signé : l'accepter
  // depuis le corps de la requête permettrait de valider le code d'un tiers.
  email: z.string().email().max(254).optional(),
});

/**
 * Seconde étape : validation du second facteur et ouverture de session.
 *
 * C'est le seul endroit de l'application qui crée une session par mot de passe.
 * Toute tentative d'atteindre le tableau de bord sans passer par ici se heurte
 * à l'absence de cookie Supabase — contrairement à l'ancienne 2FA, qui
 * ouvrait la session AVANT de demander le code et se contournait donc en
 * ignorant simplement la redirection côté navigateur.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  const rate = await checkRateLimit(`auth-verify:${ip}`, 15, 5 * 60_000);
  if (!rate.allowed) {
    await logAuthEvent({ event: 'rate_limited', ipAddress: ip, userAgent });
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': '300' } }
    );
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

  const { code, purpose } = parsed.data;
  const supabase = getSupabaseAdmin();

  let email: string;
  let method: 'email' | 'totp' = 'email';
  let challengeUserId: string | null = null;

  if (purpose === 'login') {
    const challenge = await readChallengeCookie();
    if (!challenge || challenge.purpose !== 'login') {
      return NextResponse.json(
        { error: 'Session de connexion expirée. Recommencez la connexion.', next: 'login' },
        { status: 401 }
      );
    }
    email = challenge.email;
    method = challenge.method;
    challengeUserId = challenge.uid;
  } else {
    if (!parsed.data.email) {
      return NextResponse.json({ error: 'Adresse email manquante.' }, { status: 400 });
    }
    email = normalizeEmail(parsed.data.email);
  }

  let verifiedUserId: string | null = challengeUserId;

  if (method === 'totp') {
    const valid = await verifyTotp(challengeUserId!, code);
    if (!valid) {
      await logAuthEvent({ event: 'login_otp_failed', email, userId: challengeUserId, ipAddress: ip, userAgent });
      return NextResponse.json(
        { error: "Code incorrect. Vérifiez l'heure de votre téléphone puis réessayez." },
        { status: 400 }
      );
    }
  } else {
    const result = await verifyOtp({ email, purpose, code });
    if (!result.ok) {
      await logAuthEvent({ event: 'login_otp_failed', email, ipAddress: ip, userAgent });
      return NextResponse.json({ error: verifyFailureMessage(result) }, { status: 400 });
    }
    verifiedUserId = result.userId ?? challengeUserId;
  }

  const { data: profil } = await supabase
    .from('profils')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  const userId = verifiedUserId ?? profil?.id ?? null;

  if (!userId) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  if (purpose === 'signup') {
    const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[auth/verify] confirmation email :', confirmError.message);
      return NextResponse.json({ error: 'Activation du compte impossible.' }, { status: 500 });
    }
    await supabase.from('profils').update({ email_confirmed: true }).eq('id', userId);
    await logAuthEvent({ event: 'signup_verified', email, userId, ipAddress: ip, userAgent });
  } else {
    await logAuthEvent({ event: 'login_otp_ok', email, userId, ipAddress: ip, userAgent });
  }

  const session = await issueSessionFor(email);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 500 });
  }

  // Le rôle est relu ici plutôt que pris du cookie : c'est la base qui fait
  // autorité sur les privilèges, et les administrateurs ne sont jamais
  // dispensés de second facteur.
  if (parsed.data.trustDevice !== false && profil?.role !== 'admin') {
    await trustCurrentDevice({ userId, userAgent });
  }

  await clearChallengeCookie();

  const role = profil?.role ?? 'entreprise';

  return NextResponse.json({ ok: true, role, redirectTo: roleHomePath(role) });
}

/**
 * Valide un code d'application d'authentification.
 *
 * `window: 1` tolère une dérive d'une période (30 s) de part et d'autre : sans
 * cela, une horloge de téléphone légèrement décalée rend le compte inutilisable.
 */
async function verifyTotp(userId: string, code: string): Promise<boolean> {
  const { data: tfa } = await getSupabaseAdmin()
    .from('two_factor_auth')
    .select('secret, method, enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tfa?.enabled || tfa.method !== 'totp' || !tfa.secret) return false;

  const totp = new OTPAuth.TOTP({
    issuer: 'SecretariatPro',
    label: userId,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(tfa.secret),
  });

  return totp.validate({ token: code, window: 1 }) !== null;
}
