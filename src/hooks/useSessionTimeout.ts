'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useSessionTimeout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = '/connexion?expired=1';
    }, TIMEOUT_MS);
  }, []);

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
