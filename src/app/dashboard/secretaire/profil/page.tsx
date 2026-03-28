'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilSecretaire() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Champs du formulaire
  const [competences, setCompetences] = useState('');
  const [experience, setExperience] = useState('');
  const [tarif, setTarif] = useState('');

  useEffect(() => {
    const fetchProfil = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }

      const { data } = await supabase
        .from('profils_secretaires')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setCompetences(data.competences ? data.competences.join(', ') : '');
        setExperience(data.annees_experience?.toString() || '');
        setTarif(data.tarif_journalier?.toString() || '');
      }
      setFetching(false);
    };
    fetchProfil();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const competencesArray = competences.split(',').map(c => c.trim()).filter(c => c !== '');

    const { error } = await supabase
      .from('profils_secretaires')
      .upsert({
        id: session.user.id,
        competences: competencesArray,
        annees_experience: parseInt(experience) || 0,
        tarif_journalier: parseFloat(tarif) || 0,
      });

    if (error) {
      setMessage({ text: "Erreur : " + error.message, type: 'error' });
    } else {
      setMessage({ text: "✅ Profil mis à jour ! Redirection...", type: 'success' });
      // On attend 1.5s pour que l'utilisateur voit le message de succès
      setTimeout(() => router.push('/dashboard/secretaire'), 1500);
    }
    setLoading(false);
  };

  if (fetching) return <div className="p-12 text-center text-gray-500">Chargement de vos informations...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Navigation de retour */}
        <Link 
          href="/dashboard/secretaire" 
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour au tableau de bord
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 p-8 text-white">
            <h1 className="text-2xl font-bold">Complétez votre profil métier</h1>
            <p className="text-blue-100 text-sm mt-2">
              Un profil détaillé multiplie par 3 vos chances d'être sélectionnée.
            </p>
          </div>

          <div className="p-8">
            {message.text && (
              <div className={`mb-8 p-4 rounded-xl text-sm font-bold text-center animate-bounce ${
                message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* COMPÉTENCES */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Vos expertises (séparées par des virgules)
                </label>
                <textarea 
                  rows={3}
                  value={competences} 
                  onChange={(e) => setCompetences(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-300"
                  placeholder="Ex: Facturation, Accueil téléphonique, Gestion d'agenda, Excel avancé..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* EXPÉRIENCE */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Années d'expérience</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0"
                      value={experience} 
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 transition"
                      placeholder="Ex: 5"
                    />
                    <span className="absolute right-4 top-4 text-gray-400 text-sm">ans</span>
                  </div>
                </div>

                {/* TARIF */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tarif journalier (FCFA)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0"
                      value={tarif} 
                      onChange={(e) => setTarif(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 transition"
                      placeholder="Ex: 20000"
                    />
                    <span className="absolute right-4 top-4 text-gray-400 text-sm font-bold">CFA</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-extrabold py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3 border-2 border-white border-t-transparent rounded-full" />
                      Enregistrement...
                    </span>
                  ) : 'Mettre à jour mon profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}