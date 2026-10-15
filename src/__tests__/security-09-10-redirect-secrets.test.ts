/**
 * Menaces 9 (Open Redirect) et 10 (Secrets exposés).
 *
 * Open redirect : toute destination venue de l'extérieur (`?suivant=`, URL de
 * notification push, rôle du callback OAuth) doit rester un chemin interne.
 * Les charges utiles couvrent les contournements connus des filtres naïfs —
 * dont `/\t/evil.com`, que le navigateur réécrit en `//evil.com`.
 *
 * Secrets : aucun secret dans les fichiers versionnés, `.env` ignoré, aucune
 * variable serveur lue depuis un composant client.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fake, jsonRequest } from './helpers/fakeSupabase';

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  return { sendNotification: vi.fn(async (_sub: unknown, _payload: string) => ({})) };
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
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: vi.fn() }),
}));

import { safeInternalPath } from '@/lib/safeRedirect';

const ME = '11111111-1111-4111-8111-111111111111';

const REDIRECT_PAYLOADS = [
  'https://evil.example',
  '//evil.example',
  '///evil.example',
  '/\\evil.example',
  '\\\\evil.example',
  '/\t/evil.example',
  '/\n/evil.example',
  '/\r\n/evil.example',
  ' //evil.example',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'evil.example',
  '',
];

beforeEach(() => {
  fake.reset();
  mocks.sendNotification.mockClear();
});

// ---------------------------------------------------------------------------
describe('9. Open Redirect', () => {
  it.each(REDIRECT_PAYLOADS)('safeInternalPath refuse %j', payload => {
    expect(safeInternalPath(payload)).toBeNull();
  });

  it.each(['/dashboard', '/dashboard/messages?conv=12#bas', '/dashboard/admin/utilisateurs/abc'])(
    'safeInternalPath accepte le chemin interne %s',
    path => {
      expect(safeInternalPath(path)).toBe(path);
    }
  );

  it('toute valeur acceptée reste sur le site une fois résolue par un navigateur', () => {
    for (const payload of [...REDIRECT_PAYLOADS, '/ok', '/a/b?c=//d']) {
      const accepted = safeInternalPath(payload);
      if (accepted) expect(new URL(accepted, 'https://secretariatpro.com').origin).toBe('https://secretariatpro.com');
    }
  });

  it.each(['ConnexionForm.tsx', 'VerificationForm.tsx'])(
    '%s utilise le filtre partagé (pas une copie locale)',
    file => {
      const dir = file.startsWith('Connexion') ? 'connexion' : 'verification';
      const source = readFileSync(`src/app/${dir}/${file}`, 'utf8');
      expect(source).toContain("from '@/lib/safeRedirect'");
      expect(source).not.toMatch(/function safeInternalPath/);
    }
  );

  it.each(['https://evil.example', '//evil.example', '/\t/evil.example'])(
    "l'URL d'une notification push ne peut pas sortir du site : %j",
    async url => {
      vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
      vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
      fake.sessionUser = { id: ME };
      fake.results.set('push_subscriptions', {
        data: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/ok', p256dh: 'k', auth: 'a' }],
      });

      const { POST } = await import('@/app/api/push/send/route');
      await POST(jsonRequest('http://localhost/api/push/send', { userId: ME, title: 'T', body: 'B', url }));

      const payload = JSON.parse(mocks.sendNotification.mock.calls[0][1]);
      expect(payload.url).toBe('/dashboard/messages');
    }
  );

  it('le callback OAuth ne redirige que sur le site et ignore role=admin', async () => {
    fake.sessionUser = { id: ME, email: 'nouveau@example.com' };
    fake.results.set('profils', calls =>
      calls.some(c => c.method === 'insert') ? { data: { role: 'secretaire' } } : { data: null }
    );

    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new Request('https://secretariatpro.com/auth/callback?code=abc&role=admin&next=https://evil.example'));

    const location = new URL(response.headers.get('location')!);
    expect(location.origin).toBe('https://secretariatpro.com');
    expect(location.pathname).not.toContain('admin');

    const [insert] = fake.callsOn('profils', 'insert');
    expect((insert.args[0] as { role: string }).role).not.toBe('admin');
  });
});

// ---------------------------------------------------------------------------
describe('10. Secrets exposés', () => {
  const tracked = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean)
    .filter(f => !/\.(png|jpe?g|jfif|gif|webp|avif|ico|woff2?|ttf|eot|mp3|mp4|pdf)$/i.test(f))
    .filter(f => f !== 'package-lock.json')
    .filter(f => existsSync(f));

  const read = (file: string) => readFileSync(file, 'utf8');

  it('.env et ses variantes ne sont pas versionnés', () => {
    const envFiles = tracked.filter(f => /(^|\/)\.env(\.|$)/.test(f));
    expect(envFiles).toEqual(['.env.example']);
    expect(read('.gitignore')).toMatch(/^\.env\*$/m);
  });

  it('.env.example ne contient aucune valeur secrète renseignée', () => {
    const secretKeys = /(KEY|SECRET|PASS|TOKEN|PRIVATE)[A-Z_]*=(.+)$/gm;
    const filled = [...read('.env.example').matchAll(secretKeys)].map(m => m[0]);
    expect(filled).toEqual([]);
  });

  const SECRET_PATTERNS: [string, RegExp][] = [
    ['clé privée', /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
    ['JWT Supabase (service role ou anon)', /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[A-Za-z0-9_-]{20,}/],
    ['clé Brevo', /xkeysib-[0-9a-f]{20,}|xsmtpsib-[0-9a-f]{20,}/],
    ['clé Stripe', /sk_(live|test)_[0-9A-Za-z]{16,}/],
    ['clé Google / Gemini', /AIza[0-9A-Za-z_-]{35}/],
    ['jeton GitHub', /gh[pousr]_[0-9A-Za-z]{36}/],
    ['clé AWS', /AKIA[0-9A-Z]{16}/],
    ['jeton Slack', /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ];

  it.each(SECRET_PATTERNS)("aucun fichier versionné ne contient de %s", (_label, pattern) => {
    const leaks = tracked.filter(file => pattern.test(read(file)));
    expect(leaks).toEqual([]);
  });

  it('aucune valeur du .env local ne se retrouve dans un fichier versionné', () => {
    if (!existsSync('.env')) return; // CI : pas de .env, rien à comparer
    const values = read('.env')
      .split(/\r?\n/)
      .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .filter(([, key]) => !key.startsWith('NEXT_PUBLIC_') && /KEY|SECRET|PASS|TOKEN|PRIVATE|DSN/.test(key))
      .map(([, key, value]) => [key, value.trim().replace(/^['"]|['"]$/g, '')] as const)
      .filter(([, value]) => value.length >= 12);

    const leaks = values.flatMap(([key, value]) =>
      tracked.filter(file => read(file).includes(value)).map(file => `${key} → ${file}`)
    );
    expect(leaks).toEqual([]);
  });

  it("aucun composant client ne lit une variable d'environnement serveur", () => {
    const clientFiles = tracked
      .filter(f => /^src\/.*\.(ts|tsx)$/.test(f))
      .filter(f => /^\s*['"]use client['"]/.test(read(f)));

    const offenders = clientFiles.flatMap(file => {
      const source = read(file);
      const envs = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
        .map(m => m[1])
        .filter(name => !name.startsWith('NEXT_PUBLIC_') && name !== 'NODE_ENV');
      const admin = /supabaseAdmin|SERVICE_ROLE/.test(source) ? ['supabaseAdmin'] : [];
      return [...envs, ...admin].map(name => `${file}: ${name}`);
    });

    expect(clientFiles.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('aucune clé de service n\'est exposée sous un nom NEXT_PUBLIC_*', () => {
    const offenders = tracked
      .filter(f => /\.(ts|tsx|js|mjs|cjs|ya?ml|example)$/.test(f))
      .filter(f => /NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE)/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
