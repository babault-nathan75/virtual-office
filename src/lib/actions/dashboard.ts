import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';

const revalidate = revalidateTag as (tag: string) => void;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return cookieStore.getAll(); } },
    }
  );
}

export async function proposerOffre(candidatureId: number, secretaireId: string, missionId: number) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { error: offErr } = await supabase.from('offres').insert({
    entreprise_id: session.user.id,
    secretaire_id: secretaireId,
    mission_id: missionId,
    candidature_id: candidatureId,
    statut: 'en_attente',
  });

  if (offErr) {
    if (offErr.code === '23505') throw new Error('Une offre est déjà en attente pour cette secrétaire.');
    throw new Error(offErr.message);
  }

  const { error: candErr } = await supabase
    .from('candidatures')
    .update({ statut: 'acceptee' })
    .eq('id', candidatureId);

  if (candErr) throw new Error(candErr.message);

  revalidate('entreprise-dashboard');
  return { success: true };
}

export async function refuserCandidature(missionId: number, candidatureId: number) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { error } = await supabase
    .from('candidatures')
    .update({ statut: 'refusee' })
    .eq('id', candidatureId);

  if (error) throw new Error(error.message);

  revalidate('entreprise-dashboard');
  return { success: true };
}

export async function postulerMission(missionId: number) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { error } = await supabase.from('candidatures').insert([{
    mission_id: missionId,
    secretaire_id: session.user.id,
    statut: 'en_attente'
  }]);

  if (error) {
    if (error.code === '23505') throw new Error('Vous avez déjà postulé à cette mission.');
    throw new Error(error.message);
  }

  revalidate('secretaire-dashboard');
  return { success: true };
}

export async function updateMissionStatut(missionId: number, statut: string) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { error } = await supabase
    .from('missions')
    .update({ statut })
    .eq('id', missionId)
    .eq('entreprise_id', session.user.id);

  if (error) throw new Error(error.message);

  revalidate('entreprise-dashboard');
  revalidate('secretaire-dashboard');
  return { success: true };
}

export async function updateOffreStatut(offreId: number, statut: string) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { error } = await supabase
    .from('offres')
    .update({ statut })
    .eq('id', offreId)
    .eq('entreprise_id', session.user.id);

  if (error) throw new Error(error.message);

  revalidate('entreprise-dashboard');
  revalidate('secretaire-dashboard');
  return { success: true };
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { data: myProfil } = await supabase
    .from('profils')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (myProfil?.role !== 'admin') throw new Error('Non autorisé');

  const { error } = await supabase
    .from('profils')
    .update({ role })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  revalidate('admin-users');
  return { success: true };
}

export async function approveKyc(userId: string) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { data: myProfil } = await supabase
    .from('profils')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (myProfil?.role !== 'admin') throw new Error('Non autorisé');

  const { error } = await supabase
    .from('kyc_verifications')
    .update({ statut: 'approved', updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  revalidate('admin-kyc');
  revalidate('secretaire-dashboard');
  return { success: true };
}

export async function rejectKyc(userId: string) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const { data: myProfil } = await supabase
    .from('profils')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (myProfil?.role !== 'admin') throw new Error('Non autorisé');

  const { error } = await supabase
    .from('kyc_verifications')
    .update({ statut: 'rejected', updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  revalidate('admin-kyc');
  return { success: true };
}