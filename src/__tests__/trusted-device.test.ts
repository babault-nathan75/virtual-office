/**
 * Tests des appareils de confiance.
 *
 * Ce mécanisme dispense du second facteur : chacune de ses conditions est donc
 * une condition de sécurité. Deux en particulier peuvent échouer sans que rien
 * ne le signale — le liage de l'empreinte à l'utilisateur (sans lui, un
 * navigateur partagé dispenserait le second occupant) et l'expiration (sans
 * elle, la dispense serait définitive).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.AUTH_SECRET = 'secret-de-test-suffisamment-long-pour-passer-32';

type Row = Record<string, unknown>;
const rows: Row[] = [];
const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
  }),
}));

function makeChain() {
  let scope = [...rows];
  const chain: Record<string, unknown> = {};

  chain.select = () => chain;
  chain.eq = (column: string, value: unknown) => {
    scope = scope.filter(r => r[column] === value);
    return chain;
  };
  chain.gt = (column: string, value: string) => {
    scope = scope.filter(r => String(r[column]) > value);
    return chain;
  };
  chain.order = () => chain;
  chain.maybeSingle = async () => ({ data: scope[0] ?? null, error: null });
  chain.update = (patch: Row) => {
    const updater: Record<string, unknown> = {};
    updater.eq = (column: string, value: unknown) => {
      rows.filter(r => r[column] === value).forEach(r => Object.assign(r, patch));
      return Promise.resolve({ data: null, error: null });
    };
    return updater;
  };
  chain.upsert = async (row: Row) => {
    const existing = rows.find(
      r => r.user_id === row.user_id && r.device_hash === row.device_hash
    );
    if (existing) Object.assign(existing, row);
    else rows.push({ id: `dev-${rows.length}`, ...row });
    return { data: null, error: null };
  };
  chain.delete = () => {
    const deleter: Record<string, unknown> = {};
    deleter.eq = (column: string, value: unknown) => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i][column] === value) rows.splice(i, 1);
      }
      return Promise.resolve({ data: null, error: null });
    };
    return deleter;
  };
  return chain;
}

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({ from: () => makeChain() }),
}));

const {
  isDeviceTrusted,
  trustCurrentDevice,
  revokeAllDevices,
  describeDevice,
  readDeviceId,
  getOrCreateDeviceId,
  DEVICE_COOKIE,
  TRUST_DURATION_DAYS,
} = await import('@/lib/trustedDevice');

beforeEach(() => {
  rows.length = 0;
  cookieStore.clear();
});

describe('identifiant d\'appareil', () => {
  it('est absent tant que rien n\'a été mémorisé', async () => {
    expect(await readDeviceId()).toBeNull();
  });

  it('est créé une seule fois puis réutilisé', async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(first).toBe(second);
    expect(cookieStore.get(DEVICE_COOKIE)).toBe(first);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });

  it('remplace une valeur de cookie falsifiée', async () => {
    cookieStore.set(DEVICE_COOKIE, 'court');
    const id = await getOrCreateDeviceId();
    expect(id).not.toBe('court');
  });
});

describe('isDeviceTrusted', () => {
  it('refuse quand aucun appareil n\'est mémorisé', async () => {
    expect(await isDeviceTrusted({ userId: 'u1', role: 'entreprise' })).toBe(false);
  });

  it('accepte l\'appareil qui vient d\'être mémorisé', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' });
    expect(await isDeviceTrusted({ userId: 'u1', role: 'entreprise' })).toBe(true);
  });

  /*
   * Le cœur du mécanisme. L'empreinte stockée est un HMAC de
   * (identifiant d'appareil + identifiant d'utilisateur). Sans ce liage, un
   * ordinateur familial mémorisé par le premier compte dispenserait le second
   * du code de vérification — une faille invisible, qui ne se manifesterait
   * que chez les utilisateurs partageant une machine.
   */
  it('ne transfère pas la confiance à un autre compte sur le même navigateur', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });

    expect(await isDeviceTrusted({ userId: 'u1', role: 'entreprise' })).toBe(true);
    expect(await isDeviceTrusted({ userId: 'u2', role: 'entreprise' })).toBe(false);
  });

  it('refuse un appareil expiré', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });
    rows[0].expires_at = new Date(Date.now() - 1000).toISOString();

    expect(await isDeviceTrusted({ userId: 'u1', role: 'entreprise' })).toBe(false);
  });

  it('n\'accorde jamais la dispense à un administrateur', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });
    expect(await isDeviceTrusted({ userId: 'u1', role: 'admin' })).toBe(false);
  });

  /*
   * L'expiration est fixe, pas glissante : « tous les 30 jours » n'aurait
   * aucun sens si chaque connexion repoussait l'échéance — un utilisateur
   * quotidien ne reverrait jamais de code.
   */
  it('ne prolonge pas l\'expiration à l\'usage', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });
    const initialExpiry = rows[0].expires_at;

    await isDeviceTrusted({ userId: 'u1', role: 'entreprise' });

    expect(rows[0].expires_at).toBe(initialExpiry);
    expect(rows[0].last_used_at).toBeDefined();
  });

  it('mémorise pour la durée annoncée', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });
    const days = (new Date(String(rows[0].expires_at)).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(TRUST_DURATION_DAYS);
  });
});

describe('revokeAllDevices', () => {
  it('retire la dispense de tous les appareils du compte, et d\'eux seuls', async () => {
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Chrome' });
    cookieStore.clear();
    await trustCurrentDevice({ userId: 'u1', userAgent: 'Safari' });
    cookieStore.clear();
    await trustCurrentDevice({ userId: 'u2', userAgent: 'Firefox' });

    expect(rows).toHaveLength(3);
    await revokeAllDevices('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('u2');
  });
});

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Chrome sur Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1 Version/17.0 Safari/604.1', 'Safari sur iOS'],
    ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Chrome sur Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Gecko/20100101 Firefox/121.0', 'Firefox sur macOS'],
  ])('%s → %s', (agent, expected) => {
    expect(describeDevice(agent)).toBe(expected);
  });

  it('reste lisible sans agent utilisateur', () => {
    expect(describeDevice(null)).toBe('Appareil inconnu');
  });
});
