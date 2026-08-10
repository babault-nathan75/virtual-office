'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import NotificationBell from '@/components/NotificationBell';
import { proposerOffreAction, refuserCandidatureAction, EntrepriseDashboardData } from '@/lib/data/entreprise-client';

type Props = {
  initialData: EntrepriseDashboardData;
  userId: string;
  userName: string;
};

const DISPO_LABEL: Record<string, string> = {
  immediate: 'Immédiate', semaine: 'Sous une semaine', mois: 'Sous un mois', a_discuter: 'À discuter',
};

export default function EntrepriseDashboardClient({ initialData, userId, userName }: Props) {
  const router = useRouter();
  const [missions, setMissions] = useState(initialData.missions);
  const [stats, setStats] = useState(initialData.stats);
  const [selectedSecretaire, setSelectedSecretaire] = useState<{id: string, nom: string} | null>(null);
  const [detailsProfil, setDetailsProfil] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const refuserCandidature = useCallback(async (missionId: number, candidatureId: number) => {
    setMissions(prev => prev.map(m =>
      m.id === missionId
        ? { ...m, candidatures: m.candidatures.map(c => c.id === candidatureId ? { ...c, statut: 'refusee' } : c) }
        : m
    ));
    setStats(prev => ({ ...prev, enAttente: Math.max(0, prev.enAttente - 1) }));

    const result = await refuserCandidatureAction(missionId, candidatureId);
    if (result.error) {
      toast.error('Erreur : ' + result.error.message);
      setMissions(prev => prev.map(m =>
        m.id === missionId
          ? { ...m, candidatures: m.candidatures.map(c => c.id === candidatureId ? { ...c, statut: 'en_attente' } : c) }
          : m
      ));
      setStats(prev => ({ ...prev, enAttente: prev.enAttente + 1 }));
    } else {
      toast.success('Candidature refusée');
    }
  }, []);

  const proposerOffre = useCallback(async (candidatureId: number, secretaireId: string, missionId: number) => {
    setMissions(prev => prev.map(m =>
      m.id === missionId
        ? { ...m, candidatures: m.candidatures.map(c => c.id === candidatureId ? { ...c, statut: 'acceptee' } : c) }
        : m
    ));
    setStats(prev => ({ ...prev, enAttente: Math.max(0, prev.enAttente - 1) }));

    const result = await proposerOffreAction(candidatureId, secretaireId, missionId);
    if (result.error) {
      if (result.error.code === '23505') toast.error('Une offre est déjà en attente pour cette secrétaire.');
      else toast.error('Erreur : ' + result.error.message);
      setMissions(prev => prev.map(m =>
        m.id === missionId
          ? { ...m, candidatures: m.candidatures.map(c => c.id === candidatureId ? { ...c, statut: 'en_attente' } : c) }
          : m
      ));
      setStats(prev => ({ ...prev, enAttente: prev.enAttente + 1 }));
    } else {
      toast.success('Offre proposée avec succès !');
    }
  }, []);

  const ouvrirProfil = useCallback(async (secretaireId: string, secretaireNom: string) => {
    setSelectedSecretaire({ id: secretaireId, nom: secretaireNom });
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/secretaire/${secretaireId}/profil`);
      const data = await res.json();
      if (data) setDetailsProfil(data);
    } catch { toast.error('Erreur chargement profil'); }
    setLoadingDetails(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">Espace Entreprise — {userName}</h1>
              <p className="text-gray-500">Gérez vos missions et vos recrutements en un coup d&apos;œil.</p>
            </div>
            {userId && <NotificationBell userId={userId} role="entreprise" />}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link href="/dashboard/entreprise/chercher" className="bg-white border-2 border-blue-200 text-blue-700 px-6 py-3 rounded-xl font-bold hover:border-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2">🔍 Trouver une secrétaire</Link>
            <Link href="/dashboard/messages" className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:border-blue-300 hover:bg-blue-50 transition flex items-center justify-center gap-2">💬 Messages</Link>
            <Link href="/dashboard/entreprise/nouvelle-mission" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2"><span>+</span> Publier une mission</Link>
          </div>
        </div>

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
                        const secretaire = Array.isArray(cand.secretaire) ? cand.secretaire[0] : cand.secretaire;
                        if (!secretaire) return null;
                        return (
                          <div key={cand.id} className="flex flex-col gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-800 truncate">{secretaire.nom}</p>
                                <button onClick={() => ouvrirProfil(secretaire.id, secretaire.nom)} aria-label={`Voir le profil de ${secretaire.nom}`} className="text-blue-600 text-xs font-bold hover:underline">Voir le profil</button>
                              </div>
                              {cand.statut !== 'en_attente' && (
                                <span className={`text-[10px] font-black px-2 py-1 rounded-md whitespace-nowrap ${
                                  cand.statut === 'acceptee' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {cand.statut === 'acceptee' ? '✓ Offre envoyée' : 'Refusée'}
                                </span>
                              )}
                            </div>

                            {cand.statut === 'en_attente' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => proposerOffre(cand.id, secretaire.id, mission.id)}
                                  aria-label={`Proposer une offre à ${secretaire.nom}`}
                                  className="flex-1 bg-blue-600 text-white text-xs font-extrabold tracking-tight px-3 py-2 rounded-lg hover:bg-blue-700 transition"
                                >
                                  Proposer une offre
                                </button>
                                <button
                                  onClick={() => refuserCandidature(mission.id, cand.id)}
                                  aria-label={`Refuser la candidature de ${secretaire.nom}`}
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
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-3xl">
                        {detailsProfil.photo_url ? (
                          <img src={detailsProfil.photo_url} alt="Photo" className="w-full h-full object-cover" />
                        ) : <span className="text-slate-300">👤</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        {detailsProfil.bio ? (
                          <p className="text-sm text-slate-700 leading-relaxed italic">{detailsProfil.bio}</p>
                        ) : <p className="text-sm text-slate-400 italic">Aucune bio renseignée.</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Ville', value: detailsProfil.ville || '—' },
                        { label: 'Disponibilité', value: detailsProfil.disponibilite ? DISPO_LABEL[detailsProfil.disponibilite] ?? detailsProfil.disponibilite : '—' },
                        { label: 'Niveau d\'études', value: detailsProfil.niveau_etudes || '—' },
                        { label: 'Expérience', value: `${detailsProfil.annees_experience} ans` },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">{item.label}</p>
                          <p className="text-sm font-bold text-slate-800 truncate">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-1">💼 Tarif</p>
                      <p className="text-sm text-blue-900 font-medium leading-relaxed">Le tarif de la prestation est fixé par la plateforme lors de la mise en relation, en fonction du volume et du type de mission.</p>
                    </div>
                    {detailsProfil.competences?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Compétences</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailsProfil.competences.map((c: string, i: number) => (
                            <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(detailsProfil.outils?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outils maîtrisés</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailsProfil.outils!.map((o: string, i: number) => (
                            <span key={i} className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold">{o}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(detailsProfil.soft_skills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Soft skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailsProfil.soft_skills!.map((s: string, i: number) => (
                            <span key={i} className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(detailsProfil.langues?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Langues</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailsProfil.langues!.map((l: string, i: number) => (
                            <span key={i} className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-bold">{l}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                      <p className="text-xs text-amber-900 leading-relaxed font-medium">🔒 Pour des raisons de confidentialité, le numéro de téléphone et les coordonnées personnelles restent <b>masqués</b>. Acceptez la candidature pour déclencher la mise en relation par la plateforme.</p>
                    </div>
                  </div>
                ) : <p className="text-center text-gray-400 italic text-sm">Ce profil n'est pas encore complété.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}