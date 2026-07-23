'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export type Session = {
  user: User;
  role: string | null;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession) {
        setLoading(false);
        return;
      }

      const { data: profil } = await supabase
        .from('profils')
        .select('role')
        .eq('id', supabaseSession.user.id)
        .single();

      setSession({
        user: supabaseSession.user,
        role: profil?.role ?? null,
      });
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
        } else if (newSession) {
          const { data: profil } = await supabase
            .from('profils')
            .select('role')
            .eq('id', newSession.user.id)
            .single();
          setSession({
            user: newSession.user,
            role: profil?.role ?? null,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
