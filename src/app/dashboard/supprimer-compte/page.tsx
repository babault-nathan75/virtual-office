'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';

export default function SupprimerCompte() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation !== 'SUPPRIMER') return;

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Vous devez être connecté.');
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    try {
      // Supprimer les données liées
      await supabase.from('candidatures').delete().eq('secretaire_id', userId);
      await supabase.from('offres').delete().eq('entreprise_id', userId);
      await supabase.from('offres').delete().eq('secretaire_id', userId);
      await supabase.from('missions').delete().eq('entreprise_id', userId);
      await supabase.from('profils_secretaires').delete().eq('id', userId);

      // Supprimer l'avatar du storage
      const { data: files } = await supabase.storage.from('avatars').list(userId);
      if (files && files.length) {
        await supabase.storage
          .from('avatars')
          .remove(files.map(f => `${userId}/${f.name}`));
      }

      // Supprimer le profil
      await supabase.from('profils').delete().eq('id', userId);

      // Déconnexion
      await supabase.auth.signOut();
      toast.success('Compte supprimé avec succès.');
      router.push('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erreur lors de la suppression : ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-lg mx-auto">
        <Link
          href="/profile"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          &larr; Retour à mon profil
        </Link>

        <div className="bg-white rounded-3xl border border-red-100 shadow-lg overflow-hidden">
          <div className="bg-red-50 p-6 border-b border-red-100 text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <h1 className="text-2xl font-black text-red-900">Supprimer mon compte</h1>
            <p className="text-sm text-red-700 font-medium mt-2">
              Cette action est <b>irréversible</b>. Toutes vos données seront définitivement supprimées.
            </p>
          </div>

          <form onSubmit={handleDelete} className="p-6 space-y-5">
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <p className="text-sm text-red-900 font-bold mb-3">Ce qui sera supprimé :</p>
              <ul className="text-sm text-red-800 space-y-1.5 font-medium">
                <li>• Votre profil et toutes vos informations</li>
                <li>• Vos candidatures et offres</li>
                <li>• Vos missions publiées</li>
                <li>• Votre photo de profil</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Tapez <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">SUPPRIMER</span> pour confirmer
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full rounded-xl border border-red-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading || confirmation !== 'SUPPRIMER'}
              className="w-full py-3.5 rounded-full font-extrabold tracking-tight transition bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Suppression en cours...' : 'Supprimer définitivement mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
