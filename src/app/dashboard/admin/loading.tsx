export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">Chargement de la console...</p>
      </div>
    </div>
  );
}
