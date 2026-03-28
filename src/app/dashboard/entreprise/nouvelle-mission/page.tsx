'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NouvelleMission() {
  const router = useRouter();
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // 1. Récupérer l'utilisateur connecté (l'entreprise)
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      setErrorMsg("Vous devez être connecté pour publier une mission.");
      setLoading(false);
      return;
    }

    // 2. Insérer la mission dans la base de données
    const { error: insertError } = await supabase
      .from('missions')
      .insert([
        {
          entreprise_id: session.user.id,
          titre: titre,
          description: description,
          date_debut: dateDebut,
          date_fin: dateFin,
          // Le statut passera automatiquement à 'ouverte' grâce à notre base de données
        }
      ]);

    if (insertError) {
      setErrorMsg(insertError.message);
      setLoading(false);
    } else {
      // 3. Succès ! Redirection vers le tableau de bord
      router.push('/dashboard/entreprise');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        
        {/* En-tête avec bouton retour */}
        <header className="mb-8 flex items-center gap-4">
          <Link href="/dashboard/entreprise" className="text-blue-600 hover:underline font-medium">
            &larr; Retour
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Publier une nouvelle mission</h1>
        </header>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Titre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la mission</label>
              <input 
                type="text" 
                required 
                value={titre} 
                onChange={(e) => setTitre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500"
                placeholder="Ex: Saisie de 500 factures sous Excel"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description détaillée</label>
              <textarea 
                required 
                rows={5}
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500"
                placeholder="Détaillez les tâches, les compétences requises, les horaires éventuels..."
              />
            </div>

            {/* Dates (Début et Fin sur la même ligne) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input 
                  type="date" 
                  required 
                  value={dateDebut} 
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input 
                  type="date" 
                  required 
                  value={dateFin} 
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Bouton de soumission */}
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300"
              >
                {loading ? 'Publication en cours...' : 'Publier la mission'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}