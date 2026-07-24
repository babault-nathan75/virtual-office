'use client';

export function trackEvent(name: string, props?: Record<string, string>) {
  if (typeof window === 'undefined') return;

  // Plausible Analytics
  if (window.plausible) {
    window.plausible(name, { props });
  }

  // Vercel Analytics fallback
  try {
    window.dispatchEvent(new CustomEvent('vercel-analytics', { detail: { name, props } }));
  } catch {}
}

declare global {
  interface Window {
    plausible?: (name: string, options?: { props?: Record<string, string> }) => void;
  }
}
