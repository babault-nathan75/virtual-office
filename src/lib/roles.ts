/**
 * Helpers de rôle utilisables partout.
 *
 * `roleStore.ts` est marqué « use client » : l'importer depuis une route
 * serveur pour la seule fonction `roleHome` faisait entrer tout le module —
 * et donc le client Supabase navigateur — dans le bundle serveur. Ces
 * fonctions pures vivent donc à part, et `roleStore` les réexporte.
 */

export type Role = 'entreprise' | 'secretaire' | 'admin';

export function isRole(value: unknown): value is Role {
  return value === 'entreprise' || value === 'secretaire' || value === 'admin';
}

export function roleHomePath(role: string | null | undefined): string {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'secretaire') return '/dashboard/secretaire';
  if (role === 'entreprise') return '/dashboard/entreprise';
  return '/dashboard';
}
