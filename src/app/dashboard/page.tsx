'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const identifyAndRedirect = async () => {
      // 1. On vérifie si l'utilisateur est bien connecté
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Personne n'est connecté ? On renvoie à la page de connexion
        router.push('/connexion');
        return;
      }

      // 2. On récupère le rôle stocké dans la table 'profils'
      const { data: profil, error } = await supabase
        .from('profils')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !profil) {
        console.error("Impossible de trouver le profil :", error);
        router.push('/');
        return;
      }

      // 3. 🎯 LA LOGIQUE DE REDIRECTION PAR RÔLE
      if (profil.role === 'admin') {
        router.push('/dashboard/admin');
      } else if (profil.role === 'entreprise') {
        router.push('/dashboard/entreprise');
      } else if (profil.role === 'secretaire') {
        router.push('/dashboard/secretaire');
      } else {
        // Au cas où le rôle est inconnu
        router.push('/');
      }
    };

    identifyAndRedirect();
  }, [router]);

  // Petit écran d'attente stylé pendant que le code "réfléchit"
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 font-medium animate-pulse">
        Vérification de vos accès en cours...
      </p>
    </div>
  );
}