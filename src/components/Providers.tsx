'use client';

import { useState, useEffect } from 'react';
import { KeyboardProvider } from '@/lib/KeyboardContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import CommandPalette from '@/components/CommandPalette';
import BottomNav from '@/components/BottomNav';
import Onboarding from '@/components/Onboarding';
import PWAInit from '@/components/PWAInit';
import ErrorBoundary from '@/components/ErrorBoundary';

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

  // Rendu conditionnel : la palette se démonte à la fermeture, ce qui remet
  // à zéro sa saisie et ses résultats sans effet de réinitialisation.
  if (!open) return null;

  return <CommandPalette open onClose={() => setOpen(false)} />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardProvider>
      <SessionTimeoutWrapper>
        {/* PWAInit enregistre le service worker : sans lui, ni le mode hors
            ligne ni les notifications push ne pouvaient fonctionner, alors que
            le manifeste, /offline et public/sw.js existaient déjà. */}
        <PWAInit />
        <CommandPaletteWrapper />
        <Onboarding />
        {/* Une erreur de rendu affichait jusqu'ici une page blanche : le
            périmètre est limité au contenu pour que la navigation reste
            utilisable en cas de plantage d'une page. */}
        <ErrorBoundary>{children}</ErrorBoundary>
        <BottomNav />
      </SessionTimeoutWrapper>
    </KeyboardProvider>
  );
}
