'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from '@/components/Link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';

type UserMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
};

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 👈 Ajout du state de chargement
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false); // 👈 State pour le menu déroulant desktop
  const [userRole, setUserRole] = useState<string>('');
  
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data: profil, error } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
          if (error || !profil) {
            const nom = session.user.user_metadata?.nom || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Utilisateur';
            const role = (session.user.user_metadata?.role as string) || 'entreprise';
            try {
              const res = await fetch('/api/ensure-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, nom, role, email: session.user.email }),
              });
              const data = await res.json();
              setUserRole(data.role || role);
            } catch {
              setUserRole(role);
            }
          } else {
            setUserRole(profil.role);
          }
        }
      } catch (e) {
        console.error('Navbar session error:', e);
      } finally {
        setIsLoading(false); // 👈 Fin du chargement
      }
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 👈 Fermer le menu déroulant au clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMobileOpen(false);
    setProfileOpen(false);
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

          {/* DESKTOP NAV */}
          <div className="hidden md:flex items-center gap-6">
            {isLoading ? (
              // 👈 Skeleton Loader pendant la vérification de session
              <div className="flex items-center gap-4 animate-pulse">
                <div className="w-24 h-4 bg-gray-200 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              </div>
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm font-semibold transition ${pathname === '/dashboard' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                >
                  Tableau de bord
                </Link>

                {userRole === 'admin' && (
                  <Link
                    href="/dashboard/admin"
                    className={`text-sm font-semibold transition ${pathname.startsWith('/dashboard/admin') ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                  >
                    Administration
                  </Link>
                )}

                <NotificationBell userId={user.id} role={userRole as 'entreprise' | 'secretaire' | 'admin'} />
                <button onClick={() => window.dispatchEvent(new Event('toggle-command-palette'))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition text-slate-500 dark:text-gray-400" title="Rechercher (⌘K)">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                <ThemeToggle />

                {/* 👈 Dropdown Profil Desktop */}
                <div className="relative ml-2" ref={dropdownRef}>
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-100"
                    aria-expanded={profileOpen}
                  >
                    <Image
                      src={(user.user_metadata as UserMetadata)?.avatar_url || '/avatar-placeholder.png'}
                      alt="Profil"
                      width={32}
                      height={32}
                      className="rounded-full object-cover w-8 h-8"
                    />
                    <span className="text-sm font-semibold text-gray-700 max-w-[120px] truncate">
                      {getDisplayName()}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 transform opacity-100 scale-100 transition-all origin-top-right">
                      <div className="px-4 py-2 border-b border-gray-50 mb-1">
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Link 
                        href="/profile" 
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        Mon profil
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/connexion" className="text-sm font-semibold text-gray-600 hover:text-blue-600 transition">
                  Connexion
                </Link>
                <Link href="/inscription" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition">
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>

          {/* BOUTON HAMBURGER MOBILE */}
          <div className="flex md:hidden items-center gap-3">
            {!isLoading && user && <NotificationBell userId={user.id} role={userRole as 'entreprise' | 'secretaire' | 'admin'} />}
            <button onClick={() => window.dispatchEvent(new Event('toggle-command-palette'))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition text-slate-500 dark:text-gray-400" title="Rechercher">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition focus:outline-none"
              aria-expanded={mobileOpen}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MENU MOBILE */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white absolute w-full shadow-lg">
          <div className="px-4 py-4 space-y-2">
            {isLoading ? (
               <div className="animate-pulse space-y-4">
                 <div className="h-10 bg-gray-100 rounded w-full"></div>
                 <div className="h-10 bg-gray-100 rounded w-full"></div>
               </div>
            ) : user ? (
              <>
                <div className="flex items-center gap-3 p-2 mb-2 border-b border-gray-50 pb-4">
                  <Image
                    src={(user.user_metadata as UserMetadata)?.avatar_url || '/avatar-placeholder.png'}
                    alt="Profil"
                    width={40}
                    height={40}
                    className="rounded-full object-cover w-10 h-10"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">{getDisplayName()}</span>
                    <span className="block text-xs text-gray-500">{user.email}</span>
                  </div>
                </div>
                
                <Link
                  href="/dashboard"
                  className={`block p-3 rounded-lg text-sm font-semibold transition ${pathname === '/dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Tableau de bord
                </Link>

                {userRole === 'admin' && (
                  <Link
                    href="/dashboard/admin"
                    className={`block p-3 rounded-lg text-sm font-semibold transition ${pathname.startsWith('/dashboard/admin') ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    Administration
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="block p-3 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  onClick={() => setMobileOpen(false)}
                >
                  Mon profil
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full text-left p-3 mt-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3 pt-2">
                <Link href="/connexion" className="block w-full p-3 rounded-lg text-sm font-semibold text-center text-gray-700 bg-gray-50 hover:bg-gray-100 transition" onClick={() => setMobileOpen(false)}>
                  Connexion
                </Link>
                <Link href="/inscription" className="block w-full p-3 rounded-lg text-sm font-bold text-center text-white bg-blue-600 hover:bg-blue-700 transition" onClick={() => setMobileOpen(false)}>
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}