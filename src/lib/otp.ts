import crypto from 'node:crypto';
import { getAuthSecret } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type OtpPurpose = 'signup' | 'login' | 'password_reset' | 'email_change';

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** Délai minimal entre deux envois pour un même couple (email, purpose). */
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

const PURPOSE_LABELS: Record<OtpPurpose, string> = {
  signup: 'finaliser la création de votre compte',
  login: 'vous connecter à votre compte',
  password_reset: 'réinitialiser votre mot de passe',
  email_change: 'confirmer votre nouvelle adresse email',
};

export function purposeLabel(purpose: OtpPurpose): string {
  return PURPOSE_LABELS[purpose];
}

/**
 * Normalise une adresse email avant toute comparaison ou indexation.
 *
 * Sans cela, « Alice@Example.com » et « alice@example.com » produisent deux
 * empreintes différentes : le code envoyé à l'une ne validerait jamais l'autre,
 * et les quotas par adresse seraient contournables par un simple changement de
 * casse.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Génère un code numérique à 6 chiffres uniformément distribué.
 *
 * `randomInt` est rejection-sampled par Node : contrairement à
 * `Math.floor(Math.random() * n)`, il n'introduit pas de biais et est issu du
 * CSPRNG du système.
 */
function generateCode(): string {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/**
 * Empreinte du code, poivrée avec le secret applicatif et liée au couple
 * (email, purpose).
 *
 * Le liage empêche de rejouer sur la connexion un code émis pour
 * l'inscription, et le poivre rend une fuite de la table inexploitable :
 * 10^6 possibilités seraient sinon cassées instantanément par force brute.
 */
function hashCode(code: string, email: string, purpose: OtpPurpose): string {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(`${purpose}:${normalizeEmail(email)}:${code}`)
    .digest('hex');
}

export type IssueResult =
  | { ok: true; code: string; expiresAt: Date }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number };

/**
 * Émet un nouveau code et invalide les précédents.
 *
 * Invalider les anciens est indispensable : laisser plusieurs codes valides
 * simultanément multiplie d'autant les chances d'un attaquant qui devine, et
 * rend le compteur de tentatives contournable par simple renvoi.
 */
export async function issueOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  ipAddress?: string | null;
}): Promise<IssueResult> {
  const supabase = getSupabaseAdmin();
  const email = normalizeEmail(params.email);
  const now = Date.now();

  const { data: last } = await supabase
    .from('otp_codes')
    .select('created_at')
    .eq('email', email)
    .eq('purpose', params.purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.created_at) {
    const elapsed = (now - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  await supabase
    .from('otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .eq('purpose', params.purpose)
    .is('consumed_at', null);

  const code = generateCode();
  const expiresAt = new Date(now + OTP_TTL_MINUTES * 60_000);

  const { error } = await supabase.from('otp_codes').insert({
    user_id: params.userId ?? null,
    email,
    purpose: params.purpose,
    code_hash: hashCode(code, email, params.purpose),
    expires_at: expiresAt.toISOString(),
    max_attempts: OTP_MAX_ATTEMPTS,
    ip_address: params.ipAddress ?? null,
  });

  if (error) {
    throw new Error(`Impossible d'enregistrer le code : ${error.message}`);
  }

  return { ok: true, code, expiresAt };
}

export type VerifyResult =
  | { ok: true; userId: string | null }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'invalid'; remainingAttempts?: number };

/**
 * Vérifie un code et le consomme en cas de succès.
 *
 * La comparaison passe par `timingSafeEqual` : une comparaison `===` sur des
 * chaînes s'arrête au premier caractère différent, ce qui laisse fuiter, à la
 * mesure du temps de réponse, la position de l'erreur.
 */
export async function verifyOtp(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyResult> {
  const supabase = getSupabaseAdmin();
  const email = normalizeEmail(params.email);

  const { data: record } = await supabase
    .from('otp_codes')
    .select('id, user_id, code_hash, attempts, max_attempts, expires_at')
    .eq('email', email)
    .eq('purpose', params.purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { ok: false, reason: 'not_found' };

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await supabase
      .from('otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id);
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= record.max_attempts) {
    await supabase
      .from('otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id);
    return { ok: false, reason: 'too_many_attempts' };
  }

  const expected = Buffer.from(record.code_hash, 'hex');
  const provided = Buffer.from(hashCode(params.code, email, params.purpose), 'hex');
  const matches = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);

  if (!matches) {
    const attempts = record.attempts + 1;
    await supabase.from('otp_codes').update({ attempts }).eq('id', record.id);
    return {
      ok: false,
      reason: 'invalid',
      remainingAttempts: Math.max(0, record.max_attempts - attempts),
    };
  }

  await supabase
    .from('otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', record.id);

  return { ok: true, userId: record.user_id };
}

/** Message utilisateur associé à un échec de vérification. */
export function verifyFailureMessage(result: Extract<VerifyResult, { ok: false }>): string {
  switch (result.reason) {
    case 'not_found':
      return "Aucun code en attente. Demandez un nouvel envoi.";
    case 'expired':
      return 'Ce code a expiré. Demandez un nouveau code.';
    case 'too_many_attempts':
      return 'Trop de tentatives. Un nouveau code est nécessaire.';
    case 'invalid':
      return result.remainingAttempts && result.remainingAttempts > 0
        ? `Code incorrect. ${result.remainingAttempts} tentative${result.remainingAttempts > 1 ? 's' : ''} restante${result.remainingAttempts > 1 ? 's' : ''}.`
        : 'Code incorrect. Demandez un nouveau code.';
  }
}
