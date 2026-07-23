'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';

type Props = {
  userId: string;
  role: 'entreprise' | 'secretaire' | 'admin';
};

export default function NotificationBell({ userId, role }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetchCount = async () => {
      let c = 0;

      // Notifications de missions/offres
      if (role === 'entreprise') {
        const { data } = await supabase
          .from('missions')
          .select('candidatures!inner(id)')
          .eq('entreprise_id', userId)
          .eq('candidatures.statut', 'en_attente');
        if (data) {
          c = data.reduce((acc, m) => acc + ((m as any).candidatures?.length ?? 0), 0);
        }
      } else if (role === 'secretaire') {
        const { data } = await supabase
          .from('offres')
          .select('id')
          .eq('secretaire_id', userId)
          .eq('statut', 'en_attente');
        c = data?.length ?? 0;
      }

      // Messages non lus
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);

      c += unreadCount ?? 0;

      setCount(prev => {
        if (c > prev && prev > 0) {
          if ((unreadCount ?? 0) > 0) {
            toast.info(`Vous avez ${unreadCount} nouveau(x) message(s)`);
          } else if (c > 0) {
            toast.info(role === 'entreprise'
              ? `Vous avez ${c} nouvelle(s) notification(s)`
              : `Vous avez ${c} nouvelle(s) notification(s)`);
          }
        }
        return c;
      });
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15_000);
    return () => clearInterval(interval);
  }, [userId, role]);

  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-lg">
      {count > 99 ? '99+' : count}
    </span>
  );
}
