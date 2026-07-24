'use client';

import { useEffect, ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };

export default function ErrorBoundary({ children, fallback }: Props) {
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      event.preventDefault();
      console.error('[ErrorBoundary]', event.error);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  return (
    <div suppressHydrationWarning>
      {children}
    </div>
  );
}
