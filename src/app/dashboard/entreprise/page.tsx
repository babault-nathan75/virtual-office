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
  photo_url: string | null;
  bio: string | null;
  ville: string | null;
  disponibilite: string | null;
  niveau_etudes: string | null;
  langues: string[] | null;
  outils: string[] | null;
  soft_skills: string[] | null;
  competences: string[];
  annees_experience: number;
} | null;

const DISPO_LABEL: Record<string, string> = {
  immediate: 'Immédiate',
  semaine: 'Sous une semaine',
  mois: 'Sous un mois',
  a_discuter: 'À discuter',
};

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

  const refuserCandidature = async (candidatureId: number) => {
    const { error } = await supabase.from('candidatures').update({ statut: 'refusee' }).eq('id', candidatureId);
    if (error) return alert(error.message);
    window.location.reload();
  };

  const proposerOffre = async (candidatureId: number, secretaireId: string, missionId: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('Vous devez être connecté.');

    const { error: offErr } = await supabase.from('offres').insert({
      entreprise_id: session.user.id,
      secretaire_id: secretaireId,
      mission_id: missionId,
      candidature_id: candidatureId,
      statut: 'en_attente',
    });

    if (offErr) {
      if (offErr.code === '23505') {
        return alert('Une offre est déjà en attente pour cette secrétaire.');
      }
      return alert('Erreur : ' + offErr.message);
    }

    // La candidature est marquée comme acceptée, mais la mission reste ouverte
    // tant que l'admin n'a pas conclu l'offre (le trigger fermera la mission à ce moment-là)
    await supabase.from('candidatures').update({ statut: 'acceptee' }).eq('id', candidatureId);
    window.location.reload();
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
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link href="/dashboard/entreprise/chercher" className="bg-white border-2 border-blue-200 text-blue-700 px-6 py-3 rounded-xl font-bold hover:border-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2">
              🔍 Trouver une secrétaire
            </Link>
            <Link href="/dashboard/entreprise/nouvelle-mission" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2">
              <span>+</span> Publier une mission
            </Link>
          </div>
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
                          <div key={cand.id} className="flex flex-col gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-800 truncate">{secretaire.nom}</p>
                                <button onClick={() => ouvrirProfil(secretaire.id, secretaire.nom)} className="text-blue-600 text-xs font-bold hover:underline">Voir le profil</button>
                              </div>
                              {cand.statut !== 'en_attente' && (
                                <span className={`text-[10px] font-black px-2 py-1 rounded-md whitespace-nowrap ${
                                  cand.statut === 'acceptee'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {cand.statut === 'acceptee' ? '✓ Offre envoyée' : 'Refusée'}
                                </span>
                              )}
                            </div>

                            {cand.statut === 'en_attente' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => proposerOffre(cand.id, secretaire.id, mission.id)}
                                  className="flex-1 bg-blue-600 text-white text-xs font-extrabold tracking-tight px-3 py-2 rounded-lg hover:bg-blue-700 transition"
                                >
                                  Proposer une offre
                                </button>
                                <button
                                  onClick={() => refuserCandidature(cand.id)}
                                  className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-100 transition"
                                >
                                  Refuser
                                </button>
                              </div>
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
            <div className="p-8 max-h-[75vh] overflow-y-auto">
              {loadingDetails ? <p className="text-center text-gray-500">Chargement...</p> : detailsProfil ? (
                <div className="space-y-6">

                  {/* Photo + bio */}
                  <div className="flex gap-4 items-start">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-3xl">
                      {detailsProfil.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={detailsProfil.photo_url} alt="Photo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-300">👤</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {detailsProfil.bio ? (
                        <p className="text-sm text-slate-700 leading-relaxed italic">{detailsProfil.bio}</p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Aucune bio renseignée.</p>
                      )}
                    </div>
                  </div>

                  {/* Mini-fiche infos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Ville</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{detailsProfil.ville || '—'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Disponibilité</p>
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {detailsProfil.disponibilite ? DISPO_LABEL[detailsProfil.disponibilite] ?? detailsProfil.disponibilite : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Niveau d&apos;études</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{detailsProfil.niveau_etudes || '—'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Expérience</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{detailsProfil.annees_experience} ans</p>
                    </div>
                  </div>

                  {/* Tarif négocié par la plateforme */}
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-1">💼 Tarif</p>
                    <p className="text-sm text-blue-900 font-medium leading-relaxed">
                      Le tarif de la prestation est fixé par la plateforme lors de la mise en relation,
                      en fonction du volume et du type de mission.
                    </p>
                  </div>

                  {/* Compétences libres */}
                  {detailsProfil.competences?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Compétences</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProfil.competences.map((c, i) => (
                          <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outils */}
                  {(detailsProfil.outils?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outils maîtrisés</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProfil.outils!.map((o, i) => (
                          <span key={i} className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soft skills */}
                  {(detailsProfil.soft_skills?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Soft skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProfil.soft_skills!.map((s, i) => (
                          <span key={i} className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Langues */}
                  {(detailsProfil.langues?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Langues</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProfil.langues!.map((l, i) => (
                          <span key={i} className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-bold">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidentialité — coordonnées masquées */}
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      🔒 Pour des raisons de confidentialité, le numéro de téléphone et les coordonnées
                      personnelles restent <b>masqués</b>. Acceptez la candidature pour déclencher la mise en relation par la plateforme.
                    </p>
                  </div>
                </div>
              ) : <p className="text-center text-gray-400 italic text-sm">Ce profil n&apos;est pas encore complété.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}