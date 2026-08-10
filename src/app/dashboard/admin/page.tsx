import { getAdminDashboardData } from '@/lib/data/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';

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

export default async function DashboardAdminPage() {
  const { user, supabase } = await getUser();
  if (!user) redirect('/connexion');

  const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).maybeSingle();
  if (profil && profil.role !== 'admin') redirect('/dashboard');

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