'use client';

import { useState, useEffect } from 'react';
import { KeyboardProvider } from '@/lib/KeyboardContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import CommandPalette from '@/components/CommandPalette';
import BottomNav from '@/components/BottomNav';

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  return <>{children}</>;
}

function CommandPaletteWrapper() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(prev => !prev);
    window.addEventListener('toggle-command-palette', handler);
    return () => window.removeEventListener('toggle-command-palette', handler);
  }, []);

  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardProvider>
      <SessionTimeoutWrapper>
        <CommandPaletteWrapper />
        {children}
        <BottomNav />
      </SessionTimeoutWrapper>
    </KeyboardProvider>
  );
}
