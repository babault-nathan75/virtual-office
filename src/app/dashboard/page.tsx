'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getCachedRole, roleHome, setCachedRole, type Role } from '@/lib/roleStore';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const identifyAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/connexion');
        return;
      }

      // Le cache n'est consulté qu'une fois la session connue : il est indexé
      // par utilisateur, donc inexploitable avant de savoir qui est connecté.
      const cachedRole = getCachedRole(session.user.id);
      if (cachedRole) {
        router.replace(roleHome(cachedRole));
        return;
      }

      try {
        const res = await fetch('/api/user-role', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        const resolvedRole = data.role;

        if (resolvedRole === 'admin' || resolvedRole === 'entreprise' || resolvedRole === 'secretaire') {
          setCachedRole(resolvedRole as Role, session.user.id);
          router.replace(roleHome(resolvedRole as Role));
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
    <div className="min-h-screen bg-slate-50" aria-hidden="true" />
  );
}