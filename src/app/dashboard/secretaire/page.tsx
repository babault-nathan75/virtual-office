'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut: string;
  profils: { nom: string } | null;
};

type Candidature = {
  mission_id: number;
  statut: string;
  missions: { titre: string } | null;
};

export default function DashboardSecretaire() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mesCandidatures, setMesCandidatures] = useState<Candidature[]>([]);
  const [completion, setCompletion] = useState(0); // 📊 État pour la progression
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }

      // 1. Récupérer le nom
      const { data: profil } = await supabase.from('profils').select('nom').eq('id', session.user.id).single();
      if (profil) setNom(profil.nom);

      // 2. Récupérer les missions ouvertes
      const { data: missionsOuvertes } = await supabase
        .from('missions')
        .select('id, titre, description, date_debut, profils(nom)')
        .eq('statut', 'ouverte')
        .order('created_at', { ascending: false });

      // 3. Récupérer les candidatures
      const { data: candidatures } = await supabase
        .from('candidatures')
        .select('mission_id, statut, missions(titre)')
        .eq('secretaire_id', session.user.id);

      // 4. Calculer la complétion du profil métier
      const { data: métier } = await supabase
        .from('profils_secretaires')
        .select('competences, annees_experience, tarif_journalier')
        .eq('id', session.user.id)
        .single();

      if (métier) {
        let score = 0;
        if (métier.competences && métier.competences.length > 0) score += 34;
        if (métier.annees_experience > 0) score += 33;
        if (métier.tarif_journalier > 0) score += 33;
        setCompletion(score);
      }

      if (missionsOuvertes) setMissions(missionsOuvertes as any);
      if (candidatures) setMesCandidatures(candidatures as any);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  const postuler = async (missionId: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('candidatures').insert([
      { mission_id: missionId, secretaire_id: session.user.id, statut: 'en_attente' }
    ]);
    if (!error) window.location.reload();
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Profil Progression */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800">Bonjour, {nom} 👋</h1>
            <div className="mt-4 max-w-xs">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-blue-700">Profil complété à {completion}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${completion}%` }}
                ></div>
              </div>
              {completion < 100 && (
                <p className="text-[10px] text-gray-500 mt-1 italic">
                  Complétez votre profil pour rassurer les entreprises.
                </p>
              )}
            </div>
          </div>
          
          <Link 
            href="/dashboard/secretaire/profil" 
            className="w-full md:w-auto text-center bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100"
          >
            ⚙️ Modifier mon profil
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Missions */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-gray-800">🚀 Missions pour vous</h2>
            {missions.map((m) => {
              const dejaPostule = mesCandidatures.some(c => c.mission_id === m.id);
              return (
                <div key={m.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-blue-900">{m.titre}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">
                      {m.profils?.nom}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6 line-clamp-2">{m.description}</p>
                  <button 
                    onClick={() => postuler(m.id)}
                    disabled={dejaPostule}
                    className={`w-full py-3 rounded-lg font-bold transition ${
                      dejaPostule ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    {dejaPostule ? '✓ Candidature envoyée' : 'Postuler maintenant'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Candidatures */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">📊 Suivi</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              {mesCandidatures.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center">Aucune activité.</p>
              ) : (
                <div className="space-y-4">
                  {mesCandidatures.map((c, idx) => (
                    <div key={idx} className="flex flex-col border-b border-gray-50 pb-3 last:border-0">
                      <span className="text-sm font-bold text-gray-800 truncate">{c.missions?.titre}</span>
                      <span className={`text-[10px] font-bold uppercase mt-1 w-fit px-2 py-0.5 rounded-full ${
                        c.statut === 'acceptee' ? 'bg-green-100 text-green-700' :
                        c.statut === 'refusee' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {c.statut.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}