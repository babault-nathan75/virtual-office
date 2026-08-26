'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { clearCachedRole } from '@/lib/roleStore';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useSessionTimeout() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      clearCachedRole();
      // Navigation côté client puis `refresh()` : les composants serveur
      // doivent relire les cookies pour se rendre en état déconnecté. Une
      // affectation de `location.href` rechargeait toute l'application.
      router.replace('/connexion?expired=1');
      router.refresh();
    }, TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);
}
