/**
 * Menace 7 — Authentification faible.
 *
 * L'infographie demande « MFA, limitation de débit et verrouillage sur chaque
 * point de connexion ». On vérifie ici, sur la vraie route /api/auth/login :
 * quota par IP, verrouillage par compte, anti-robot, réponse identique quel
 * que soit le motif (pas d'énumération), aucune session avant le second
 * facteur. Puis la politique de mot de passe.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fake, jsonRequest } from './helpers/fakeSupabase';

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.AUTH_SECRET = 'secret-de-test-suffisamment-long-pour-passer-32';
  return {
    rateAllowed: true,
    rateKeys: [] as string[],
    captchaOk: true,
    lockedOut: false,
    issueSession: vi.fn(async (_email: string) => ({ ok: true })),
    setChallenge: vi.fn(async (_c: unknown) => undefined),
    events: [] as string[],
  };
});

vi.mock('@supabase/supabase-js', async () => {
  const { fakeClient } = await import('./helpers/fakeSupabase');
  return { createClient: () => fakeClient };
});
vi.mock('@/lib/supabaseAdmin', async () => {
  const { fakeClient } = await import('./helpers/fakeSupabase');
  return { getSupabaseAdmin: () => fakeClient };
});
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: async (key: string) => {
    mocks.rateKeys.push(key);
    return { allowed: mocks.rateAllowed, remaining: 0 };
  },
  getClientIp: () => '203.0.113.7',
}));
vi.mock('@/lib/turnstile', () => ({
  verifyTurnstile: async () => (mocks.captchaOk ? { ok: true } : { ok: false, reason: 'rejected' }),
  turnstileFailureMessage: () => 'Vérification anti-robot échouée.',
}));
vi.mock('@/lib/authEvents', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/authEvents')>()),
  isLockedOut: async () => ({ locked: mocks.lockedOut, failures: mocks.lockedOut ? 8 : 0 }),
  logAuthEvent: async ({ event }: { event: string }) => { mocks.events.push(event); },
}));
vi.mock('@/lib/sessionIssuer', () => ({ issueSessionFor: mocks.issueSession }));
vi.mock('@/lib/authChallenge', () => ({ setChallengeCookie: mocks.setChallenge }));
vi.mock('@/lib/trustedDevice', () => ({ isDeviceTrusted: async () => false }));
vi.mock('@/lib/mailer', () => ({
  isMailConfigured: () => true,
  sendMail: vi.fn(async () => undefined),
  renderOtpEmail: () => '<p>code</p>',
}));
vi.mock('@/lib/otp', () => ({
  issueOtp: async () => ({ ok: true, code: '123456' }),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
  purposeLabel: () => 'la connexion',
  OTP_TTL_MINUTES: 10,
}));

import { POST as login } from '@/app/api/auth/login/route';
import { strongPassword, COMMON_PASSWORDS } from '@/lib/validations';
import { LOCKOUT_THRESHOLD } from '@/lib/authEvents';

const VALID = { email: 'Marie@Example.com', password: 'mot-de-passe', turnstileToken: 'jeton' };
const req = (body: unknown) => jsonRequest('http://localhost/api/auth/login', body);
const FAILED = { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };

beforeEach(() => {
  fake.reset();
  Object.assign(mocks, { rateAllowed: true, captchaOk: true, lockedOut: false });
  mocks.rateKeys.length = 0;
  mocks.events.length = 0;
  mocks.issueSession.mockClear();
  mocks.setChallenge.mockClear();
});

describe('7. Authentification faible — /api/auth/login', () => {
  it('applique un quota par IP (anti force brute)', async () => {
    mocks.rateAllowed = false;
    const response = await login(req(VALID));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(mocks.rateKeys[0]).toBe('login:203.0.113.7');
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it("verrouille le compte après trop d'échecs, même depuis des IP différentes", async () => {
    mocks.lockedOut = true;
    const response = await login(req(VALID));

    expect(response.status).toBe(429);
    expect(mocks.events).toContain('locked_out');
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it('exige la vérification anti-robot avant de tester le mot de passe', async () => {
    mocks.captchaOk = false;
    const response = await login(req(VALID));

    expect(response.status).toBe(400);
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejette un robot qui remplit le champ piège (honeypot)', async () => {
    const response = await login(req({ ...VALID, website: 'http://spam' }));
    expect([400, 401]).toContain(response.status);
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it('renvoie le même message pour un compte inexistant et un mauvais mot de passe', async () => {
    fake.signInWithPassword.mockResolvedValueOnce(FAILED);
    const unknown = await login(req({ ...VALID, email: 'inconnu@example.com' }));
    fake.signInWithPassword.mockResolvedValueOnce(FAILED);
    const wrong = await login(req(VALID));

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
    expect(mocks.events.filter(e => e === 'login_password_failed')).toHaveLength(2);
  });

  it("n'ouvre AUCUNE session après le seul mot de passe : le second facteur est exigé", async () => {
    fake.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' }, session: null },
      error: null,
    });
    fake.results.set('profils', { data: { nom: 'Marie', role: 'secretaire' } });

    const response = await login(req(VALID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.next).toBe('verify');
    expect(mocks.issueSession).not.toHaveBeenCalled();
    expect(mocks.setChallenge).toHaveBeenCalledOnce();
  });

  it('borne la taille des champs (pas de mot de passe de plusieurs Mo à hacher)', async () => {
    const response = await login(req({ ...VALID, password: 'a'.repeat(10_000) }));
    expect(response.status).toBe(400);
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it('le seuil de verrouillage reste raisonnable', () => {
    expect(LOCKOUT_THRESHOLD).toBeGreaterThan(0);
    expect(LOCKOUT_THRESHOLD).toBeLessThanOrEqual(10);
  });
});

describe('7. Authentification faible — politique de mot de passe', () => {
  it.each([
    ['trop court', 'Ab1!abcd'],
    ['sans majuscule', 'abcdefgh123!'],
    ['sans minuscule', 'ABCDEFGH123!'],
    ['sans chiffre', 'Abcdefghijk!'],
    ['sans caractère spécial', 'Abcdefgh1234'],
  ])('refuse un mot de passe %s', (_label, password) => {
    expect(strongPassword.safeParse(password).success).toBe(false);
  });

  it('refuse les mots de passe de la liste noire, quelle que soit la casse', () => {
    for (const common of COMMON_PASSWORDS) {
      expect(strongPassword.safeParse(common.toUpperCase()).success).toBe(false);
    }
  });

  it('accepte un mot de passe robuste', () => {
    expect(strongPassword.safeParse('Tr0ub4dor&3-Cheval').success).toBe(true);
  });
});
