/**
 * Tests des primitives d'authentification ajoutées avec l'OTP et Turnstile.
 *
 * Chaque cas correspond à une propriété de sécurité qu'un refactoring pourrait
 * casser en silence : le code doit être haché avant stockage, lié au couple
 * (email, usage), non rejouable, borné en tentatives et en durée ; le cookie
 * de défi doit être infalsifiable ; l'anti-robot doit refuser plutôt que
 * s'ouvrir quand Cloudflare répond « non ».
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

process.env.AUTH_SECRET = 'secret-de-test-suffisamment-long-pour-passer-32';

// --- Doublure de la base -----------------------------------------------------
// `otp.ts` n'utilise qu'un sous-ensemble étroit de PostgREST : insert, et une
// chaîne select/eq/is/order/limit/maybeSingle. La doublure reproduit ce
// sous-ensemble sur un tableau en mémoire.
type Row = Record<string, unknown>;
const rows: Row[] = [];

function makeChain(table: string) {
  let filtered = [...rows];
  const chain: Record<string, unknown> = {};

  chain.select = () => chain;
  chain.eq = (column: string, value: unknown) => {
    filtered = filtered.filter(r => r[column] === value);
    return chain;
  };
  chain.is = (column: string, value: unknown) => {
    filtered = filtered.filter(r => (r[column] ?? null) === value);
    return chain;
  };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = async () => ({ data: filtered[filtered.length - 1] ?? null, error: null });
  chain.insert = async (row: Row) => {
    // `created_at` est renseigné par PostgreSQL en production ; la doublure
    // doit le fournir, sinon le calcul du délai anti-renvoi n'a rien à lire.
    rows.push({
      id: `row-${rows.length}`,
      attempts: 0,
      consumed_at: null,
      created_at: new Date().toISOString(),
      ...row,
    });
    return { data: null, error: null };
  };
  // `update()` renvoie une chaîne qui accumule les filtres et n'applique le
  // patch qu'au moment où elle est attendue (`then`), comme le fait PostgREST.
  chain.update = (patch: Row) => {
    let scope = [...rows];
    const updater: Record<string, unknown> = {};
    updater.eq = (column: string, value: unknown) => {
      scope = scope.filter(r => r[column] === value);
      return updater;
    };
    updater.is = (column: string, value: unknown) => {
      scope = scope.filter(r => (r[column] ?? null) === value);
      return updater;
    };
    updater.then = (resolve: (value: unknown) => unknown) => {
      scope.forEach(r => Object.assign(r, patch));
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    return updater;
  };
  void table;
  return chain;
}

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => makeChain(table) }),
}));

const { issueOtp, verifyOtp, normalizeEmail, OTP_MAX_ATTEMPTS } = await import('@/lib/otp');
const { serializeChallenge, parseChallenge } = await import('@/lib/authChallenge');

beforeEach(() => {
  rows.length = 0;
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeEmail', () => {
  // Sans normalisation, « Alice@Example.com » et « alice@example.com »
  // produisent deux empreintes différentes : le code envoyé à l'une ne valide
  // jamais l'autre, et les quotas se contournent par un changement de casse.
  it('met en minuscules et retire les espaces', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });
});

describe('issueOtp', () => {
  it('ne stocke jamais le code en clair', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(issued.code);
    expect(rows[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('génère un code à 6 chiffres', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'signup' });
    if (!issued.ok) throw new Error('émission refusée');
    expect(issued.code).toMatch(/^\d{6}$/);
  });

  it('refuse un second envoi immédiat (délai anti-renvoi)', async () => {
    await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    const second = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('verifyOtp', () => {
  it('accepte le bon code', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login', userId: 'u1' });
    if (!issued.ok) throw new Error('émission refusée');

    const result = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    expect(result.ok).toBe(true);
  });

  it('accepte le bon code quelle que soit la casse de l\'email', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    if (!issued.ok) throw new Error('émission refusée');

    const result = await verifyOtp({ email: 'A@B.FR', purpose: 'login', code: issued.code });
    expect(result.ok).toBe(true);
  });

  // Le liage au couple (email, purpose) empêche de présenter à la connexion un
  // code obtenu sur le formulaire d'inscription.
  it('refuse un code émis pour un autre usage', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'signup' });
    if (!issued.ok) throw new Error('émission refusée');

    const result = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    expect(result.ok).toBe(false);
  });

  it('refuse un code déjà consommé (pas de rejeu)', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    if (!issued.ok) throw new Error('émission refusée');

    await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    const replay = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe('not_found');
  });

  it('bloque après le nombre maximal de tentatives', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    if (!issued.ok) throw new Error('émission refusée');
    const wrong = issued.code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      const result = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: wrong });
      expect(result.ok).toBe(false);
    }

    // Même le bon code ne passe plus : le quota protège contre la force brute
    // sur 10^6 possibilités.
    const afterLockout = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    expect(afterLockout.ok).toBe(false);
  });

  it('refuse un code expiré', async () => {
    const issued = await issueOtp({ email: 'a@b.fr', purpose: 'login' });
    if (!issued.ok) throw new Error('émission refusée');

    rows[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const result = await verifyOtp({ email: 'a@b.fr', purpose: 'login', code: issued.code });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });
});

describe('cookie de défi de connexion', () => {
  const base = { uid: 'u1', email: 'a@b.fr', purpose: 'login' as const, method: 'email' as const };

  it('relit ce qu\'il a écrit', () => {
    const parsed = parseChallenge(serializeChallenge(base));
    expect(parsed?.uid).toBe('u1');
    expect(parsed?.method).toBe('email');
  });

  /*
   * C'est la propriété centrale : le cookie porte « le mot de passe de cet
   * utilisateur a été validé ». S'il était falsifiable, n'importe qui pourrait
   * fabriquer un défi pour l'identifiant d'un tiers, puis se faire délivrer une
   * session en fournissant un code envoyé à sa propre adresse.
   */
  it('rejette une charge utile modifiée', () => {
    const token = serializeChallenge(base);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...base, uid: 'admin', exp: Date.now() + 60_000 })
    ).toString('base64url');

    expect(parseChallenge(`${forged}.${signature}`)).toBeNull();
    expect(parseChallenge(`${payload}.${signature}xx`)).toBeNull();
    expect(parseChallenge('nimportequoi')).toBeNull();
    expect(parseChallenge(undefined)).toBeNull();
  });

  it('rejette un défi expiré', () => {
    vi.useFakeTimers();
    const token = serializeChallenge(base);
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(parseChallenge(token)).toBeNull();
  });
});
