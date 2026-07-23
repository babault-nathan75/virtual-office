'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

let globalId = 0;
let listeners: ((toasts: Toast[]) => void)[] = [];
let toastsState: Toast[] = [];

function notify(message: string, type: ToastType = 'info') {
  const id = ++globalId;
  toastsState = [...toastsState, { id, message, type }];
  listeners.forEach(l => l(toastsState));
  setTimeout(() => {
    toastsState = toastsState.filter(t => t.id !== id);
    listeners.forEach(l => l(toastsState));
  }, 4000);
}

export const toast = {
  success: (msg: string) => notify(msg, 'success'),
  error: (msg: string) => notify(msg, 'error'),
  info: (msg: string) => notify(msg, 'info'),
};

const colorMap: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter(l => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${colorMap[t.type]} px-5 py-3 rounded-xl font-bold text-sm shadow-lg animate-[slideIn_0.3s_ease-out]`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
