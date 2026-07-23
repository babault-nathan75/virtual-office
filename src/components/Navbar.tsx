'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import NotificationBell from '@/components/NotificationBell';
import { usePathname } from 'next/navigation';

type UserMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
};

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profil } = await supabase.from('profils').select('role').eq('id', session.user.id).single();
        if (profil) setUserRole(profil.role);
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push('/');
    router.refresh();
  };

  const getDisplayName = () => {
    const meta = user?.user_metadata as UserMetadata | undefined;
    if (!meta) return '';
    return (
      (meta.first_name || meta.full_name || '') +
      (meta.last_name ? ' ' + meta.last_name : '')
    ).trim();
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

          {/* LIENS DESKTOP */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
                >
                  Mon Tableau de bord
                </Link>
                <Link
                  href="/dashboard/messages"
                  className={`text-sm font-semibold transition ${pathname === '/dashboard/messages' ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                >
                  Messages
                </Link>
                <NotificationBell userId={user.id} role={userRole as 'entreprise' | 'secretaire' | 'admin'} />
                <Link href="/profile" className="flex items-center gap-3">
                  <Image
                    src={(user.user_metadata as UserMetadata)?.avatar_url || '/avatar-placeholder.png'}
                    alt="Profil"
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                  <span className="text-sm font-semibold text-gray-700 max-w-[140px] truncate">
                    {getDisplayName()}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/connexion" className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition">
                  Connexion
                </Link>
                <Link href="/inscription" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md transition">
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>

          {/* BOUTON HAMBURGER MOBILE */}
          <div className="flex md:hidden items-center gap-3">
            {user && <NotificationBell userId={user.id} role={userRole as 'entreprise' | 'secretaire' | 'admin'} />}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MENU MOBILE */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-3">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                  onClick={() => setMobileOpen(false)}
                >
                  <Image
                    src={(user.user_metadata as UserMetadata)?.avatar_url || '/avatar-placeholder.png'}
                    alt="Profil"
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                  <span className="text-sm font-semibold text-gray-700">{getDisplayName()}</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="block p-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  onClick={() => setMobileOpen(false)}
                >
                  Mon Tableau de bord
                </Link>
                <Link
                  href="/dashboard/messages"
                  className={`block p-2 rounded-lg text-sm font-semibold transition ${pathname === '/dashboard/messages' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Messages
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left p-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" className="block p-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition" onClick={() => setMobileOpen(false)}>
                  Connexion
                </Link>
                <Link href="/inscription" className="block p-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition text-center" onClick={() => setMobileOpen(false)}>
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
