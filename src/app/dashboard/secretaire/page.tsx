import { getSecretaireDashboardData, computeProfileCompletion } from '@/lib/data/secretaire';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import SecretaireDashboardClient from './SecretaireDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tableau de bord Secrétaire' };

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  // getUser() valide le JWT côté serveur, contrairement à getSession().
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export default async function DashboardSecretairePage() {
  const { user, supabase } = await getUser();
  if (!user) redirect('/connexion');

  const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).maybeSingle();
  if (profil && profil.role !== 'secretaire') redirect('/dashboard');

  const data = await getSecretaireDashboardData(user.id);
  const completion = computeProfileCompletion(data.profilSecretaire, data.kycApproved, data.twoFactorEnabled);

  return (
    <SecretaireDashboardClient
      userId={user.id}
      userName={data.profil?.nom || 'Secrétaire'}
      userAvatar={data.profilSecretaire?.photo_url}
      completion={completion}
      kycApproved={data.kycApproved}
      twoFactorEnabled={data.twoFactorEnabled}
      missions={data.missions}
      candidatures={data.candidatures}
      offres={data.offres}
    />
  );
}

export const revalidate = 30;
export const dynamic = 'force-dynamic';