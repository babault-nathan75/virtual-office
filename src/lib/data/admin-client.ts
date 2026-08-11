'use client';

import { createBrowserClient } from '@supabase/ssr';

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

export async function approveKycAction(userId: string) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('kyc_verifications').update({ statut: 'approved', updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (!error && user) {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_kyc_approve',
      details: JSON.stringify({ target_user_id: userId }),
      created_at: new Date().toISOString(),
    });
  }
  return { error };
}

export async function rejectKycAction(userId: string) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('kyc_verifications').update({ statut: 'rejected', updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (!error && user) {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_kyc_reject',
      details: JSON.stringify({ target_user_id: userId }),
      created_at: new Date().toISOString(),
    });
  }
  return { error };
}