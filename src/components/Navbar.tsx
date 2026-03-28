'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // 1. Vérifier la session au chargement
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getSession();

    // 2. Écouter les changements (Connexion / Déconnexion) en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh(); // Pour forcer la mise à jour de l'UI
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* LOGO */}
          <Link href="/" className="text-2xl font-extrabold text-blue-900 flex items-center gap-2">
            <span className="bg-blue-600 text-white p-1 rounded-lg text-lg">SP</span>
            Secrétariat<span className="text-blue-500">Pro</span>
          </Link>

          {/* LIENS DE NAVIGATION */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* SI CONNECTÉ */}
                <Link 
                  href="/dashboard" 
                  className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
                >
                  🏠 Mon Tableau de bord
                </Link>
                <button 
                  onClick={handleLogout}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                {/* SI VISITEUR */}
                <Link 
                  href="/connexion" 
                  className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
                >
                  Connexion
                </Link>
                <Link 
                  href="/inscription" 
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md transition"
                >
                  S'inscrire
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}