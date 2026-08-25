import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getAuthSecret } from '@/lib/env';

export const CHALLENGE_COOKIE = 'sp_auth_challenge';
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type Challenge = {
  /** Identifiant de l'utilisateur dont le mot de passe a déjà été validé. */
  uid: string;
  email: string;
  purpose: 'login' | 'signup';
  /**
   * Second facteur attendu : code envoyé par email, ou code d'une application
   * d'authentification si l'utilisateur a activé le TOTP.
   */
  method: 'email' | 'totp';
  /** Expiration en millisecondes epoch. */
  exp: number;
};

/**
 * Jeton d'étape intermédiaire entre « mot de passe correct » et « session
 * ouverte ».
 *
 * C'est la pièce qui rend l'OTP réellement contraignant. Dans l'implémentation
 * précédente, la 2FA était déclenchée par une simple redirection côté client
 * APRÈS que Supabase eut déjà ouvert la session : ignorer la redirection et
 * aller droit sur /dashboard suffisait à passer outre. Ici, aucune session
 * n'est créée tant que le code n'est pas validé ; l'état intermédiaire tient
 * entièrement dans ce cookie signé, httpOnly, non falsifiable côté client.
 */
function sign(payload: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

export function serializeChallenge(challenge: Omit<Challenge, 'exp'>): string {
  const full: Challenge = { ...challenge, exp: Date.now() + CHALLENGE_TTL_MS };
  const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parseChallenge(raw: string | undefined): Challenge | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const challenge = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Challenge;
    if (typeof challenge.exp !== 'number' || challenge.exp < Date.now()) return null;
    if (!challenge.uid || !challenge.email) return null;
    return challenge;
  } catch {
    return null;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: CHALLENGE_TTL_MS / 1000,
};

export async function setChallengeCookie(challenge: Omit<Challenge, 'exp'>): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, serializeChallenge(challenge), COOKIE_OPTIONS);
}

export async function readChallengeCookie(): Promise<Challenge | null> {
  const store = await cookies();
  return parseChallenge(store.get(CHALLENGE_COOKIE)?.value);
}

export async function clearChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
