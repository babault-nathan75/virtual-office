'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardRedirect() {
  useEffect(() => {
    const identifyAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/connexion';
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
          window.location.href = '/dashboard/admin';
        } else if (role === 'entreprise') {
          window.location.href = '/dashboard/entreprise';
        } else if (role === 'secretaire') {
          window.location.href = '/dashboard/secretaire';
        } else {
          window.location.href = '/connexion';
        }
      } catch {
        window.location.href = '/connexion';
      }
    };

    identifyAndRedirect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 font-medium animate-pulse">
        Vérification de vos accès en cours...
      </p>
    </div>
  );
}
