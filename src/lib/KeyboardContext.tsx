'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ShortcutAction = 'search' | 'newMessage' | 'newMission' | 'messages' | 'help' | 'escape' | 'send';

const KeyboardContext = createContext<{
  registerShortcut: (action: ShortcutAction, handler: () => void) => void;
  unregisterShortcut: (action: ShortcutAction) => void;
}>({ registerShortcut: () => {}, unregisterShortcut: () => {} });

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [handlers] = useState(new Map<ShortcutAction, () => void>());

  const registerShortcut = useCallback((action: ShortcutAction, handler: () => void) => {
    handlers.set(action, handler);
  }, [handlers]);

  const unregisterShortcut = useCallback((action: ShortcutAction) => {
    handlers.delete(action);
  }, [handlers]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === 'k') {
        e.preventDefault();
        handlers.get('search')?.();
      }
      if (isMeta && e.key === 'n') {
        e.preventDefault();
        handlers.get('newMessage')?.();
      }
      if (isMeta && e.key === 'e') {
        e.preventDefault();
        handlers.get('newMission')?.();
      }
      if (isMeta && e.key === 'm') {
        e.preventDefault();
        handlers.get('messages')?.();
      }
      if (e.key === '?' && !isMeta && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        handlers.get('help')?.();
      }
      if (e.key === 'Escape') {
        handlers.get('escape')?.();
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handlers]);

  return (
    <KeyboardContext.Provider value={{ registerShortcut, unregisterShortcut }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export const useKeyboard = () => useContext(KeyboardContext);
