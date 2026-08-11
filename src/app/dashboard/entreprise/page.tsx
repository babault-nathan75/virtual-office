import { getEntrepriseDashboardData } from '@/lib/data/entreprise';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import EntrepriseDashboardClient from './EntrepriseDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tableau de bord Entreprise' };

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

export default async function DashboardEntreprisePage() {
  const { user, supabase } = await getUser();
  if (!user) redirect('/connexion');

  const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).maybeSingle();
  if (profil && profil.role !== 'entreprise') redirect('/dashboard');

  const data = await getEntrepriseDashboardData(user.id);

  return (
    <EntrepriseDashboardClient
      initialData={data as any}
      userId={user.id}
      userName={data.profil?.nom || 'Entreprise'}
    />
  );
}

export const revalidate = 30;
export const dynamic = 'force-dynamic';