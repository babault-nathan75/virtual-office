'use client';

import { createBrowserClient } from '@supabase/ssr';
import { revalidateScope } from '@/lib/actions/cache';

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type AdminDashboardData = {
  profil: { nom: string } | null;
  totalMessages: number;
  messagesLast7d: number;
  avgResponseTime: string;
  topSenders: { nom: string; count: number }[];
  activity: { date: string; count: number }[];
  kycPending: { user_id: string; created_at: string; nom: string }[];
  newMissions: { id: number; titre: string; created_at: string; entreprise_id: string; entreprise_nom: string }[];
  stats: {
    totalOffresConcluees: number;
    totalEntreprises: number;
    totalSecretaires: number;
  };
};

export async function updateUserRoleAction(userId: string, role: string) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profils').update({ role }).eq('id', userId);
  if (!error) await revalidateScope('admin-users');
  if (!error && user) {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_change_role',
      details: JSON.stringify({ target_user_id: userId, new_role: role }),
      created_at: new Date().toISOString(),
    });
  }
  return { error };
}

/*
 * `approveKycAction` et `rejectKycAction` ont été retirés d'ici.
 *
 * Ils écrivaient depuis le navigateur, sans invalider le cache serveur du
 * tableau de bord : un dossier approuvé continuait d'y apparaître « en
 * attente ». La décision passe désormais par `@/lib/actions/adminKyc`, qui
 * vérifie l'autorisation côté serveur et invalide les étiquettes de cache.
 */
