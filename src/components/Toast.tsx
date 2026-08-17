'use client';

import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
};

const MAX_VISIBLE = 3;

let globalId = 0;
let listeners: ((toasts: Toast[]) => void)[] = [];
let toastsState: Toast[] = [];

function notify(message: string, type: ToastType = 'info', action?: { label: string; onClick: () => void }) {
  const id = ++globalId;
  toastsState = [...toastsState.slice(-(MAX_VISIBLE - 1)), { id, message, type, action }];
  listeners.forEach(l => l(toastsState));
  setTimeout(() => {
    toastsState = toastsState.filter(t => t.id !== id);
    listeners.forEach(l => l(toastsState));
  }, action ? 6000 : 4500);
}

function dismiss(id: number) {
  toastsState = toastsState.filter(t => t.id !== id);
  listeners.forEach(l => l(toastsState));
}

export const toast = {
  success: (msg: string) => notify(msg, 'success'),
  error: (msg: string) => notify(msg, 'error'),
  info: (msg: string) => notify(msg, 'info'),
  warning: (msg: string) => notify(msg, 'warning'),
  undo: (msg: string, onUndo: () => void) => notify(msg, 'info', { label: 'Annuler', onClick: onUndo }),
};

const iconMap: Record<ToastType, React.ReactElement> = {
  success: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
  warning: 'bg-amber-500',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    listeners.push(setToasts);
    return () => { listeners = listeners.filter(l => l !== setToasts); };
  }, []);

  const handlePause = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
  }, []);

  const handleResume = useCallback((id: number, duration = 3000) => {
    handlePause(id);
    const timer = setTimeout(() => { dismiss(id); timers.current.delete(id); }, duration);
    timers.current.set(id, timer);
  }, [handlePause]);

  const handleDismiss = useCallback((id: number) => {
    handlePause(id);
    dismiss(id);
    timers.current.delete(id);
  }, [handlePause]);

  useEffect(() => {
    // La Map est capturée dans une variable locale : lire `timers.current` au
    // moment du nettoyage viserait potentiellement une autre valeur que celle
    // observée à l'exécution de l'effet.
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach(t => clearTimeout(t));
      pendingTimers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    /*
     * Sur mobile, les toasts étaient ancrés en bas à droite et passaient sous
     * la barre de navigation fixe : le message et son bouton « Annuler »
     * devenaient invisibles. Ils sont désormais pleine largeur au-dessus de la
     * barre, et reprennent leur position d'origine à partir de `sm`.
     */
    <div
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-[100] flex flex-col gap-2 pointer-events-none sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${bgMap[t.type]} text-white pl-4 pr-2 py-3 rounded-xl font-semibold text-sm shadow-2xl flex items-center gap-3 toast-enter pointer-events-auto`}
          onMouseEnter={() => handlePause(t.id)}
          onMouseLeave={() => handleResume(t.id)}
        >
          {iconMap[t.type]}
          <span className="flex-1 min-w-0">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => { t.action!.onClick(); handleDismiss(t.id); }}
              className="shrink-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDismiss(t.id)}
            className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
