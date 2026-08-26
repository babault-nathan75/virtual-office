'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { updateTag } from 'next/cache';

/**
 * Décision sur un dossier d'identité — chemin d'écriture unique.
 *
 * Il en existait trois auparavant, aucun ne prévenant le cache :
 *
 *  1. `admin-client.ts` (boutons du tableau de bord) — écriture directe depuis
 *     le navigateur, aucune invalidation ;
 *  2. la page /dashboard/admin/kyc — écriture directe elle aussi ;
 *  3. `actions/dashboard.ts` — correctement autorisé, mais importé par
 *     personne, et invalidant l'étiquette `admin-kyc` alors que le tableau de
 *     bord est mis en cache sous `admin-dashboard`.
 *
 * Résultat visible : on approuvait un dossier, la page se rechargeait, et le
 * dossier restait affiché « en attente » sur le tableau de bord — pendant que
 * la page KYC, elle, n'en montrait aucun. Deux écrans, deux vérités.
 */

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
}

export type KycDecision = 'approved' | 'rejected';

/**
 * Étiquettes de cache à invalider.
 *
 * `admin-dashboard` est celle sous laquelle `getAdminDashboardData` enregistre
 * son résultat : c'est elle qui manquait. Les autres couvrent les écrans qui
 * dépendent du statut d'un dossier.
 *
 * `updateTag` plutôt que `revalidateTag` : le second marque la donnée comme
 * périmée mais continue de servir l'ancienne pendant qu'il rafraîchit en
 * arrière-plan. C'est précisément ce qu'il ne faut pas ici — l'administrateur
 * vient d'agir et doit voir le résultat de son action, pas l'état d'avant.
 * `updateTag` est réservé aux actions serveur et expire immédiatement.
 *
 * Au passage : la forme `revalidateTag(tag)` à un seul argument est dépréciée
 * dans Next 16. Le code existant la conservait au moyen d'un cast
 * (`revalidateTag as (tag: string) => void`) qui masquait l'avertissement du
 * compilateur au lieu de traiter le changement d'API.
 */
const CACHE_TAGS = ['admin-dashboard', 'admin-kyc', 'secretaire-dashboard'] as const;

export async function decideKyc(params: {
  userId: string;
  decision: KycDecision;
  motif?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  // L'autorisation est vérifiée côté serveur, pas seulement par le fait que
  // le bouton s'affiche : les deux anciens chemins s'appuyaient uniquement sur
  // la RLS, ce qui rendait l'échec silencieux et indistinguable d'un dossier
  // inexistant.
  const { data: profil } = await supabase
    .from('profils')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profil?.role !== 'admin') {
    return { ok: false, error: 'Accès réservé aux administrateurs.' };
  }

  const patch: Record<string, unknown> = {
    statut: params.decision,
    updated_at: new Date().toISOString(),
  };
  if (params.decision === 'rejected') {
    patch.motif_rejet = params.motif?.trim() || null;
  } else {
    patch.motif_rejet = null;
  }

  const { data, error } = await supabase
    .from('kyc_verifications')
    .update(patch)
    .eq('user_id', params.userId)
    .select('id');

  if (error) {
    console.error('[adminKyc] mise à jour :', error.message);
    return { ok: false, error: error.message };
  }

  // `update` sans correspondance ne lève pas d'erreur : sans ce contrôle, une
  // ligne masquée par la RLS produirait un « succès » qui ne change rien.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Aucun dossier modifié. Il a peut-être déjà été traité, ou n'est pas visible avec vos droits.",
    };
  }

  for (const tag of CACHE_TAGS) {
    updateTag(tag);
  }

  return { ok: true };
}
