/**
 * Tests d'autorisation des routes API sensibles.
 *
 * Chacun de ces cas correspond à une faille réellement présente dans le code :
 * auto-attribution du rôle admin, envoi de faux emails « KYC approuvé »,
 * relais d'emails ouvert, notifications push arbitraires, et contournement du
 * secret de cron. Ils servent de filet contre leur réapparition silencieuse.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Doublure Supabase -------------------------------------------------------
// Les routes enchaînent .from().select().eq().maybeSingle() : la doublure
// renvoie `this` à chaque maillon et résout la valeur configurée par table.
const tableResults = new Map<string, unknown>();

function makeQuery(table: string) {
  const result = () => ({ data: tableResults.get(table) ?? null, error: null, count: 0 });
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'gte', 'update', 'insert', 'delete']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result());
  chain.single = vi.fn(async () => result());
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => makeQuery(table) }),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({}) }) },
}));

// Le quota n'est pas le sujet ici : il est toujours passant.
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10 }),
}));

const authState: { user: { id: string; email?: string } | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(async () => authState.user),
  requireAuth: vi.fn(async () => {
    if (!authState.user) throw new Error('UNAUTHORIZED');
    return authState.user;
  }),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const AUTRE_ID = '22222222-2222-4222-8222-222222222222';

function post(body: unknown) {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authState.user = null;
  tableResults.clear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemple.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-test');
  vi.stubEnv('SMTP_USER', 'test@example.com');
  vi.stubEnv('SMTP_PASS', 'motdepasse');
});

describe('/api/ensure-profile', () => {
  it("refuse une requête non authentifiée", async () => {
    const { POST } = await import('@/app/api/ensure-profile/route');
    const response = await POST(post({ userId: USER_ID, role: 'entreprise' }));
    expect(response.status).toBe(401);
  });

  it("refuse l'auto-attribution du rôle admin", async () => {
    authState.user = { id: USER_ID, email: 'moi@example.com' };
    const { POST } = await import('@/app/api/ensure-profile/route');
    const response = await POST(post({ userId: USER_ID, role: 'admin' }));
    // Le schéma n'accepte que 'entreprise' et 'secretaire'.
    expect(response.status).toBe(400);
  });

  it("refuse de créer le profil d'un autre utilisateur", async () => {
    authState.user = { id: USER_ID, email: 'moi@example.com' };
    const { POST } = await import('@/app/api/ensure-profile/route');
    const response = await POST(post({ userId: AUTRE_ID, role: 'entreprise' }));
    expect(response.status).toBe(401);
  });

  it("ignore l'email fourni par le client au profit de celui de la session", async () => {
    authState.user = { id: USER_ID, email: 'session@example.com' };
    const { POST } = await import('@/app/api/ensure-profile/route');
    const response = await POST(
      post({ userId: USER_ID, role: 'secretaire', email: 'victime@example.com' })
    );
    // La requête aboutit, mais l'email de la victime n'a servi à rien :
    // le schéma ne le retient pas.
    expect(response.status).toBe(200);
  });
});

describe('/api/kyc/notify-user', () => {
  it('refuse une requête non authentifiée', async () => {
    const { POST } = await import('@/app/api/kyc/notify-user/route');
    const response = await POST(post({ userId: AUTRE_ID, statut: 'approved' }));
    expect(response.status).toBe(401);
  });

  it('refuse un utilisateur non administrateur', async () => {
    authState.user = { id: USER_ID };
    tableResults.set('profils', { role: 'secretaire' });
    const { POST } = await import('@/app/api/kyc/notify-user/route');
    const response = await POST(post({ userId: AUTRE_ID, statut: 'approved' }));
    expect(response.status).toBe(403);
  });
});

describe('/api/kyc/notify-admins', () => {
  it('refuse une requête non authentifiée', async () => {
    const { POST } = await import('@/app/api/kyc/notify-admins/route');
    const response = await POST(
      post({ userId: USER_ID, prenom: 'Marie', nom: 'Dupont' }) as never
    );
    expect(response.status).toBe(401);
  });

  it("refuse de signaler le dossier d'un autre utilisateur", async () => {
    authState.user = { id: USER_ID };
    const { POST } = await import('@/app/api/kyc/notify-admins/route');
    const response = await POST(
      post({ userId: AUTRE_ID, prenom: 'Marie', nom: 'Dupont' }) as never
    );
    expect(response.status).toBe(403);
  });
});

describe('/api/send-message-notification', () => {
  it("refuse une requête non authentifiée (relais d'emails ouvert)", async () => {
    const { POST } = await import('@/app/api/send-message-notification/route');
    const response = await POST(post({ recipientId: AUTRE_ID }));
    expect(response.status).toBe(401);
  });

  it("refuse de s'envoyer une notification à soi-même", async () => {
    authState.user = { id: USER_ID };
    const { POST } = await import('@/app/api/send-message-notification/route');
    const response = await POST(post({ recipientId: USER_ID }));
    expect(response.status).toBe(400);
  });
});

describe('/api/push/send', () => {
  it('refuse une requête non authentifiée', async () => {
    const { POST } = await import('@/app/api/push/send/route');
    const response = await POST(
      post({ userId: AUTRE_ID, title: 'Coucou', body: 'Message' })
    );
    expect(response.status).toBe(401);
  });

  it("refuse d'écrire à un utilisateur sans lien avec l'expéditeur", async () => {
    authState.user = { id: USER_ID };
    tableResults.set('profils', { role: 'secretaire' });
    tableResults.set('messages', null); // aucun échange entre les deux comptes
    const { POST } = await import('@/app/api/push/send/route');
    const response = await POST(
      post({ userId: AUTRE_ID, title: 'Coucou', body: 'Message' })
    );
    expect(response.status).toBe(403);
  });
});

describe('/api/digest', () => {
  it('refuse un appel sans en-tête d\'autorisation', async () => {
    vi.stubEnv('CRON_SECRET', 'secret-de-test');
    const { POST } = await import('@/app/api/digest/route');
    const response = await POST(new Request('http://localhost/api/digest', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('refuse « Bearer undefined » quand CRON_SECRET n\'est pas défini', async () => {
    // `undefined` et non chaîne vide : c'est l'absence de variable qui
    // produisait la chaîne « Bearer undefined » côté serveur.
    vi.stubEnv('CRON_SECRET', undefined);
    const { POST } = await import('@/app/api/digest/route');
    const response = await POST(
      new Request('http://localhost/api/digest', {
        method: 'POST',
        headers: { authorization: 'Bearer undefined' },
      })
    );
    expect(response.status).toBe(401);
  });
});
