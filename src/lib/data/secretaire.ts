import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';

const revalidate = revalidateTag as (tag: string) => void;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getSecretaireDashboardData(userId: string) {
  return getSecretaireDashboardDataCached(userId);
}

const getSecretaireDashboardDataCached = unstable_cache(
  async (userId: string) => {
    const supabase = getSupabaseAdmin();

    const [
      { data: profil },
      { data: missions },
      { data: candidatures },
      { data: profilSecretaire },
      { data: kyc },
      { data: twoFactor },
      { data: offres }
    ] = await Promise.all([
      supabase.from('profils').select('nom').eq('id', userId).maybeSingle(),
      supabase
        .from('missions')
        .select(`
          id, titre, description, date_debut, created_at,
          entreprise:profils!missions_entreprise_id_fkey ( id, nom )
        `)
        .eq('statut', 'ouverte')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('candidatures')
        .select(`
          id, mission_id, statut, created_at,
          mission:missions!candidatures_mission_id_fkey ( id, titre )
        `)
        .eq('secretaire_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profils_secretaires')
        .select('photo_url, bio, ville, disponibilite, niveau_etudes, specialite, langues, outils, soft_skills, competences, annees_experience')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('kyc_verifications').select('statut').eq('user_id', userId).maybeSingle(),
      supabase.from('two_factor_auth').select('enabled').eq('user_id', userId).maybeSingle(),
      supabase
        .from('offres')
        .select(`
          id, statut, message, created_at, entreprise_id, mission_id,
          entreprise:profils!offres_entreprise_id_fkey ( id, nom ),
          mission:missions!offres_mission_id_fkey ( id, titre )
        `)
        .eq('secretaire_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    return {
      profil,
      missions: missions ?? [],
      candidatures: candidatures ?? [],
      profilSecretaire,
      kycApproved: kyc?.statut === 'approved',
      twoFactorEnabled: twoFactor?.enabled === true,
      offres: offres ?? []
    };
  },
  ['secretaire-dashboard'],
  { revalidate: 30, tags: ['secretaire-dashboard'] }
);

export async function getEntrepriseDashboardData(userId: string) {
  return getEntrepriseDashboardDataCached(userId);
}

const getEntrepriseDashboardDataCached = unstable_cache(
  async (userId: string) => {
    const supabase = getSupabaseAdmin();

    const [
      { data: profil },
      { data: missions }
    ] = await Promise.all([
      supabase.from('profils').select('nom').eq('id', userId).maybeSingle(),
      supabase
        .from('missions')
        .select(`
          id, titre, statut, created_at,
          candidatures (
            id, statut, secretaire_id, created_at,
            secretaire:profils!candidatures_secretaire_id_fkey ( id, nom )
          )
        `)
        .eq('entreprise_id', userId)
        .order('created_at', { ascending: false })
        .limit(15)
    ]);

    const missionsData = missions ?? [];
    const total = missionsData.length;
    const enAttente = missionsData.reduce(
      (acc, m) => acc + (m.candidatures?.filter(c => c.statut === 'en_attente').length ?? 0),
      0
    );
    const enCours = missionsData.filter(m => m.statut === 'en_cours').length;

    return {
      profil,
      missions: missionsData,
      stats: { total, enAttente, enCours }
    };
  },
  ['entreprise-dashboard'],
  { revalidate: 30, tags: ['entreprise-dashboard'] }
);

export function revalidateSecretaireDashboard() {
  revalidate('secretaire-dashboard');
}

export function revalidateEntrepriseDashboard() {
  revalidate('entreprise-dashboard');
}

export function computeProfileCompletion(
  profil: Record<string, unknown> | null,
  kycApproved: boolean,
  twoFactorEnabled: boolean
): number {
  const SCORE_WEIGHTS = {
    photo_url: 10, competences: 10, outils: 10, annees_experience: 10, specialite: 12,
    bio: 7, soft_skills: 7, niveau_etudes: 5, ville: 5, langues: 6,
    disponibilite: 6, kyc: 12, twoFactor: 10
  };

  let score = 0;
  if (!profil) return (kycApproved ? SCORE_WEIGHTS.kyc : 0) + (twoFactorEnabled ? SCORE_WEIGHTS.twoFactor : 0);

  if (profil.photo_url) score += SCORE_WEIGHTS.photo_url;
  if (Array.isArray(profil.competences) && profil.competences.length > 0) score += SCORE_WEIGHTS.competences;
  if (Array.isArray(profil.outils) && profil.outils.length > 0) score += SCORE_WEIGHTS.outils;
  if (typeof profil.annees_experience === 'number' && profil.annees_experience > 0) score += SCORE_WEIGHTS.annees_experience;
  if (typeof profil.specialite === 'string' && profil.specialite.length > 0) score += SCORE_WEIGHTS.specialite;
  if (typeof profil.bio === 'string' && profil.bio.trim().length >= 20) score += SCORE_WEIGHTS.bio;
  if (Array.isArray(profil.soft_skills) && profil.soft_skills.length > 0) score += SCORE_WEIGHTS.soft_skills;
  if (profil.niveau_etudes) score += SCORE_WEIGHTS.niveau_etudes;
  if (profil.ville) score += SCORE_WEIGHTS.ville;
  if (Array.isArray(profil.langues) && profil.langues.length > 0) score += SCORE_WEIGHTS.langues;
  if (profil.disponibilite) score += SCORE_WEIGHTS.disponibilite;
  if (kycApproved) score += SCORE_WEIGHTS.kyc;
  if (twoFactorEnabled) score += SCORE_WEIGHTS.twoFactor;

  return Math.min(score, 100);
}