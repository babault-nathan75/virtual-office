'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';

import Link from '@/components/Link';
import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/lib/supabaseClient';

type UserRole = 'entreprise' | 'secretaire' | 'admin';

type UserMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  nom?: string;
  avatar_url?: string;
  role?: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  entreprise: 'Entreprise',
  secretaire: 'Secrétaire',
  admin: 'Administrateur',
};

function DashboardIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3.5v5.2c0 4.7-2.9 8-7 9.3-4.1-1.3-7-4.6-7-9.3V6.5L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.7 1.7 3.5-3.7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.7-3.7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="8" r="3.3" />
      <path strokeLinecap="round" d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 5H6.5A2.5 2.5 0 004 7.5v9A2.5 2.5 0 006.5 19H10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 8l4 4-4 4M18 12H9" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path strokeLinecap="round" d="M5 7h14" />
          <path strokeLinecap="round" d="M5 12h14" />
          <path strokeLinecap="round" d="M5 17h14" />
        </>
      )}
    </svg>
  );
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('entreprise');

  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveRole = async (currentUser: User) => {
      const metadata = currentUser.user_metadata as UserMetadata;
      const fallbackRole = (metadata?.role as UserRole | undefined) || 'entreprise';

      const { data: profil, error } = await supabase
        .from('profils')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!error && profil?.role) {
        if (!cancelled) setUserRole(profil.role as UserRole);
        return;
      }

      const nom = metadata?.nom || metadata?.full_name || currentUser.email?.split('@')[0] || 'Utilisateur';

      try {
        const response = await fetch('/api/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            nom,
            role: fallbackRole,
            email: currentUser.email,
          }),
        });

        if (!response.ok) throw new Error(`ensure-profile: HTTP ${response.status}`);

        const data = await response.json();
        if (!cancelled) setUserRole((data.role as UserRole | undefined) || fallbackRole);
      } catch {
        if (!cancelled) setUserRole(fallbackRole);
      }
    };

    const hydrateSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        setUser(session?.user ?? null);
        if (session?.user) await resolveRole(session.user);
      } catch (error) {
        console.error('Navbar session error:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAvatarFailed(false);
      setIsLoading(false);

      if (nextUser) {
        void resolveRole(nextUser);
      } else {
        setUserRole('entreprise');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfileOpen(false);
    setMobileOpen(false);
    window.location.href = '/';
  };

  const metadata = user?.user_metadata as UserMetadata | undefined;

  const displayName = useMemo(() => {
    if (!user) return 'Utilisateur';

    const meta = user.user_metadata as UserMetadata | undefined;
    const firstPart = meta?.first_name || meta?.full_name || meta?.nom || '';
    const fullName = [firstPart, meta?.last_name].filter(Boolean).join(' ').trim();

    return fullName || user.email?.split('@')[0] || 'Utilisateur';
  }, [user]);

  const initials = useMemo(() => {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (!words.length) return 'SP';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }, [displayName]);

  const avatarUrl = metadata?.avatar_url;
  const roleLabel = ROLE_LABELS[userRole];

  const dashboardActive = pathname === '/dashboard' || (pathname.startsWith('/dashboard/') && !pathname.startsWith('/dashboard/admin'));
  const adminActive = pathname.startsWith('/dashboard/admin');

  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

  const navItemClass = (active: boolean) =>
    [
      'relative inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
    ].join(' ');

  const Avatar = ({ size = 'md' }: { size?: 'md' | 'lg' }) => {
    const dimension = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
    const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

    if (avatarUrl && !avatarFailed) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Photo de profil"
          width={size === 'lg' ? 44 : 36}
          height={size === 'lg' ? 44 : 36}
          onError={() => setAvatarFailed(true)}
          className={`${dimension} shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200`}
        />
      );
    }

    return (
      <span
        aria-label={`Avatar de ${displayName}`}
        className={`${dimension} ${textSize} inline-flex shrink-0 items-center justify-center rounded-full bg-blue-50 font-extrabold tracking-tight text-blue-700 ring-1 ring-blue-100`}
      >
        {initials}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-[72px] max-w-[1380px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          aria-label="Accueil SecrétariatPro"
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
          <span className="hidden whitespace-nowrap text-[22px] font-black tracking-[-0.04em] text-[#183b8f] sm:inline">
            Secrétariat<span className="text-[#2376f3]">Pro</span>
          </span>
        </Link>

        {/* Desktop center navigation */}
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          {!isLoading && user && (
            <nav aria-label="Navigation principale" className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <Link href="/dashboard" className={navItemClass(dashboardActive)}>
                <DashboardIcon />
                <span>Tableau de bord</span>
              </Link>

              {userRole === 'admin' && (
                <Link href="/dashboard/admin" className={navItemClass(adminActive)}>
                  <AdminIcon />
                  <span>Administration</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2" aria-label="Chargement de la session">
              <div className="hidden h-10 w-24 animate-pulse rounded-xl bg-slate-100 md:block" />
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : user ? (
            <>
              {/* One Realtime bell only */}
              <div className="flex items-center rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
                <NotificationBell userId={user.id} role={userRole} />

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('toggle-command-palette'))}
                  className={iconButtonClass}
                  aria-label="Rechercher"
                  title="Rechercher (⌘K)"
                >
                  <SearchIcon />
                </button>

              </div>

              <div className="relative hidden md:block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="group flex h-[50px] max-w-[250px] items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2 pr-3 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  <Avatar />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-5 text-slate-900">{displayName}</span>
                    <span className="block truncate text-[11px] font-semibold leading-4 text-slate-400">{roleLabel}</span>
                  </span>

                  <span className="text-slate-400 transition-colors group-hover:text-slate-700">
                    <ChevronIcon open={profileOpen} />
                  </span>
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2.5 w-[286px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,0.16)]"
                  >
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <Avatar size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="my-2 h-px bg-slate-100" />

                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      <span className="text-slate-400"><UserIcon /></span>
                      Mon profil
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <LogoutIcon />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className={`${iconButtonClass} border border-slate-200 bg-white shadow-sm md:hidden`}
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
              >
                <MenuIcon open={mobileOpen} />
              </button>
            </>
          ) : (
            <>
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/connexion"
                  className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1f67f2] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(31,103,242,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1859dd] hover:shadow-[0_11px_28px_rgba(31,103,242,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  S&apos;inscrire
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className={`${iconButtonClass} border border-slate-200 bg-white shadow-sm md:hidden`}
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
              >
                <MenuIcon open={mobileOpen} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto max-w-md">
            {user ? (
              <div>
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                  <Avatar size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    {roleLabel}
                  </span>
                </div>

                <nav aria-label="Navigation mobile" className="space-y-1">
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
                      dashboardActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <DashboardIcon />
                    Tableau de bord
                  </Link>

                  {userRole === 'admin' && (
                    <Link
                      href="/dashboard/admin"
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
                        adminActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <AdminIcon />
                      Administration
                    </Link>
                  )}

                  <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    <UserIcon />
                    Mon profil
                  </Link>
                </nav>

                <div className="my-3 h-px bg-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  <LogoutIcon />
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="grid gap-2.5">
                <Link
                  href="/connexion"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1f67f2] text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(31,103,242,0.24)] transition hover:bg-[#1859dd]"
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}