'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  /*
   * Rejouer le segment sans recharger la page.
   *
   * Le bouton « Recharger » appelait `window.location.reload()` : rechargement
   * complet, perte de l'état de l'application et nouvelle exécution de tout le
   * JavaScript, pour un problème qui ne concerne souvent qu'un segment de
   * route. `router.refresh()` redemande les données au serveur, puis `reset()`
   * réinitialise la frontière d'erreur — les deux dans une transition, pour
   * que le bouton puisse indiquer qu'il travaille.
   */
  const retry = () => {
    startRetry(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h2>
        <p className="text-sm text-slate-500 mb-6">{error.message || 'Erreur inattendue'}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={retry}
            disabled={retrying}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
          >
            {retrying ? 'Nouvelle tentative…' : 'Réessayer'}
          </button>
        </div>
      </div>
    </div>
  );
}
