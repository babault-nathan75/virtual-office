'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Secretaire = { id: string; nom: string; };

type Candidature = {
  id: number;
  statut: string;
  profils: Secretaire | Secretaire[] | null;
};

type Mission = {
  id: number;
  titre: string;
  statut: string;
  created_at: string;
  candidatures: Candidature[];
};

type DetailsProfil = {
  competences: string[];
  annees_experience: number;
  tarif_journalier: number;
} | null;

export default function DashboardEntreprise() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ total: 0, enAttente: 0, enCours: 0 });

  // Modale
  const [selectedSecretaire, setSelectedSecretaire] = useState<{id: string, nom: string} | null>(null);
  const [detailsProfil, setDetailsProfil] = useState<DetailsProfil>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchDonnees = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }
      
      const { data: userData } = await supabase.from('profils').select('nom').eq('id', session.user.id).single();
      if (userData) setNom(userData.nom);

      const { data: missionsData } = await supabase
        .from('missions')
        .select(`id, titre, statut, created_at, candidatures ( id, statut, profils (id, nom) )`)
        .eq('entreprise_id', session.user.id)
        .order('created_at', { ascending: false });

      if (missionsData) {
        setMissions(missionsData as any);
        // Calcul des stats
        const total = missionsData.length;
        const enAttente = missionsData.reduce((acc, m) => acc + m.candidatures.filter(c => c.statut === 'en_attente').length, 0);
        const enCours = missionsData.filter(m => m.statut === 'en_cours').length;
        setStats({ total, enAttente, enCours });
      }
      setLoading(false);
    };
    fetchDonnees();
  }, [router]);

  const gererCandidature = async (candidatureId: number, nouveauStatut: string, missionId: number) => {
    const { error } = await supabase.from('candidatures').update({ statut: nouveauStatut }).eq('id', candidatureId);
    if (error) return alert(error.message);

    if (nouveauStatut === 'acceptee') {
      await supabase.from('missions').update({ statut: 'en_cours' }).eq('id', missionId);
    }
    window.location.reload(); // Rechargement simple pour mettre à jour l'UI et les stats
  };

  const ouvrirProfil = async (secretaireId: string, secretaireNom: string) => {
    setSelectedSecretaire({ id: secretaireId, nom: secretaireNom });
    setLoadingDetails(true);
    const { data } = await supabase.from('profils_secretaires').select('*').eq('id', secretaireId).single();
    if (data) setDetailsProfil(data);
    setLoadingDetails(false);
  };

  if (loading) return <div className="p-12 text-center text-gray-500">Préparation de votre espace...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER DYNAMIQUE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Espace Entreprise — {nom}</h1>
            <p className="text-gray-500">Gérez vos missions et vos recrutements en un coup d'œil.</p>
          </div>
          <Link href="/dashboard/entreprise/nouvelle-mission" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition flex items-center gap-2">
            <span>+</span> Publier une mission
          </Link>
        </div>

        {/* SECTION STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500 uppercase">Missions Publiées</p>
            <p className="text-3xl font-black text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-yellow-400">
            <p className="text-sm font-medium text-gray-500 uppercase">Candidats à trier</p>
            <p className="text-3xl font-black text-yellow-600">{stats.enAttente}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-400">
            <p className="text-sm font-medium text-gray-500 uppercase">Collaborations actives</p>
            <p className="text-3xl font-black text-green-600">{stats.enCours}</p>
          </div>
        </div>

        {/* LISTE DES MISSIONS */}
        <h2 className="text-xl font-bold text-gray-800 mb-6">Vos recrutements en cours</h2>
        
        {missions.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500">Vous n'avez pas encore publié de mission.</p>
            <Link href="/dashboard/entreprise/nouvelle-mission" className="text-blue-600 font-bold mt-2 block">Lancer mon premier recrutement &rarr;</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {missions.map((mission) => (
              <div key={mission.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{mission.titre}</h3>
                    <p className="text-xs text-gray-400 mt-1">Publiée le {new Date(mission.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${mission.statut === 'ouverte' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {mission.statut.toUpperCase()}
                  </span>
                </div>

                <div className="p-6">
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Candidatures reçues</h4>
                  {mission.candidatures.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">En attente de candidats...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mission.candidatures.map((cand) => {
                        const secretaire = Array.isArray(cand.profils) ? cand.profils[0] : cand.profils;
                        if (!secretaire) return null;
                        return (
                          <div key={cand.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition">
                            <div>
                              <p className="font-bold text-gray-800">{secretaire.nom}</p>
                              <button onClick={() => ouvrirProfil(secretaire.id, secretaire.nom)} className="text-blue-600 text-xs font-bold hover:underline">Voir le profil</button>
                            </div>
                            
                            {cand.statut === 'en_attente' ? (
                              <div className="flex gap-2">
                                <button onClick={() => gererCandidature(cand.id, 'acceptee', mission.id)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">✓</button>
                                <button onClick={() => gererCandidature(cand.id, 'refusee', mission.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">✕</button>
                              </div>
                            ) : (
                              <span className={`text-[10px] font-black px-2 py-1 rounded-md ${cand.statut === 'acceptee' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {cand.statut.toUpperCase()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALE DU PROFIL (Inchangée mais stylisée) */}
      {selectedSecretaire && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Profil de {selectedSecretaire.nom}</h3>
              <button onClick={() => setSelectedSecretaire(null)} className="text-gray-400 hover:text-black text-2xl font-light">&times;</button>
            </div>
            <div className="p-8">
              {loadingDetails ? <p className="text-center text-gray-500">Chargement...</p> : detailsProfil ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl">
                    <div className="text-center">
                      <p className="text-[10px] text-blue-400 uppercase font-bold">Expérience</p>
                      <p className="text-xl font-black text-blue-900">{detailsProfil.annees_experience} ans</p>
                    </div>
                    <div className="h-8 w-[1px] bg-blue-200"></div>
                    <div className="text-center">
                      <p className="text-[10px] text-blue-400 uppercase font-bold">Tarif Journalier</p>
                      <p className="text-xl font-black text-blue-900">{detailsProfil.tarif_journalier} <small className="text-xs font-normal">CFA</small></p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-3">Compétences</p>
                    <div className="flex flex-wrap gap-2">
                      {detailsProfil.competences?.map((c, i) => <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium">{c}</span>)}
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center">
                    <p className="text-xs text-yellow-800 leading-relaxed italic">Acceptez sa candidature pour débloquer son numéro de téléphone et son email.</p>
                  </div>
                </div>
              ) : <p className="text-center text-gray-400 italic text-sm">Ce profil n'est pas encore complété.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}