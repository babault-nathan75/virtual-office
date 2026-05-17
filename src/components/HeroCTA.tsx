'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Role = 'entreprise' | 'secretaire' | 'admin' | null;

export default function HeroCTA() {
  const [role, setRole] = useState<Role>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async (uid: string | null) => {
      if (!uid) {
        if (mounted) {
          setRole(null);
          setReady(true);
        }
        return;
      }
      const { data } = await supabase
        .from('profils')
        .select('role')
        .eq('id', uid)
        .single();
      if (mounted) {
        setRole((data?.role as Role) ?? null);
        setReady(true);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      load(session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Pendant le chargement, on garde la maquette par défaut (évite le flash visuel)
  // Si pas connecté : design original
  if (!ready || !role) {
    return (
      <div className="flex flex-col sm:flex-row justify-center gap-5 w-full sm:w-auto px-4">
        <Link
          href="/inscription"
          className="group bg-white text-slate-900 font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(255,255,255,0.15)] hover:bg-slate-50 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          🏢 Je cherche une secrétaire
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
        <Link
          href="/inscription"
          className="group bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(16,185,129,0.25)] hover:from-emerald-400 hover:to-teal-500 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          👩‍💻 Je propose mes services
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    );
  }

  // Connecté : variantes par rôle
  if (role === 'secretaire') {
    return (
      <div className="flex flex-col sm:flex-row justify-center gap-5 w-full sm:w-auto px-4">
        <Link
          href="/dashboard/secretaire"
          className="group bg-white text-slate-900 font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(255,255,255,0.15)] hover:bg-slate-50 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          🧰 Mon espace de travail
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
        <Link
          href="/dashboard/secretaire/missions"
          className="group bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(16,185,129,0.25)] hover:from-emerald-400 hover:to-teal-500 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          🔍 Rechercher un poste
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    );
  }

  if (role === 'entreprise') {
    return (
      <div className="flex flex-col sm:flex-row justify-center gap-5 w-full sm:w-auto px-4">
        <Link
          href="/dashboard/entreprise"
          className="group bg-white text-slate-900 font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(255,255,255,0.15)] hover:bg-slate-50 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          🏢 Mon espace entreprise
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
        <Link
          href="/dashboard/entreprise/chercher"
          className="group bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(37,99,235,0.25)] hover:from-blue-400 hover:to-indigo-500 hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
        >
          🔍 Trouver une secrétaire
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    );
  }

  // admin
  return (
    <div className="flex justify-center w-full sm:w-auto px-4">
      <Link
        href="/dashboard/admin"
        className="group bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-extrabold py-5 px-10 rounded-full shadow-[0_20px_40px_rgba(245,158,11,0.3)] hover:scale-105 transition-all duration-300 text-base tracking-tight flex items-center justify-center gap-2"
      >
        🛡️ Console d&apos;administration
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    </div>
  );
}
