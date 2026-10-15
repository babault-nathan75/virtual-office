/**
 * Doublure Supabase partagée par les tests de sécurité.
 *
 * Elle reproduit l'enchaînement PostgREST (`from().select().eq()…`) et
 * ENREGISTRE chaque maillon : les tests peuvent ainsi vérifier non seulement
 * le statut HTTP renvoyé, mais aussi ce qui a été — ou n'a pas été — demandé à
 * la base (un filtre `user_id` présent, aucune mise à jour sur un message
 * d'autrui, aucune requête quand l'accès est refusé…).
 *
 * Le résultat d'une table peut être une valeur fixe ou une fonction qui reçoit
 * les maillons de la requête courante, pour répondre selon le filtre appliqué.
 */
import { vi } from 'vitest';

export type Call = { chain: number; table: string; method: string; args: unknown[] };
export type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};
type Resolver = QueryResult | ((calls: Call[]) => QueryResult);

export type FakeUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

const CHAIN_METHODS = [
  'select', 'eq', 'neq', 'in', 'or', 'and', 'not', 'is', 'ilike', 'like',
  'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range', 'match',
  'insert', 'update', 'upsert', 'delete',
];

let chainCounter = 0;

export const fake = {
  results: new Map<string, Resolver>(),
  calls: [] as Call[],
  /** Utilisateur porté par la session (cookie ou jeton Bearer). */
  sessionUser: null as FakeUser | null,
  signInWithPassword: vi.fn(async (..._args: unknown[]) => ({
    data: { user: null as FakeUser | null, session: null },
    error: { message: 'Invalid login credentials' } as { message: string } | null,
  })),
  deleteUser: vi.fn(async (..._args: unknown[]) => ({ error: null })),

  reset() {
    this.results.clear();
    this.calls.length = 0;
    this.sessionUser = null;
    this.signInWithPassword.mockClear();
    this.deleteUser.mockClear();
  },

  /** Maillons enregistrés pour une table (et éventuellement une méthode). */
  callsOn(table: string, method?: string): Call[] {
    return this.calls.filter(c => c.table === table && (!method || c.method === method));
  },

  /** Tous les maillons d'une même requête. */
  chainOf(call: Call): Call[] {
    return this.calls.filter(c => c.chain === call.chain);
  },
};

function resolve(table: string, chainCalls: Call[]) {
  const entry = fake.results.get(table);
  const value = typeof entry === 'function' ? entry(chainCalls) : entry ?? {};
  return { data: value.data ?? null, error: value.error ?? null, count: value.count ?? 0 };
}

export function from(table: string) {
  const id = ++chainCounter;
  const own = () => fake.calls.filter(c => c.chain === id);
  const chain: Record<string, unknown> = {};

  for (const method of CHAIN_METHODS) {
    chain[method] = (...args: unknown[]) => {
      fake.calls.push({ chain: id, table, method, args });
      return chain;
    };
  }
  chain.maybeSingle = async () => resolve(table, own());
  chain.single = async () => resolve(table, own());
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolve(table, own())).then(onFulfilled, onRejected);

  return chain;
}

export const fakeClient = {
  from,
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getUser: async () => ({
      data: { user: fake.sessionUser },
      error: fake.sessionUser ? null : { message: 'Auth session missing' },
    }),
    exchangeCodeForSession: async () =>
      fake.sessionUser
        ? { data: { user: fake.sessionUser, session: {} }, error: null }
        : { data: { user: null, session: null }, error: { message: 'invalid code' } },
    signInWithPassword: (...args: unknown[]) => fake.signInWithPassword(...args),
    signOut: async () => ({ error: null }),
    admin: { deleteUser: (...args: unknown[]) => fake.deleteUser(...args) },
  },
};

/** Requête JSON prête à passer à un gestionnaire de route. */
export function jsonRequest(
  url: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
): Request {
  return new Request(url, {
    method: init.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  });
}
