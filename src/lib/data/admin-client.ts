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
  const { error } = await supabase.from('profils').update({ role }).eq('id', userId);
  return { error };
}

export async function approveKycAction(userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('kyc_verifications').update({ statut: 'approved', updated_at: new Date().toISOString() }).eq('user_id', userId);
  return { error };
}

export async function rejectKycAction(userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('kyc_verifications').update({ statut: 'rejected', updated_at: new Date().toISOString() }).eq('user_id', userId);
  return { error };
}