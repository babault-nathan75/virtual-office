import Link from '@/components/Link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl mx-auto mb-4">📡</div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Hors ligne</h1>
        <p className="text-slate-500 font-medium text-sm mb-6">
          Vous n&apos;avez pas de connexion Internet. Veuillez vérifier votre réseau.
        </p>
        <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
          Réessayer
        </Link>
      </div>
    </div>
  );
}
