'use client';

import { createBrowserClient } from '@supabase/ssr';
import { revalidateScope } from '@/lib/actions/cache';

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type SecretaireDashboardData = {
  profil: { nom: string } | null;
  missions: Mission[];
  candidatures: Candidature[];
  profilSecretaire: SecretaireProfil | null;
  kycApproved: boolean;
  twoFactorEnabled: boolean;
  offres: Offre[];
};

export type SecretaireProfil = {
  photo_url: string | null;
  bio: string | null;
  ville: string | null;
  disponibilite: string | null;
  niveau_etudes: string | null;
  specialite: string | null;
  langues: string[] | null;
  outils: string[] | null;
  soft_skills: string[] | null;
  competences: string[];
  annees_experience: number;
} | null;

export type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut: string;
  created_at: string;
  entreprise: { id: string; nom: string }[] | { id: string; nom: string } | null;
  candidatures?: Candidature[];
};

export type Candidature = {
  id: number;
  mission_id: number;
  statut: string;
  created_at?: string;
  secretaire_id?: string;
  mission?: { id: number; titre: string };
};

export type Offre = {
  id: number;
  statut: string;
  message: string | null;
  created_at: string;
  entreprise_id: string;
  mission_id: number | null;
  entreprise: { id: string; nom: string }[] | { id: string; nom: string } | null;
  mission: { id: number; titre: string } | null;
};

export type ActionError = {
  message: string;
  code?: string;
};

export async function postulerAction(userId: string, missionId: number) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('candidatures')
    .insert([{ mission_id: missionId, secretaire_id: userId, statut: 'en_attente' }]);

  if (!error) await revalidateScope('candidatures');
  return { error: error ? { message: error.message, code: error.code } as ActionError : null };
}

export async function updateProfilAction(userId: string, data: Partial<SecretaireProfil>) {
  const supabase = getSupabase();
  const { error } = await supabase.from('profils_secretaires').upsert({ id: userId, ...data });
  // La fiche est aussi lue par la recherche côté entreprise, avec son propre
  // cache d'une heure : sans invalidation, une modification de profil restait
  // invisible pendant tout ce temps.
  if (!error) await revalidateScope('profil-secretaire');
  return { error: error ? { message: error.message, code: error.code } as ActionError : null };
}