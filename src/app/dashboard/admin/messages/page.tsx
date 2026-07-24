'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import ChatWindow from '@/components/ChatWindow';

export default function AdminMessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: profil } = await supabase
        .from('profils')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profil || profil.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUserId(session.user.id);
      setLoading(false);
    };
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Console d&apos;administration
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Discussions</h1>
          <p className="text-slate-500 font-medium mt-1">
            Conversations avec les entreprises et les secrétaires.
          </p>
        </header>

        <ChatWindow currentUserId={userId} currentRole="admin" />
      </div>
    </div>
  );
}
