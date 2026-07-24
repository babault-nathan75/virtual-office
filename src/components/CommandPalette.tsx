'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from '@/components/Link';

type SearchResult = {
  type: 'conversation' | 'page';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.length < 2) { setResults([]); return; }

    const search = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const items: SearchResult[] = [];

      // Search users
      const { data: users } = await supabase
        .from('profils')
        .select('id, nom, role')
        .ilike('nom', `%${query}%`)
        .neq('id', session.user.id)
        .limit(5);

      for (const u of users ?? []) {
        items.push({
          type: 'conversation',
          id: u.id,
          title: u.nom,
          subtitle: u.role === 'admin' ? 'Administrateur' : u.role === 'entreprise' ? 'Entreprise' : 'Secrétaire',
          href: session.user.id && u.role === 'admin' ? '/dashboard/admin/messages' : '/dashboard/messages',
        });
      }

      // Static pages
      const pages = [
        { title: 'Tableau de bord', href: '/dashboard', subtitle: 'Page principale' },
        { title: 'Discussions', href: '/dashboard/messages', subtitle: 'Messagerie' },
        { title: 'Profil', href: '/profile', subtitle: 'Mon profil' },
        { title: 'Paramètres 2FA', href: '/dashboard/profil/2fa', subtitle: 'Authentification' },
        { title: 'KYC', href: '/dashboard/kyc', subtitle: 'Vérification d\'identité' },
      ];

      for (const p of pages) {
        if (p.title.toLowerCase().includes(query.toLowerCase())) {
          items.push({ type: 'page', id: p.href, ...p });
        }
      }

      setResults(items);
      setLoading(false);
    };

    const timeout = setTimeout(search, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une conversation, une page..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
          <kbd className="text-[10px] bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto p-2">
            {results.map(r => (
              <Link key={r.id} href={r.href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                  {r.type === 'conversation' ? r.title.charAt(0).toUpperCase() : '📄'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{r.title}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">{r.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && !loading && (
          <p className="p-6 text-center text-sm text-slate-400">Aucun résultat</p>
        )}
      </div>
    </div>
  );
}
