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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeInZoom_0.15s_ease-out]" />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden animate-[slideUp_0.2s_cubic-bezier(0.22,1,0.36,1)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher profils, messages, pages..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
          <kbd className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {loading && (
          <div className="p-4 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2 stagger-children">
            {results.map(r => (
              <Link key={`${r.type}-${r.id}`} href={r.href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-all duration-150 active:scale-[0.98]">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  r.type === 'profil' ? 'bg-blue-100 text-blue-600' :
                  r.type === 'message' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {r.type === 'profil' ? r.title.charAt(0).toUpperCase() : r.type === 'message' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">{r.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <p className="p-6 text-center text-sm text-slate-400 animate-[fadeSlideIn_0.2s_ease-out]">Aucun résultat pour &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </div>
  );
}
