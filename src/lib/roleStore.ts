'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isRole, roleHomePath, type Role } from '@/lib/roles';

// Réexportés pour ne pas casser les imports existants ; la définition vit
// désormais dans `@/lib/roles`, utilisable aussi depuis le serveur.
export { isRole, type Role };

const ROLE_KEY = 'sp:cached-role';

/**
 * Le cache est indexé par identifiant utilisateur : sans cela, une seconde
 * connexion sur le même navigateur (changement de compte sans déconnexion
 * explicite) réutilisait le rôle du compte précédent et redirigeait vers le
 * mauvais tableau de bord.
 */
export function getCachedRole(userId?: string): Role | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; role?: string };
    if (!isRole(parsed.role)) return null;
    if (userId && parsed.userId !== userId) return null;
    return parsed.role;
  } catch {
    return null;
  }
}

export function setCachedRole(role: Role, userId?: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROLE_KEY, JSON.stringify({ role, userId }));
  } catch {
    /* stockage indisponible : ignoré */
  }
}

export function clearCachedRole() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch {
    /* stockage indisponible : ignoré */
  }
}

export function roleHome(role: Role): string {
  return roleHomePath(role);
}

export function useRole(): Role | null {
  // Volontairement initialisé à null, pas depuis localStorage : lire le cache
  // au premier rendu produit un rendu client différent du rendu serveur
  // (erreur d'hydratation).
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let mounted = true;

    const updateFromSession = async (uid: string | null) => {
      if (!uid) {
        clearCachedRole();
        if (mounted) setRole(null);
        return;
      }

      const cached = getCachedRole(uid);
      if (cached) {
        if (mounted) setRole(cached);
        return;
      }

      const { data } = await supabase
        .from('profils')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (!mounted) return;

      if (isRole(data?.role)) {
        setCachedRole(data.role, uid);
        setRole(data.role);
      } else {
        setRole(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void updateFromSession(session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateFromSession(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return role;
}
