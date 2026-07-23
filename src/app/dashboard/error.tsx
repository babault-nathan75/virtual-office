'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg max-w-md w-full text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-black text-slate-900 mb-2">Une erreur est survenue</h2>
        <p className="text-sm text-slate-500 font-medium mb-6">
          {error.message || 'Une erreur inattendue s\'est produite.'}
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
