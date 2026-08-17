'use client';

import Link from '@/components/Link';
import { usePathname } from 'next/navigation';
import { useRole, type Role } from '@/lib/roleStore';

const ROLE_LINKS: Record<Role, { label: string; href: string }[]> = {
  entreprise: [
    { label: 'Trouver une secrétaire', href: '/dashboard/entreprise/chercher' },
    { label: 'Publier une mission', href: '/dashboard/entreprise/nouvelle-mission' },
    { label: 'Discussions', href: '/dashboard/messages' },
  ],
  secretaire: [
    { label: 'Missions disponibles', href: '/dashboard/secretaire' },
    { label: 'Mon profil', href: '/dashboard/secretaire/profil' },
    { label: 'Discussions', href: '/dashboard/messages' },
  ],
  admin: [
    { label: 'Utilisateurs', href: '/dashboard/admin/utilisateurs' },
    { label: 'Messages', href: '/dashboard/admin/messages' },
    { label: 'KYC', href: '/dashboard/admin/kyc' },
    { label: 'Stats', href: '/dashboard/admin/stats' },
  ],
};

export default function Footer() {
  // `useRole` renvoie null au rendu serveur comme au premier rendu client :
  // le garde-fou `mounted` qui existait ici n'a plus lieu d'être.
  const role = useRole();
  const pathname = usePathname();

  const links = role ? ROLE_LINKS[role] : [];

  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-sm text-slate-500 font-medium">
            <span className="text-slate-400">&copy; {new Date().getFullYear()} SecrétariatPro</span>
            <span className="text-slate-300">&middot;</span>
            <Link href="/mentions-legales" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">Mentions légales</Link>
            <span className="text-slate-300">&middot;</span>
            <Link href="/cgu" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">CGU</Link>
            <span className="text-slate-300">&middot;</span>
            <Link href="/confidentialite" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">Confidentialité</Link>
          </div>
          {links.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
              {links.map(link => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`transition-colors duration-200 font-medium underline-offset-2 ${
                      isActive
                        ? 'text-blue-600 font-bold underline'
                        : 'text-slate-400 hover:text-blue-600 hover:underline'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}