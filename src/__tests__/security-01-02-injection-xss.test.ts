/**
 * Menaces 1 (injection SQL / PostgREST) et 2 (XSS).
 *
 * Supabase paramètre les valeurs passées à `.eq()`, `.ilike()`… : le risque
 * réel est l'injection dans les chaînes de FILTRE construites à la main
 * (`.or(\`sender_id.eq.${id}…\`)`). Ces tests vérifient qu'aucune valeur non
 * validée n'y parvient. Pour le XSS : échappement de toute sortie HTML générée
 * côté serveur (export, contrat, emails) et CSP stricte.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fake, jsonRequest } from './helpers/fakeSupabase';

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(async (_mail: { html: string }) => undefined) }));

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
vi.mock('@/lib/mailer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/mailer')>()),
  sendMail: mocks.sendMail,
}));

import { escapeHtml, sanitizeHtml, sanitizeInput, escapeLikePattern, stripHtml } from '@/lib/sanitize';
import { buildCsp } from '@/lib/csp';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Charges utiles classiques d'injection de filtre PostgREST / SQL. */
const FILTER_INJECTIONS = [
  `${OTHER}),or(id.neq.0`,
  `${OTHER},receiver_id.neq.00000000-0000-0000-0000-000000000000`,
  "' OR '1'='1",
  '1; DROP TABLE messages;--',
  `${OTHER}'--`,
];

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '"><iframe src=javascript:alert(1)>',
  "'-alert(1)-'",
];

beforeEach(() => {
  fake.reset();
  mocks.sendMail.mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemple.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
});

// ---------------------------------------------------------------------------
describe('1. Injection SQL / filtre PostgREST', () => {
  it.each(FILTER_INJECTIONS)('/api/messages/search refuse un identifiant injecté : %s', async payload => {
    fake.sessionUser = { id: ME };
    const { GET } = await import('@/app/api/messages/search/route');
    const url = `http://localhost/api/messages/search?userId=${ME}&otherId=${encodeURIComponent(payload)}&q=test`;
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
    expect(fake.callsOn('messages')).toHaveLength(0);
  });

  it.each(FILTER_INJECTIONS)('/api/messages/export refuse un identifiant injecté : %s', async payload => {
    fake.sessionUser = { id: ME };
    const { POST } = await import('@/app/api/messages/export/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/export', { userId: ME, otherId: payload }));

    expect(response.status).toBe(400);
    expect(fake.callsOn('messages')).toHaveLength(0);
  });

  it('la recherche passe le texte libre en valeur paramétrée, jamais dans le filtre .or()', async () => {
    fake.sessionUser = { id: ME };
    const { GET } = await import('@/app/api/messages/search/route');
    const q = "50%_off'),or(id.neq.0";
    const url = `http://localhost/api/messages/search?userId=${ME}&otherId=${OTHER}&q=${encodeURIComponent(q)}`;
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);

    const [orCall] = fake.callsOn('messages', 'or');
    const filter = String(orCall.args[0]);
    const ids = filter.match(/eq\.([^,)]+)/g)!.map(s => s.slice(3));
    expect(ids.every(id => UUID.test(id))).toBe(true);
    expect(filter).not.toContain('neq');

    // Les jokers LIKE sont échappés : « % » et « _ » ne joueront pas.
    const [ilikeCall] = fake.callsOn('messages', 'ilike');
    expect(ilikeCall.args[1]).toBe("%50\\%\\_off'),or(id.neq.0%");
  });

  it("/api/messages/read n'accepte que des UUID", async () => {
    fake.sessionUser = { id: ME };
    const { POST } = await import('@/app/api/messages/read/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/read', { messageIds: ["1' OR '1'='1"] }));
    expect(response.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it('escapeLikePattern retire les caractères qui cassent un filtre PostgREST', () => {
    expect(escapeLikePattern('a%b_c,d(e)f.g*h\\i')).toBe('abcdefghi');
    expect(escapeLikePattern('nom),or(role.eq.admin')).not.toMatch(/[(),.]/);
  });
});

// ---------------------------------------------------------------------------
describe('2. XSS', () => {
  it.each(XSS_PAYLOADS)('escapeHtml / sanitizeInput neutralisent : %s', payload => {
    for (const out of [escapeHtml(payload), sanitizeInput(payload)]) {
      expect(out).not.toMatch(/[<>"']/);
    }
  });

  it.each(XSS_PAYLOADS)('sanitizeHtml (DOMPurify) ne laisse aucune balise : %s', payload => {
    expect(sanitizeHtml(payload)).not.toMatch(/<\s*[a-z]/i);
  });

  it('stripHtml ne renvoie que du texte', () => {
    expect(stripHtml('<b>Bonjour</b><script>alert(1)</script>')).not.toContain('<');
  });

  it("l'export HTML d'une discussion échappe le contenu et les noms", async () => {
    fake.sessionUser = { id: ME };
    fake.results.set('messages', {
      data: [{ id: 'm1', sender_id: OTHER, receiver_id: ME, content: XSS_PAYLOADS[0], created_at: '2026-10-01T10:00:00Z', read_at: null }],
    });
    fake.results.set('profils', { data: [{ id: OTHER, nom: XSS_PAYLOADS[1] }, { id: ME, nom: 'Moi' }] });

    const { POST } = await import('@/app/api/messages/export/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/export', { userId: ME, otherId: OTHER, format: 'pdf' }));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it("l'export CSV neutralise les formules de tableur (injection CSV)", async () => {
    fake.sessionUser = { id: ME };
    const contents = ['=HYPERLINK("https://evil.example","clic")', '+1+cmd|calc', '@SUM(A1)', '-2+3', 'texte normal'];
    fake.results.set('messages', {
      data: contents.map((content, i) => ({
        id: `m${i}`, sender_id: OTHER, receiver_id: ME, content, created_at: '2026-10-01T10:00:00Z', read_at: null,
      })),
    });
    fake.results.set('profils', { data: [] });

    const { POST } = await import('@/app/api/messages/export/route');
    const response = await POST(jsonRequest('http://localhost/api/messages/export', { userId: ME, otherId: OTHER, format: 'csv' }));
    const csv = await response.text();
    const cells = csv.split('\n').slice(1).map(line => line.match(/,"((?:[^"]|"")*)",/)![1]);

    expect(cells.slice(0, 4).every(cell => cell.startsWith("'"))).toBe(true);
    expect(cells[4]).toBe('texte normal');
  });

  it('le contrat généré échappe toutes les données saisies', async () => {
    fake.sessionUser = { id: ME };
    const { POST } = await import('@/app/api/contracts/generate/route');
    const response = await POST(jsonRequest('http://localhost/api/contracts/generate', {
      entrepriseNom: XSS_PAYLOADS[0],
      secretaireNom: XSS_PAYLOADS[1],
      missionTitre: XSS_PAYLOADS[2],
      missionDescription: XSS_PAYLOADS[3],
      dateDebut: '2026-11-01',
      dateFin: '2026-12-01',
      tarif: XSS_PAYLOADS[4],
      conditions: '</p><script>alert(document.cookie)</script>',
    }));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toMatch(/<script>|<img |<svg|<iframe/i);
  });

  it("l'email groupé échappe le nom du destinataire inséré dans {{nom}}", async () => {
    fake.sessionUser = { id: ME };
    fake.results.set('profils', calls =>
      calls.some(c => c.method === 'select' && c.args[0] === 'role')
        ? { data: { role: 'admin' } }
        : { data: [{ id: OTHER, email: 'cible@example.com', nom: '<a href="https://evil.example">Mettre à jour</a>' }] }
    );

    const { POST } = await import('@/app/api/admin/bulk-email/route');
    const response = await POST(jsonRequest(
      'http://localhost/api/admin/bulk-email',
      { subject: 'Info', html: '<p>Bonjour {{nom}}</p>' },
      { headers: { authorization: 'Bearer jeton' } }
    ) as never);

    expect(response.status).toBe(200);
    const sentHtml = mocks.sendMail.mock.calls[0][0].html;
    expect(sentHtml).not.toContain('<a href="https://evil.example"');
    expect(sentHtml).toContain('&lt;a href=');
  });

  it('la CSP à nonce interdit tout script en ligne non signé', () => {
    const csp = buildCsp({ nonce: 'abc123', supabaseUrl: 'https://exemple.supabase.co' });
    const scriptSrc = csp.split('; ').find(d => d.startsWith('script-src'))!;

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
