'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Notif = {
  id: number;
  type: string;
  titre: string;
  message: string | null;
  lien: string | null;
  lue: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Session + initial fetch
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session) return;
      const uid = session.user.id;
      setUserId(uid);

      const { data } = await supabase
        .from('notifications')
        .select('id, type, titre, message, lien, lue, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);
      if (mounted && data) setNotifs(data as Notif[]);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) {
        setUserId(null);
        setNotifs([]);
      } else if (session.user.id !== userId) {
        setUserId(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime : nouveaux INSERT pour cet utilisateur
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs(prev => [payload.new as Notif, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Click outside → close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = notifs.filter(n => !n.lue).length;

  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    setNotifs(prev => prev.map(n => ({ ...n, lue: true })));
    await supabase.from('notifications').update({ lue: true }).eq('user_id', userId).eq('lue', false);
  };

  const handleClick = async (n: Notif) => {
    if (!n.lue) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, lue: true } : x));
      await supabase.from('notifications').update({ lue: true }).eq('id', n.id);
    }
    setOpen(false);
    if (n.lien) router.push(n.lien);
  };

  if (!userId) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications (${unread} non lues)`}
        aria-expanded={open}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition"
      >
        <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-black tracking-tight text-slate-900">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400 italic font-medium">Aucune notification.</p>
            ) : (
              <ul>
                {notifs.map(n => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition ${n.lue ? '' : 'bg-blue-50/40'}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.lue && <span className="mt-1.5 w-2 h-2 bg-blue-600 rounded-full shrink-0" aria-hidden />}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm">{n.titre}</p>
                          {n.message && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-widest">
                            {new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
