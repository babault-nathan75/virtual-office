'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatWindow from '@/components/ChatWindow';

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [adminId, setAdminId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      setUserId(session.user.id);

      const { data: profil } = await supabase
        .from('profils')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profil) setRole(profil.role as 'entreprise' | 'secretaire');

      // Find an admin to chat with
      const { data: admin } = await supabase
        .from('profils')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (admin) setAdminId(admin.id);

      setLoading(false);
    };
    fetchData();
  }, [router]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Tableau de bord
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Messages</h1>
          <p className="text-slate-500 font-medium mt-1">
            Contactez l&apos;administration pour toute question ou demande.
          </p>
        </header>

        {adminId ? (
          <ChatWindow currentUserId={userId} currentRole={role} adminId={adminId} />
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-slate-500 font-medium">Aucun administrateur disponible pour le moment.</p>
            <p className="text-xs text-slate-400 mt-2">Réessayez plus tard ou contactez-nous par email.</p>
          </div>
        )}
      </div>
    </div>
  );
}
