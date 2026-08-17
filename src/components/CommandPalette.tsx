'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { escapeLikePattern } from '@/lib/sanitize';
import Link from '@/components/Link';

type SearchResult = {
  type: 'conversation' | 'page';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const PAGES = [
  { title: 'Tableau de bord', href: '/dashboard', subtitle: 'Page principale' },
  { title: 'Discussions', href: '/dashboard/messages', subtitle: 'Messagerie' },
  { title: 'Profil', href: '/profile', subtitle: 'Mon profil' },
  { title: 'Notifications', href: '/dashboard/notifications', subtitle: 'Préférences' },
  { title: 'Paramètres 2FA', href: '/dashboard/profil/2fa', subtitle: 'Authentification' },
  { title: 'KYC', href: '/dashboard/kyc', subtitle: "Vérification d'identité" },
  { title: 'Trouver une secrétaire', href: '/dashboard/entreprise/chercher', subtitle: 'Recherche' },
  { title: 'Publier une mission', href: '/dashboard/entreprise/nouvelle-mission', subtitle: 'Nouvelle mission' },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || query.length < 2) return;

    // `cancelled` neutralise une réponse arrivée après la frappe suivante :
    // le clearTimeout seul n'annule pas une requête déjà partie.
    let cancelled = false;

    const search = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) { setResults([]); return; }

        const items: SearchResult[] = [];

        const { data: users } = await supabase
          .from('profils_publics')
          .select('id, nom, role')
          .ilike('nom', `%${escapeLikePattern(query)}%`)
          .neq('id', session.user.id)
          .limit(5);

        for (const u of users ?? []) {
          items.push({
            type: 'conversation',
            id: u.id,
            title: u.nom,
            subtitle: u.role === 'admin' ? 'Administrateur' : u.role === 'entreprise' ? 'Entreprise' : 'Secrétaire',
            href: u.role === 'admin' ? '/dashboard/admin/messages' : '/dashboard/messages',
          });
        }

        for (const p of PAGES) {
          if (p.title.toLowerCase().includes(query.toLowerCase()) || p.subtitle.toLowerCase().includes(query.toLowerCase())) {
            items.push({ type: 'page', id: p.href, ...p });
          }
        }

        if (cancelled) return;
        setResults(items);
        setSelectedIdx(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timeout = setTimeout(search, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open]);

  // Résultats dérivés du rendu : sous 2 caractères la liste est masquée sans
  // qu'un effet ait à remettre l'état à zéro. `useMemo` évite de recréer un
  // tableau à chaque rendu, ce qui ferait réabonner l'écouteur clavier
  // ci-dessous en boucle.
  const visibleResults = useMemo(
    () => (query.length >= 2 ? results : []),
    [query, results]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(prev => Math.min(prev + 1, visibleResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(prev => Math.max(prev - 1, 0)); }
      // Entrée navigue vers l'élément sélectionné : auparavant la palette se
      // contentait de se fermer, rendant la sélection au clavier inopérante.
      if (e.key === 'Enter') {
        const selected = visibleResults[selectedIdx];
        if (selected) {
          e.preventDefault();
          onClose();
          router.push(selected.href);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, visibleResults, selectedIdx, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeInZoom_0.15s_ease-out]" />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden animate-[fadeInZoom_0.2s_ease-out]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Recherche rapide">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une conversation, une page..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
          {loading && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />}
          <kbd className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded shrink-0">ESC</kbd>
        </div>
        {visibleResults.length > 0 && (
          <div className="max-h-64 overflow-y-auto p-2">
            {visibleResults.map((r, i) => (
              <Link key={r.id + r.href} href={r.href} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${i === selectedIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.type === 'conversation' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {r.type === 'conversation' ? r.title.charAt(0).toUpperCase() : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 truncate">{r.subtitle}</p>
                </div>
                {r.type === 'page' && (
                  <svg className="w-4 h-4 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                )}
              </Link>
            ))}
          </div>
        )}
        {query.length >= 2 && visibleResults.length === 0 && !loading && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </div>
            <p className="text-sm text-slate-400 font-medium">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          </div>
        )}
        {query.length < 2 && (
          <div className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Pages rapides</p>
            {PAGES.slice(0, 5).map((p) => (
              <Link key={p.href} href={p.href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.subtitle}</p>
                </div>
              </Link>
            ))}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Raccourcis clavier</p>
              <div className="grid grid-cols-2 gap-1.5 px-2">
                {[
                  { keys: '⌘K', label: 'Recherche' },
                  { keys: '⌘N', label: 'Nouveau message' },
                  { keys: '⌘E', label: 'Nouvelle mission' },
                  { keys: '⌘M', label: 'Discussions' },
                  { keys: '?', label: 'Aide raccourcis' },
                  { keys: 'ESC', label: 'Fermer' },
                ].map(s => (
                  <div key={s.keys} className="flex items-center gap-2 py-1">
                    <kbd className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono min-w-[28px] text-center">{s.keys}</kbd>
                    <span className="text-xs text-slate-500">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
