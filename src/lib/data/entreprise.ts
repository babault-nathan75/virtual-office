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

export async function getSecretaireProfileDetails(secretaireId: string) {
  return getSecretaireProfileDetailsCached(secretaireId);
}

const getSecretaireProfileDetailsCached = unstable_cache(
  async (secretaireId: string) => {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('profils_secretaires')
      .select('photo_url, bio, ville, disponibilite, niveau_etudes, langues, outils, soft_skills, competences, annees_experience')
      .eq('id', secretaireId)
      .maybeSingle();
    return data;
  },
  ['secretaire-profile'],
  { revalidate: 60 * 60, tags: ['secretaire-profile'] }
);

export function revalidateEntrepriseDashboard() {
  revalidate('entreprise-dashboard');
}