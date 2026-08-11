'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const identifyAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/connexion');
        return;
      }

      try {
        const res = await fetch('/api/user-role', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        const role = data.role;

        if (role === 'admin') {
          router.replace('/dashboard/admin');
        } else if (role === 'entreprise') {
          router.replace('/dashboard/entreprise');
        } else if (role === 'secretaire') {
          router.replace('/dashboard/secretaire');
        } else {
          router.replace('/connexion');
        }
      } catch {
        router.replace('/connexion');
      }
    };

    identifyAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-slate-500 font-semibold mt-4 text-sm">
        Vérification de vos accès...
      </p>
    </div>
  );
}
