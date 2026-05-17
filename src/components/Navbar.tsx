'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import NotificationBell from '@/components/NotificationBell';

type UserMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
};

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
          <Link href="/" className="text-base sm:text-xl md:text-2xl font-extrabold text-blue-900 flex items-center gap-2 shrink-0">
            <Image
              src="/logo.png"
              alt="Logo SecrétariatPro"
              width={44}
              height={44}
              priority
              className="rounded-lg object-contain w-9 h-9 sm:w-11 sm:h-11"
            />
            <span className="hidden sm:inline">Secrétariat<span className="text-blue-500">Pro</span></span>
          </Link>

          {/* LIENS DE NAVIGATION */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* SI CONNECTÉ */}
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
                  aria-label="Mon tableau de bord"
                >
                  <span aria-hidden>🏠</span>
                  <span className="hidden md:inline ml-1">Mon Tableau de bord</span>
                </Link>
                <NotificationBell />
                {/* Profil connecté: photo + nom & prenom */}
                <Link href="/profile" className="flex items-center gap-3">
                  <Image
                    src={((user.user_metadata as unknown) as UserMetadata)?.avatar_url || '/avatar-placeholder.png'}
                    alt="Profil"
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                  <span className="hidden sm:inline text-sm font-semibold text-gray-700 max-w-[140px] truncate">
                    {(((user.user_metadata as unknown) as UserMetadata)?.first_name || ((user.user_metadata as unknown) as UserMetadata)?.full_name || '') +
                      ((((user.user_metadata as unknown) as UserMetadata)?.last_name) ? ' ' + ((user.user_metadata as unknown) as UserMetadata).last_name : '')}
                  </span>
                </Link>
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