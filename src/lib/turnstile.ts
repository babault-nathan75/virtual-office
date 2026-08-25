import { env } from '@/lib/env';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Clés de test publiques de Cloudflare.
 *
 * Elles permettent de faire tourner l'application en local, et la CI, sans
 * compte Cloudflare : le widget s'affiche et valide toujours. Elles ne sont
 * jamais utilisées si de vraies clés sont configurées.
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

export function getTurnstileSiteKey(): string {
  return env.turnstileSiteKey || TURNSTILE_TEST_SITE_KEY;
}

/**
 * Une clé réelle est-elle configurée ?
 *
 * Sert à refuser le démarrage en production avec les clés de test, qui
 * laisseraient passer tous les bots en silence.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(env.turnstileSecretKey && env.turnstileSiteKey);
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'missing_token' | 'rejected' | 'unavailable'; codes?: string[] };

type SiteverifyResponse = {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
};

/**
 * Valide un jeton Turnstile auprès de Cloudflare.
 *
 * Politique de repli volontairement « fail-closed » en production : si l'API
 * de Cloudflare est injoignable, on refuse. Un anti-bot qui s'ouvre en grand
 * dès qu'on le rend indisponible ne protège rien — et rendre un service tiers
 * indisponible est précisément à la portée de l'attaquant qu'il vise.
 * En développement, l'indisponibilité laisse passer pour ne pas bloquer le
 * travail hors ligne.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  options: { remoteIp?: string; action?: string } = {}
): Promise<TurnstileResult> {
  if (!token) return { ok: false, reason: 'missing_token' };

  const secret = env.turnstileSecretKey || TURNSTILE_TEST_SECRET_KEY;

  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp && options.remoteIp !== 'unknown') {
    body.set('remoteip', options.remoteIp);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return process.env.NODE_ENV === 'production'
        ? { ok: false, reason: 'unavailable' }
        : { ok: true };
    }

    const data = (await response.json()) as SiteverifyResponse;

    if (!data.success) {
      // Les codes d'erreur de Cloudflare sont la seule information exploitable
      // quand une vérification échoue en production : sans eux, on ne distingue
      // pas une clé mal configurée d'un jeton expiré ou d'un vrai robot.
      console.warn('[turnstile] refus :', (data['error-codes'] ?? []).join(', ') || 'sans code');
      return { ok: false, reason: 'rejected', codes: data['error-codes'] };
    }

    // `action` est fixée par le widget côté client et renvoyée par Cloudflare :
    // la vérifier empêche de rejouer sur la connexion un jeton obtenu sur le
    // formulaire d'inscription.
    if (options.action && data.action && data.action !== options.action) {
      console.warn(`[turnstile] action inattendue : ${data.action} au lieu de ${options.action}`);
      return { ok: false, reason: 'rejected', codes: ['action-mismatch'] };
    }

    return { ok: true };
  } catch {
    return process.env.NODE_ENV === 'production'
      ? { ok: false, reason: 'unavailable' }
      : { ok: true };
  }
}

export function turnstileFailureMessage(result: Extract<TurnstileResult, { ok: false }>): string {
  switch (result.reason) {
    case 'missing_token':
      return 'Veuillez valider la vérification anti-robot avant de continuer.';
    case 'unavailable':
      return 'La vérification anti-robot est momentanément indisponible. Réessayez dans un instant.';
    case 'rejected':
      return 'Vérification anti-robot échouée. Rechargez la page et réessayez.';
  }
}
