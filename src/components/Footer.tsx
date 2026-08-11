'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/Link';
import { supabase } from '@/lib/supabaseClient';

type UserRole = 'entreprise' | 'secretaire' | 'admin' | null;

const ROLE_LINKS: Record<string, { label: string; href: string }[]> = {
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
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    const getRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (data?.role) setRole(data.role as UserRole);
    };
    getRole();
  }, []);

  const links = role ? ROLE_LINKS[role] ?? [] : [];

  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span className="text-slate-400">&copy; {new Date().getFullYear()} SecrétariatPro</span>
            <span className="text-slate-300">&middot;</span>
            <Link href="/mentions-legales" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">Mentions légales</Link>
            <span className="text-slate-300">&middot;</span>
            <Link href="/cgu" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">CGU</Link>
            <span className="text-slate-300">&middot;</span>
            <Link href="/confidentialite" className="hover:text-blue-700 transition-colors duration-200 underline underline-offset-2 decoration-transparent hover:decoration-blue-700">Confidentialité</Link>
          </div>
          {links.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              {links.map(link => (
                <Link key={link.href} href={link.href} className="text-slate-400 hover:text-blue-600 transition-colors duration-200 font-medium hover:underline underline-offset-2">
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
