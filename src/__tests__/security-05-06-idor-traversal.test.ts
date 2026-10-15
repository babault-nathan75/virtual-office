/**
 * Menaces 5 (IDOR) et 6 (Path Traversal).
 *
 * IDOR : chaque route qui reçoit un identifiant doit vérifier que la ressource
 * appartient à l'appelant — ou qu'il a le rôle requis — AVANT toute lecture ou
 * écriture. Les tests contrôlent le statut ET l'absence d'accès à la base.
 *
 * Path traversal : le proxy rejette `..` (encodé ou non), et les politiques de
 * stockage limitent chaque upload au dossier `<auth.uid()>/`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { fake, jsonRequest } from './helpers/fakeSupabase';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://secretariatpro.com';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.AUTH_SECRET = 'secret-de-test-suffisamment-long-pour-passer-32';
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
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: vi.fn() }),
}));

import { proxy } from '@/proxy';

const ME = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Le rôle de l'appelant, servi par la table `profils`. */
function callerRole(role: string) {
  fake.results.set('profils', { data: { role } });
}

// ---------------------------------------------------------------------------
describe('5. IDOR — données', () => {
  it('la recherche refuse une conversation entre deux autres utilisateurs', async () => {
    fake.sessionUser = { id: ME };
    const { GET } = await import('@/app/api/messages/search/route');
    const response = await GET(new Request(`http://localhost/api/messages/search?userId=${A}&otherId=${B}&q=salaire`));

    expect(response.status).toBe(403);
    expect(fake.callsOn('messages')).toHaveLength(0);
  });

  it("l'export refuse une conversation entre deux autres utilisateurs", async () => {
    fake.sessionUser = { id: ME };
    const { POST } = await import('@/app/api/messages/export/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/export', { userId: A, otherId: B }));

    expect(response.status).toBe(403);
    expect(fake.callsOn('messages')).toHaveLength(0);
  });

  it("/api/messages/read refuse de marquer lus les messages d'autrui", async () => {
    fake.sessionUser = { id: ME };
    fake.results.set('messages', { data: [{ id: A, receiver_id: B }] });
    const { POST } = await import('@/app/api/messages/read/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/read', { messageIds: [A] }));

    expect(response.status).toBe(403);
    expect(fake.callsOn('messages', 'update')).toHaveLength(0);
  });

  it("/api/messages/read ne met à jour QUE les messages reçus par l'appelant", async () => {
    fake.sessionUser = { id: ME };
    fake.results.set('messages', { data: [{ id: A, receiver_id: ME }, { id: B, receiver_id: '44444444-4444-4444-8444-444444444444' }] });
    const { POST } = await import('@/app/api/messages/read/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/read', { messageIds: [A, B] }));

    expect(response.status).toBe(200);
    const [update] = fake.callsOn('messages', 'update');
    const inFilter = fake.chainOf(update).find(c => c.method === 'in')!;
    expect(inFilter.args[1]).toEqual([A]);
  });

  it("la révocation d'un appareil est filtrée sur l'utilisateur courant", async () => {
    fake.sessionUser = { id: ME };
    const { DELETE } = await import('@/app/api/auth/devices/route');
    const response = await DELETE(jsonRequest('http://localhost/api/auth/devices', { id: A }, { method: 'DELETE' }));

    expect(response.status).toBe(200);
    const [del] = fake.callsOn('trusted_devices', 'delete');
    const filters = fake.chainOf(del).filter(c => c.method === 'eq').map(c => c.args);
    expect(filters).toContainEqual(['user_id', ME]);
  });

  it("la liste des appareils ne lit que ceux de l'utilisateur courant", async () => {
    fake.sessionUser = { id: ME };
    const { GET } = await import('@/app/api/auth/devices/route');
    await GET();
    const [select] = fake.callsOn('trusted_devices', 'select');
    const filters = fake.chainOf(select).filter(c => c.method === 'eq').map(c => c.args);
    expect(filters).toContainEqual(['user_id', ME]);
  });

  it("/api/push/subscribe refuse d'abonner le compte d'un autre", async () => {
    fake.sessionUser = { id: ME };
    const { POST } = await import('@/app/api/push/subscribe/route');
    const response = await POST(jsonRequest('http://localhost/api/push/subscribe', {
      userId: A, endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'k', auth: 'a',
    }));
    expect(response.status).toBe(401);
    expect(fake.callsOn('push_subscriptions')).toHaveLength(0);
  });

  it("une secrétaire ne peut pas consulter la fiche détaillée d'une autre", async () => {
    fake.sessionUser = { id: ME };
    callerRole('secretaire');
    const { GET } = await import('@/app/api/secretaire/[id]/profil/route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: A }) });

    expect(response.status).toBe(403);
    expect(fake.callsOn('profils_secretaires')).toHaveLength(0);
  });

  it("une entreprise ne voit pas le profil d'une secrétaire non vérifiée (KYC)", async () => {
    fake.sessionUser = { id: ME };
    fake.results.set('profils', calls =>
      calls.some(c => c.method === 'eq' && c.args[1] === ME)
        ? { data: { role: 'entreprise' } }
        : { data: { id: A, nom: 'Marie', role: 'secretaire' } }
    );
    fake.results.set('kyc_verifications', { data: { statut: 'pending' } });

    const { GET } = await import('@/app/api/secretaire/[id]/profil/route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: A }) });

    expect(response.status).toBe(403);
    expect(fake.callsOn('profils_secretaires')).toHaveLength(0);
  });
});

describe('5. IDOR — rôles et espaces protégés', () => {
  it.each([
    ['/api/admin/delete-user', { userId: A }],
    ['/api/admin/bulk-email', { subject: 'x', html: '<p>x</p>' }],
  ])('%s est réservé aux administrateurs', async (path, body) => {
    fake.sessionUser = { id: ME };
    callerRole('entreprise');
    const route = path === '/api/admin/delete-user'
      ? await import('@/app/api/admin/delete-user/route')
      : await import('@/app/api/admin/bulk-email/route');
    const response = await route.POST(jsonRequest(`http://localhost${path}`, body, {
      headers: { authorization: 'Bearer jeton' },
    }) as never);

    expect(response.status).toBe(403);
    expect(fake.deleteUser).not.toHaveBeenCalled();
    expect(fake.calls.filter(c => c.method === 'delete')).toHaveLength(0);
  });

  it('les routes admin refusent une requête sans jeton', async () => {
    const { POST } = await import('@/app/api/admin/delete-user/route');
    const response = await POST(jsonRequest('http://localhost/api/admin/delete-user', { userId: A }) as never);
    expect(response.status).toBe(401);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ['secretaire', '/dashboard/admin'],
    ['secretaire', '/dashboard/entreprise'],
    ['entreprise', '/dashboard/secretaire'],
    ['entreprise', '/dashboard/admin/utilisateurs'],
  ])('le proxy renvoie un compte %s hors de %s', async (role, path) => {
    fake.sessionUser = { id: ME };
    callerRole(role);
    const response = await proxy(new NextRequest(`https://secretariatpro.com${path}`, { headers: { host: 'secretariatpro.com' } }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard');
  });

  it("un administrateur sans TOTP actif est renvoyé vers l'activation du second facteur", async () => {
    fake.sessionUser = { id: ME };
    callerRole('admin');
    fake.results.set('two_factor_auth', { data: { enabled: false, method: 'email' } });
    const response = await proxy(new NextRequest('https://secretariatpro.com/dashboard/admin', { headers: { host: 'secretariatpro.com' } }));

    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard/profil/2fa');
  });

  it('un visiteur anonyme est renvoyé vers la connexion', async () => {
    const response = await proxy(new NextRequest('https://secretariatpro.com/dashboard/messages', { headers: { host: 'secretariatpro.com' } }));
    expect(new URL(response.headers.get('location')!).pathname).toBe('/connexion');
  });
});

// ---------------------------------------------------------------------------
describe('6. Path Traversal', () => {
  it.each([
    '/api/../../etc/passwd',
    '/api/%2e%2e/%2e%2e/etc/passwd',
    '/api/%2E%2E/.env',
    '/dashboard/..%2f..%2f.env',
  ])('le proxy rejette %s', async path => {
    // NextRequest normalise les « .. » littéraux : on passe par un objet
    // minimal qui conserve le chemin brut, tel qu'un client malveillant
    // pourrait l'envoyer.
    const raw = new NextRequest('https://secretariatpro.com/', { headers: { host: 'secretariatpro.com' } });
    Object.defineProperty(raw, 'nextUrl', { value: { pathname: path, search: '', clone: () => new URL(`https://secretariatpro.com${path}`) } });
    const response = await proxy(raw);
    expect(response.status).toBe(400);
  });

  /**
   * Politiques de stockage effectives : pour chaque bucket recevant des
   * uploads, la DERNIÈRE politique INSERT définie dans les migrations doit
   * imposer que le premier segment du chemin soit l'utilisateur courant.
   * Sans cela, `upload('<id d'un autre>/piece.jpg')` est accepté.
   */
  const migrationFiles = [
    '001_all_features.sql', '004_kyc_storage_fix.sql', '011_cv_secretaires.sql', '012_storage_owner_folder.sql',
  ];
  const sql = migrationFiles.map(f => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');

  it.each(['kyc-identite', 'kyc-selfies', 'kyc-entreprises', 'chat-files', 'chat-audio', 'cv'])(
    "l'upload dans « %s » est limité au dossier de l'utilisateur",
    bucket => {
      const inserts = [...sql.matchAll(/CREATE POLICY[^;]*?FOR INSERT[^;]*?;/gis)]
        .map(m => m[0])
        .filter(policy => policy.includes(`'${bucket}'`));

      expect(inserts.length).toBeGreaterThan(0);
      const effective = inserts[inserts.length - 1];
      expect(effective).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/);
    }
  );

  it('les noms de fichiers uploadés sont préfixés par l\'identifiant de session', () => {
    const sources = [
      'src/app/dashboard/kyc/page.tsx',
      'src/components/ChatWindow.tsx',
      'src/lib/usePhotoUpload.ts',
      'src/app/dashboard/secretaire/profil/page.tsx',
    ].map(f => readFileSync(f, 'utf8'));

    for (const source of sources) {
      const paths = [...source.matchAll(/const (?:path|filePath) = `([^`]+)`/g)].map(m => m[1]);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) expect(p).toMatch(/^\$\{(userId|currentUserId)\}\//);
    }
  });
});
