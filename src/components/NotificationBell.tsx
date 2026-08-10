'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';
import Link from '@/components/Link';

type Props = {
  userId: string;
  role: 'entreprise' | 'secretaire' | 'admin';
};

type NotificationItem = {
  id: string;
  type: 'message' | 'kyc' | 'mission' | 'match';
  title: string;
  body: string;
  href: string;
  read: boolean;
  created_at: string;
};

const TYPE_STYLES: Record<string, { icon: string; bg: string; text: string }> = {
  message: { icon: '💬', bg: 'bg-blue-100', text: 'text-blue-600' },
  kyc:     { icon: '🪪', bg: 'bg-amber-100', text: 'text-amber-600' },
  mission: { icon: '📋', bg: 'bg-purple-100', text: 'text-purple-600' },
  match:   { icon: '🤝', bg: 'bg-emerald-100', text: 'text-emerald-600' },
};

export default function NotificationBell({ userId, role }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const subId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const fetchInitial = async () => {
      try {
        const all: NotificationItem[] = [];

        // Messages non lus
        const { data: unreadMsgs } = await supabase
          .from('messages')
          .select('id, sender_id, content, created_at')
          .eq('receiver_id', userId)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(5);

        if (unreadMsgs?.length) {
          const senderIds = [...new Set(unreadMsgs.map(m => m.sender_id))];
          const { data: senders } = await supabase.from('profils').select('id, nom, role').in('id', senderIds);
          const senderMap = new Map((senders ?? []).map(s => [s.id, { nom: s.nom, role: s.role }]));

          for (const m of unreadMsgs) {
            const sender = senderMap.get(m.sender_id);
            all.push({
              id: `msg-${m.id}`,
              type: 'message',
              title: role === 'admin' ? `Message de ${sender?.nom || 'Utilisateur'}` : 'Message de l\'administration',
              body: m.content.length > 60 ? m.content.slice(0, 60) + '...' : m.content,
              href: role === 'admin' ? '/dashboard/admin/messages' : '/dashboard/messages',
              read: false,
              created_at: m.created_at,
            });
          }
        }

        if (role === 'admin') {
          // KYC en attente
          const { data: pendingKycs } = await supabase
            .from('kyc_verifications')
            .select('user_id, created_at')
            .eq('statut', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

          if (pendingKycs?.length) {
            const kycUserIds = pendingKycs.map(k => k.user_id);
            const { data: users } = await supabase.from('profils').select('id, nom').in('id', kycUserIds);
            const userMap = new Map((users ?? []).map(u => [u.id, u.nom]));

            for (const k of pendingKycs) {
              all.push({
                id: `kyc-${k.user_id}`,
                type: 'kyc',
                title: 'Nouvelle demande KYC',
                body: `${userMap.get(k.user_id) || 'Utilisateur'} a soumis ses documents`,
                href: '/dashboard/admin/kyc',
                read: false,
                created_at: k.created_at,
              });
            }
          }

          // Nouvelles missions
          const { data: recentMissions } = await supabase
            .from('missions')
            .select('id, titre, created_at, entreprise_id')
            .eq('statut', 'ouverte')
            .order('created_at', { ascending: false })
            .limit(3);

          if (recentMissions?.length) {
            const entIds = recentMissions.map(m => m.entreprise_id);
            const { data: ents } = await supabase.from('profils').select('id, nom').in('id', entIds);
            const entMap = new Map((ents ?? []).map(e => [e.id, e.nom]));

            for (const m of recentMissions) {
              all.push({
                id: `mission-${m.id}`,
                type: 'mission',
                title: 'Nouvelle mission',
                body: `${entMap.get(m.entreprise_id) || 'Entreprise'} a publié « ${m.titre} »`,
                href: '/dashboard/admin',
                read: true,
                created_at: m.created_at,
              });
            }
          }

          // Match admin
          const { data: adminMissions } = await supabase
            .from('missions')
            .select('id, titre, entreprise_id')
            .eq('entreprise_id', userId);

          if (adminMissions?.length) {
            const missionIds = adminMissions.map(m => m.id);
            const { data: newCands } = await supabase
              .from('candidatures')
              .select('id, mission_id, secretaire_id, created_at')
              .in('mission_id', missionIds)
              .eq('statut', 'en_attente')
              .order('created_at', { ascending: false })
              .limit(3);

            if (newCands?.length) {
              const secIds = [...new Set(newCands.map(c => c.secretaire_id))];
              const { data: secs } = await supabase.from('profils').select('id, nom').in('id', secIds);
              const secMap = new Map((secs ?? []).map(s => [s.id, s.nom]));
              const missionMap = new Map(adminMissions.map(m => [m.id, m.titre]));

              for (const c of newCands) {
                all.push({
                  id: `match-${c.id}`,
                  type: 'match',
                  title: 'Nouveau match',
                  body: `${secMap.get(c.secretaire_id) || 'Secrétaire'} a postulé pour « ${missionMap.get(c.mission_id) || ''} »`,
                  href: '/dashboard/admin',
                  read: false,
                  created_at: c.created_at,
                });
              }
            }
          }
        }

        if (role === 'secretaire') {
          const { data: myKyc } = await supabase
            .from('kyc_verifications')
            .select('statut, updated_at')
            .eq('user_id', userId)
            .maybeSingle();

          if (myKyc && (myKyc.statut === 'approved' || myKyc.statut === 'rejected')) {
            all.push({
              id: `kyc-${userId}`,
              type: 'kyc',
              title: myKyc.statut === 'approved' ? 'KYC approuvé' : 'KYC refusé',
              body: myKyc.statut === 'approved'
                ? 'Votre identité a été vérifiée. Votre profil est maintenant visible.'
                : 'Votre vérification d\'identité a été refusée. Veuillez soumettre de nouveaux documents.',
              href: '/dashboard/kyc',
              read: true,
              created_at: myKyc.updated_at,
            });
          }

          const { data: recentMissions } = await supabase
            .from('missions')
            .select('id, titre, created_at')
            .eq('statut', 'ouverte')
            .order('created_at', { ascending: false })
            .limit(3);

          if (recentMissions?.length) {
            for (const m of recentMissions) {
              all.push({
                id: `mission-${m.id}`,
                type: 'mission',
                title: 'Nouvelle mission',
                body: `« ${m.titre} » vient d'être publiée`,
                href: '/dashboard/secretaire',
                read: true,
                created_at: m.created_at,
              });
            }
          }

          const { data: offres } = await supabase
            .from('offres')
            .select('id, statut, entreprise_id, created_at')
            .eq('secretaire_id', userId)
            .eq('statut', 'en_attente')
            .order('created_at', { ascending: false })
            .limit(3);

          if (offres?.length) {
            const entIds = offres.map(o => o.entreprise_id);
            const { data: ents } = await supabase.from('profils').select('id, nom').in('id', entIds);
            const entMap = new Map((ents ?? []).map(e => [e.id, e.nom]));

            for (const o of offres) {
              all.push({
                id: `match-${o.id}`,
                type: 'match',
                title: 'Nouveau match',
                body: `${entMap.get(o.entreprise_id) || 'Entreprise'} vous a proposé une collaboration`,
                href: '/dashboard/secretaire',
                read: false,
                created_at: o.created_at,
              });
            }
          }
        }

        if (role === 'entreprise') {
          const { data: missions } = await supabase
            .from('missions')
            .select('id, titre')
            .eq('entreprise_id', userId);

          if (missions?.length) {
            const missionIds = missions.map(m => m.id);
            const { data: newCands } = await supabase
              .from('candidatures')
              .select('id, mission_id, secretaire_id, created_at')
              .in('mission_id', missionIds)
              .eq('statut', 'en_attente')
              .order('created_at', { ascending: false })
              .limit(3);

            if (newCands?.length) {
              const secIds = [...new Set(newCands.map(c => c.secretaire_id))];
              const { data: secs } = await supabase.from('profils').select('id, nom').in('id', secIds);
              const secMap = new Map((secs ?? []).map(s => [s.id, s.nom]));
              const missionMap = new Map(missions.map(m => [m.id, m.titre]));

              for (const c of newCands) {
                all.push({
                  id: `match-${c.id}`,
                  type: 'match',
                  title: 'Nouvelle candidature',
                  body: `${secMap.get(c.secretaire_id) || 'Secrétaire'} a postulé pour « ${missionMap.get(c.mission_id) || ''} »`,
                  href: '/dashboard/entreprise',
                  read: false,
                  created_at: c.created_at,
                });
              }
            }
          }
        }

        if (!isMounted) return;
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const unreadCount = all.filter(n => !n.read).length;

        if (unreadCount > prevCountRef.current && prevCountRef.current > 0) {
          toast.info(`Vous avez ${unreadCount} nouvelle(s) notification(s)`);
        }
        prevCountRef.current = unreadCount;
        setItems(all);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchInitial();

    // Supabase Realtime subscriptions — all channels pushed to ref BEFORE subscribe
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Messages
    const messagesChannel = supabase
      .channel(`notifications-messages-${userId}-${subId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, async (payload) => {
        const m = payload.new as any;
        if (m.read) return;
        const { data: sender } = await supabase.from('profils').select('nom, role').eq('id', m.sender_id).single();
        setItems(prev => {
          const exists = prev.some(i => i.id === `msg-${m.id}`);
          if (exists) return prev;
          return [{
            id: `msg-${m.id}`,
            type: 'message' as const,
            title: role === 'admin' ? `Message de ${sender?.nom || 'Utilisateur'}` : 'Message de l\'administration',
            body: m.content.length > 60 ? m.content.slice(0, 60) + '...' : m.content,
            href: role === 'admin' ? '/dashboard/admin/messages' : '/dashboard/messages',
            read: false,
            created_at: m.created_at,
          }, ...prev].slice(0, 20);
        });
      });
    channels.push(messagesChannel);

    // Candidatures (pour entreprise et admin)
    if (role === 'entreprise' || role === 'admin') {
      const candsChannel = supabase
        .channel(`notifications-candidatures-${userId}-${subId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'candidatures', filter: `statut=eq.en_attente` }, async (payload) => {
          const c = payload.new as any;
          const { data: mission } = await supabase.from('missions').select('entreprise_id, titre').eq('id', c.mission_id).single();
          if (!mission) return;
          if (role === 'entreprise' && mission.entreprise_id !== userId) return;

          const { data: secretaire } = await supabase.from('profils').select('nom').eq('id', c.secretaire_id).single();
          setItems(prev => [{
            id: `match-${c.id}`,
            type: 'match' as const,
            title: role === 'admin' ? 'Nouveau match' : 'Nouvelle candidature',
            body: `${secretaire?.nom || 'Secrétaire'} a postulé pour « ${mission.titre} »`,
            href: role === 'admin' ? '/dashboard/admin' : '/dashboard/entreprise',
            read: false,
            created_at: c.created_at,
          }, ...prev].slice(0, 20));
        });
      channels.push(candsChannel);
    }

    // Offres (pour secrétaire)
    if (role === 'secretaire') {
      const offresChannel = supabase
        .channel(`notifications-offres-${userId}-${subId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'offres', filter: `secretaire_id=eq.${userId}` }, async (payload) => {
          const o = payload.new as any;
          const { data: entreprise } = await supabase.from('profils').select('nom').eq('id', o.entreprise_id).single();
          setItems(prev => [{
            id: `match-${o.id}`,
            type: 'match' as const,
            title: 'Nouveau match',
            body: `${entreprise?.nom || 'Entreprise'} vous a proposé une collaboration`,
            href: '/dashboard/secretaire',
            read: false,
            created_at: o.created_at,
          }, ...prev].slice(0, 20));
        });
      channels.push(offresChannel);
    }

    // KYC (pour admin et secrétaire)
    if (role === 'admin') {
      const kycChannel = supabase
        .channel(`notifications-kyc-admin-${subId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyc_verifications', filter: 'statut=eq.pending' }, async (payload) => {
          const k = payload.new as any;
          const { data: user } = await supabase.from('profils').select('nom').eq('id', k.user_id).single();
          setItems(prev => [{
            id: `kyc-${k.user_id}`,
            type: 'kyc' as const,
            title: 'Nouvelle demande KYC',
            body: `${user?.nom || 'Utilisateur'} a soumis ses documents`,
            href: '/dashboard/admin/kyc',
            read: false,
            created_at: k.created_at,
          }, ...prev].slice(0, 20));
        });
      channels.push(kycChannel);
    } else if (role === 'secretaire') {
      const kycChannel = supabase
        .channel(`notifications-kyc-${userId}-${subId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyc_verifications', filter: `user_id=eq.${userId}` }, async (payload) => {
          const k = payload.new as any;
          if (k.statut === 'approved' || k.statut === 'rejected') {
            setItems(prev => [{
              id: `kyc-${userId}`,
              type: 'kyc' as const,
              title: k.statut === 'approved' ? 'KYC approuvé' : 'KYC refusé',
              body: k.statut === 'approved'
                ? 'Votre identité a été vérifiée. Votre profil est maintenant visible.'
                : 'Votre vérification d\'identité a été refusée. Veuillez soumettre de nouveaux documents.',
              href: '/dashboard/kyc',
              read: true,
              created_at: k.updated_at,
            }, ...prev].slice(0, 20));
          }
        });
      channels.push(kycChannel);
    }

    channelsRef.current = channels;
    channels.forEach(ch => ch.subscribe());

    return () => {
      isMounted = false;
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [userId, role]);

  const unreadCount = items.filter(n => !n.read).length;

  const markAllRead = async () => {
    const msgItems = items.filter(n => n.type === 'message' && !n.read);
    if (msgItems.length > 0) {
      const ids = msgItems.map(n => parseInt(n.id.replace('msg-', '')));
      if (!isNaN(ids[0])) {
        try {
          await supabase.from('messages').update({ read: true }).in('id', ids);
          setItems(prev => prev.map(n => ({ ...n, read: true })));
        } catch { toast.error("Erreur lors de la mise à jour des notifications."); }
      }
    } else {
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-900 text-sm tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition">
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400 font-medium">Aucune notification</p>
            ) : (
              items.slice(0, 12).map(item => {
                const style = TYPE_STYLES[item.type] || TYPE_STYLES.message;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 border-b border-slate-50 hover:bg-blue-50/40 transition ${!item.read ? 'bg-blue-50/20' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${style.bg} ${style.text}`}>
                        {style.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold ${!item.read ? 'text-slate-900' : 'text-slate-600'}`}>{item.title}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.body}</p>
                        <p className="text-[10px] text-slate-300 mt-1 font-medium">
                          {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!item.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href={role === 'admin' ? '/dashboard/admin/messages' : '/dashboard/messages'}
            onClick={() => setOpen(false)}
            className="block p-3 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition"
          >
            Voir toutes les discussions →
          </Link>
        </div>
      )}
    </div>
  );
}