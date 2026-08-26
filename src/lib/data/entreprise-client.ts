'use client';

import { createBrowserClient } from '@supabase/ssr';
import { revalidateScope } from '@/lib/actions/cache';

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type ActionError = {
  message: string;
  code?: string;
};

export type EntrepriseDashboardData = {
  profil: { nom: string } | null;
  missions: Mission[];
  stats: { total: number; enAttente: number; enCours: number };
};

export type Mission = {
  id: number;
  titre: string;
  statut: string;
  created_at: string;
  candidatures: Candidature[];
};

export type Candidature = {
  id: number;
  statut: string;
  secretaire_id: string;
  created_at: string;
  secretaire: { id: string; nom: string }[] | { id: string; nom: string } | null;
};

export async function proposerOffreAction(candidatureId: number, secretaireId: string, missionId: number) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: { message: 'Non connecté' } as ActionError };

  const { error: offErr } = await supabase.from('offres').insert({
    entreprise_id: session.user.id,
    secretaire_id: secretaireId,
    mission_id: missionId,
    candidature_id: candidatureId,
    statut: 'en_attente',
  });

  if (offErr) return { error: { message: offErr.message, code: offErr.code } as ActionError };

  const { error: updErr } = await supabase.from('candidatures').update({ statut: 'acceptee' }).eq('id', candidatureId);
  // Le tableau de bord de l'entreprise ET celui de la secrétaire affichent
  // cette candidature : les deux caches doivent expirer.
  if (!updErr) await revalidateScope('candidatures');
  return { error: updErr ? { message: updErr.message, code: updErr.code } as ActionError : null };
}

export async function refuserCandidatureAction(missionId: number, candidatureId: number) {
  const supabase = getSupabase();
  const { error } = await supabase.from('candidatures').update({ statut: 'refusee' }).eq('id', candidatureId);
  if (!error) await revalidateScope('candidatures');
  return { error: error ? { message: error.message, code: error.code } as ActionError : null };
}