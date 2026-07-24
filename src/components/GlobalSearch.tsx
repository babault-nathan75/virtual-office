'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from '@/components/Link';

type SearchResult = {
  type: 'profil' | 'message' | 'mission';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
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

      // Search profils
      const { data: profils } = await supabase
        .from('profils')
        .select('id, nom, role')
        .ilike('nom', `%${query}%`)
        .neq('id', session.user.id)
        .limit(5);

      for (const p of profils ?? []) {
        items.push({
          type: 'profil',
          id: p.id,
          title: p.nom,
          subtitle: p.role === 'admin' ? 'Administrateur' : p.role === 'entreprise' ? 'Entreprise' : 'Secrétaire',
          href: '/dashboard/messages',
        });
      }

      // Search messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, content, sender_id')
        .ilike('content', `%${query}%`)
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .limit(5);

      for (const m of msgs ?? []) {
        items.push({
          type: 'message',
          id: String(m.id),
          title: m.content.slice(0, 60),
          subtitle: 'Message',
          href: '/dashboard/messages',
        });
      }

      // Static pages
      const pages = [
        { title: 'Tableau de bord', href: '/dashboard', subtitle: 'Page principale' },
        { title: 'Discussions', href: '/dashboard/messages', subtitle: 'Messagerie' },
        { title: 'Profil', href: '/profile', subtitle: 'Mon profil' },
        { title: 'KYC', href: '/dashboard/kyc', subtitle: 'Vérification' },
        { title: 'Paramètres 2FA', href: '/dashboard/profil/2fa', subtitle: 'Sécurité' },
      ];

      for (const p of pages) {
        if (p.title.toLowerCase().includes(query.toLowerCase())) {
          items.push({ type: 'mission', id: p.href, ...p });
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher profils, messages, pages..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
          <kbd className="text-[10px] bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded">ESC</kbd>
        </div>

        {loading && (
          <div className="p-4 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.map(r => (
              <Link key={`${r.type}-${r.id}`} href={r.href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  r.type === 'profil' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                  r.type === 'message' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                }`}>
                  {r.type === 'profil' ? r.title.charAt(0).toUpperCase() : r.type === 'message' ? '💬' : '📄'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">{r.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <p className="p-6 text-center text-sm text-slate-400">Aucun résultat pour &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </div>
  );
}
