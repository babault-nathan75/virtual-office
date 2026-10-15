/**
 * Menaces 3 (CSRF), 4 (SSRF) et 8 (Clickjacking).
 *
 * - CSRF : le proxy doit refuser toute mutation d'API dont l'origine n'est
 *   pas le site lui-même — y compris quand `Origin` est absent ou forgé —, et
 *   les cookies d'authentification doivent être `SameSite`, `HttpOnly`.
 * - SSRF : aucune URL fournie par l'utilisateur ne doit être appelée par le
 *   serveur sans liste blanche (abonnements Web Push, notification ntfy).
 * - Clickjacking : `frame-ancestors 'none'` ET `X-Frame-Options: DENY` sur
 *   toutes les pages.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fake, jsonRequest } from './helpers/fakeSupabase';

const mocks = vi.hoisted(() => {
  // Lu au chargement de proxy.ts : doit précéder l'import.
  process.env.NEXT_PUBLIC_SITE_URL = 'https://secretariatpro.com';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.AUTH_SECRET = 'secret-de-test-suffisamment-long-pour-passer-32';
  return {
    sendNotification: vi.fn(async (..._args: unknown[]) => ({})),
    cookieSet: vi.fn(),
  };
});

vi.mock('@supabase/ssr', async () => {
  const { fakeClient } = await import('./helpers/fakeSupabase');
  return { createServerClient: () => fakeClient };
});
vi.mock('@supabase/supabase-js', async () => {
  const { fakeClient } = await import('./helpers/fakeSupabase');
  return { createClient: () => fakeClient };
});
vi.mock('@/lib/supabaseAdmin', async () => {
  const { fakeClient } = await import('./helpers/fakeSupabase');
  return { getSupabaseAdmin: () => fakeClient };
});
vi.mock('@/lib/auth', async () => {
  const { fake: f } = await import('./helpers/fakeSupabase');
  return {
    getAuthenticatedUser: async () => f.sessionUser,
    requireAuth: async () => {
      if (!f.sessionUser) throw new Error('UNAUTHORIZED');
      return f.sessionUser;
    },
  };
});
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 10 }),
  getClientIp: () => '203.0.113.7',
}));
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: mocks.sendNotification },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: mocks.cookieSet }),
}));
vi.mock('@sentry/nextjs', () => ({ withSentryConfig: <T,>(config: T) => config }));

import { proxy } from '@/proxy';
import { isAllowedPushEndpoint } from '@/lib/pushEndpoint';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function apiMutation(headers: Record<string, string>, path = '/api/push/send', method = 'POST') {
  return new NextRequest(`https://secretariatpro.com${path}`, {
    method,
    headers: { host: 'secretariatpro.com', 'content-type': 'application/json', ...headers },
    body: '{}',
  });
}

beforeEach(() => {
  fake.reset();
  mocks.sendNotification.mockClear();
  mocks.cookieSet.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
describe('3. CSRF', () => {
  it.each([
    ['Origin tiers', { origin: 'https://evil.example' }],
    ['Referer tiers sans Origin', { referer: 'https://evil.example/page' }],
    ['ni Origin ni Referer', {}],
    ['Origin « null » (iframe sandbox, data:)', { origin: 'null' }],
    ['domaine suffixé', { origin: 'https://secretariatpro.com.evil.example' }],
    ['sous-domaine piégé', { origin: 'https://secretariatpro.evil.example' }],
  ])('le proxy refuse une mutation d\'API : %s', async (_label, headers) => {
    const response = await proxy(apiMutation(headers as Record<string, string>));
    expect(response.status).toBe(403);
  });

  it.each(['PUT', 'DELETE', 'PATCH'])('le contrôle CSRF couvre aussi %s', async method => {
    const response = await proxy(apiMutation({ origin: 'https://evil.example' }, '/api/auth/devices', method));
    expect(response.status).toBe(403);
  });

  it('les routes publiques d\'authentification sont aussi protégées (login CSRF)', async () => {
    const response = await proxy(apiMutation({ origin: 'https://evil.example' }, '/api/auth/login'));
    expect(response.status).toBe(403);
  });

  it('laisse passer une mutation émise par le site lui-même', async () => {
    const response = await proxy(apiMutation({ origin: 'https://secretariatpro.com' }, '/api/auth/login'));
    expect(response.status).not.toBe(403);
  });

  it('le cookie de défi 2FA est HttpOnly + SameSite', async () => {
    const { setChallengeCookie, CHALLENGE_COOKIE } = await import('@/lib/authChallenge');
    await setChallengeCookie({ uid: ME, email: 'a@b.fr', purpose: 'login', method: 'email' });

    const [name, , options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe(CHALLENGE_COOKIE);
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it("le cookie d'appareil de confiance est HttpOnly + SameSite", async () => {
    const { getOrCreateDeviceId, DEVICE_COOKIE } = await import('@/lib/trustedDevice');
    await getOrCreateDeviceId();

    const [name, value, options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe(DEVICE_COOKIE);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 octets aléatoires
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
  });

  it('un cookie de défi falsifié ou modifié est rejeté', async () => {
    const { serializeChallenge, parseChallenge } = await import('@/lib/authChallenge');
    const valid = serializeChallenge({ uid: ME, email: 'a@b.fr', purpose: 'login', method: 'email' });
    const [payload, signature] = valid.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({
      uid: OTHER, email: 'victime@b.fr', purpose: 'login', method: 'email', exp: Date.now() + 60_000,
    })).toString('base64url');

    expect(parseChallenge(valid)?.uid).toBe(ME);
    expect(parseChallenge(`${forgedPayload}.${signature}`)).toBeNull();
    expect(parseChallenge(`${payload}.`)).toBeNull();
    expect(parseChallenge(payload)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('4. SSRF', () => {
  const INTERNAL_TARGETS = [
    'http://169.254.169.254/latest/meta-data/', // métadonnées cloud
    'https://169.254.169.254/latest/meta-data/',
    'http://localhost:5432/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://10.0.0.5/admin',
    'https://192.168.1.1/',
    'https://exemple.supabase.co/rest/v1/profils',
    'https://fcm.googleapis.com.evil.example/x', // suffixe trompeur
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com:8443/x', // port non standard
    'https://user:pass@fcm.googleapis.com/x',
    'http://fcm.googleapis.com/fcm/send/abc', // HTTP en clair
    'file:///etc/passwd',
    'gopher://127.0.0.1:6379/_FLUSHALL',
  ];

  it.each(INTERNAL_TARGETS)('isAllowedPushEndpoint refuse %s', target => {
    expect(isAllowedPushEndpoint(target)).toBe(false);
  });

  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('isAllowedPushEndpoint accepte le service push réel %s', target => {
    expect(isAllowedPushEndpoint(target)).toBe(true);
  });

  it.each(INTERNAL_TARGETS.filter(t => /^https?:/.test(t)))(
    '/api/push/subscribe refuse d\'enregistrer %s',
    async endpoint => {
      fake.sessionUser = { id: ME };
      const { POST } = await import('@/app/api/push/subscribe/route');
      const response = await POST(jsonRequest('http://localhost/api/push/subscribe', {
        userId: ME, endpoint, p256dh: 'cle', auth: 'auth',
      }));
      expect(response.status).toBe(400);
      expect(fake.callsOn('push_subscriptions', 'upsert')).toHaveLength(0);
    }
  );

  it('/api/push/send ne contacte jamais un abonnement pointant vers le réseau interne', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    fake.sessionUser = { id: ME };
    fake.results.set('push_subscriptions', {
      data: [
        { endpoint: 'http://169.254.169.254/latest/meta-data/', p256dh: 'k', auth: 'a' },
        { endpoint: 'https://fcm.googleapis.com/fcm/send/ok', p256dh: 'k', auth: 'a' },
      ],
    });

    const { POST } = await import('@/app/api/push/send/route');
    const response = await POST(jsonRequest('http://localhost/api/push/send', { userId: ME, title: 'T', body: 'B' }));

    expect(response.status).toBe(200);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    const [subscription] = mocks.sendNotification.mock.calls[0] as [{ endpoint: string }];
    expect(subscription.endpoint).toBe('https://fcm.googleapis.com/fcm/send/ok');
  });

  it("aucune route serveur n'appelle fetch() sur une URL venant de la requête", async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
      });

    // Chaque fetch() côté serveur doit viser une constante ou une variable
    // d'environnement, jamais `body.x`, `searchParams.get()`, `request.url`.
    const offenders = [...walk('src/app/api'), ...walk('src/lib')]
      .flatMap(file => readFileSync(file, 'utf8').split('\n').map(line => ({ file, line })))
      .filter(({ line }) => /\bfetch\(/.test(line))
      .filter(({ line }) => /fetch\(\s*(body|parsed|data|searchParams|request\.|req\.|url\b|params)/.test(line));

    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('8. Clickjacking (et en-têtes de sécurité)', () => {
  type Rule = { source: string; headers: { key: string; value: string }[] };
  let rules: Rule[] = [];

  beforeAll(async () => {
    const config = (await import('../../next.config')).default as { headers: () => Promise<Rule[]> };
    rules = await config.headers();
  });

  /** En-têtes qu'une URL reçoit, d'après les règles de next.config.ts. */
  function headersFor(path: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const rule of rules) {
      const pattern = rule.source
        .replace(/:path\*/g, '.*')
        .replace(/\(\?!/g, '(?!'); // les sources Next sont déjà des regex compatibles
      if (new RegExp(`^${pattern}$`).test(path)) {
        for (const h of rule.headers) result.set(h.key.toLowerCase(), h.value);
      }
    }
    return result;
  }

  it.each(['/', '/cgu', '/connexion', '/dashboard', '/dashboard/admin', '/api/health'])(
    '%s envoie X-Frame-Options: DENY',
    path => {
      expect(headersFor(path).get('x-frame-options')).toBe('DENY');
    }
  );

  it.each(['/', '/cgu', '/mentions-legales'])('la CSP statique de %s contient frame-ancestors \'none\'', path => {
    expect(headersFor(path).get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('les pages à nonce (connexion, tableau de bord) reçoivent frame-ancestors \'none\' du proxy', async () => {
    const response = await proxy(new NextRequest('https://secretariatpro.com/connexion', {
      headers: { host: 'secretariatpro.com' },
    }));
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('HSTS, nosniff, Referrer-Policy et COOP sont posés partout', () => {
    const headers = headersFor('/dashboard');
    expect(headers.get('strict-transport-security')).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });
});
