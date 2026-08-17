import { getAdminDashboardData } from '@/lib/data/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Administration' };

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  // getUser() valide le JWT auprès de Supabase ; getSession() se contente de
  // lire le cookie, ce qui n'est pas une preuve d'authentification côté serveur.
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export default async function DashboardAdminPage() {
  const { user, supabase } = await getUser();
  if (!user) redirect('/connexion');

  const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).maybeSingle();
  // Un profil absent ou non-admin est refusé : l'ancien test laissait passer
  // le cas « aucun profil trouvé ».
  if (profil?.role !== 'admin') redirect('/dashboard');

  const data = await getAdminDashboardData(user.id);

  return (
    <AdminDashboardClient
      userId={user.id}
      userName={data.profil?.nom || 'Admin'}
      stats={data}
    />
  );
}

export const revalidate = 60;
export const dynamic = 'force-dynamic';