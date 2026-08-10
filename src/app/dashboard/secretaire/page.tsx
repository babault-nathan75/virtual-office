import { getSecretaireDashboardData, computeProfileCompletion } from '@/lib/data/secretaire';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import SecretaireDashboardClient from './SecretaireDashboardClient';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return { user: session?.user, supabase };
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
      missions={data.missions as any}
      candidatures={data.candidatures as any}
      offres={data.offres as any}
    />
  );
}

export const revalidate = 30;
export const dynamic = 'force-dynamic';