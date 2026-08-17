'use client';

import { usePathname } from 'next/navigation';
import Link from '@/components/Link';
import { useRole, type Role } from '@/lib/roleStore';

const NAV_ITEMS: Record<Role, { href: string; label: string; icon: string }[]> = {
  entreprise: [
    { href: '/', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { href: '/dashboard/entreprise/chercher', label: 'Chercher', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { href: '/dashboard/messages', label: 'Discussions', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  ],
  secretaire: [
    { href: '/', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { href: '/dashboard/secretaire/missions', label: 'Missions', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { href: '/dashboard/messages', label: 'Discussions', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { href: '/dashboard/secretaire/profil', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
  admin: [
    { href: '/', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { href: '/dashboard/admin/kyc', label: 'KYC', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { href: '/dashboard/admin/messages', label: 'Discussions', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { href: '/dashboard/admin/stats', label: 'Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ],
};

export default function BottomNav() {
  const pathname = usePathname();
  // `useRole` renvoie null au rendu serveur comme au premier rendu client :
  // le garde-fou `mounted` qui existait ici n'a plus lieu d'être.
  const role = useRole();

  // Sans rôle résolu (visiteur non connecté), la barre affichait la navigation
  // « entreprise » : des liens vers des espaces privés qui renvoyaient
  // aussitôt vers la page de connexion.
  if (!role) return null;

  const items = NAV_ITEMS[role];

  return (
    <>
      {/* Réserve la hauteur de la barre fixe : sans cela, le bas de chaque
          page (dernier bouton, pied de page) restait masqué dessous. */}
      <div aria-hidden="true" className="md:hidden h-[calc(3.5rem+env(safe-area-inset-bottom,0px))]" />

      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 z-50 safe-area-pb shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
      >
        <div className="flex items-center justify-around py-1.5">
        {items.map(item => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 min-w-0 flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600 active:scale-95'
              }`}
            >
              <span
                className={[
                  'inline-flex items-center justify-center rounded-xl px-2.5 py-1 transition-all duration-200',
                  isActive ? 'bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.35)]' : '',
                ].join(' ')}
              >
                <svg
                  className={`w-5 h-5 ${isActive ? 'text-white' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </span>
              <span className={`text-[10px] font-bold ${isActive ? 'text-blue-700' : 'text-inherit'}`}>{item.label}</span>
            </Link>
          );
        })}
        </div>
      </nav>
    </>
  );
}