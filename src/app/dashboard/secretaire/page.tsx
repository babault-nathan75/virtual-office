'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import NotificationBell from '@/components/NotificationBell';

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

type Offre = {
  id: number;
  statut: string;
  message: string | null;
  created_at: string;
  entreprise_id: string;
  mission_id: number | null;
  missions: { titre: string } | null;
  entreprise_nom: string;
};

const OFFRE_STATUT_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  concluee:   { label: 'Conclue',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  refusee:    { label: 'Refusée',    color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  annulee:    { label: 'Annulée',    color: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

// ... (Garde tes SCORE_WEIGHTS et ta fonction computeScore exactement comme avant)
const SCORE_WEIGHTS = { photo_url: 12, competences: 12, outils: 12, annees_experience: 12, bio: 8, soft_skills: 8, niveau_etudes: 5, ville: 5, langues: 7, disponibilite: 7, kyc: 10, twoFactor: 10 };

function computeScore(p: Record<string, unknown> | null, kycApproved: boolean, twoFactorEnabled: boolean) {
  let s = 0;
  if (!p) return (kycApproved ? SCORE_WEIGHTS.kyc : 0) + (twoFactorEnabled ? SCORE_WEIGHTS.twoFactor : 0);
  if (p.photo_url) s += SCORE_WEIGHTS.photo_url;
  if (Array.isArray(p.competences) && p.competences.length > 0) s += SCORE_WEIGHTS.competences;
  if (Array.isArray(p.outils) && p.outils.length > 0) s += SCORE_WEIGHTS.outils;
  if (typeof p.annees_experience === 'number' && p.annees_experience > 0) s += SCORE_WEIGHTS.annees_experience;
  if (typeof p.bio === 'string' && p.bio.trim().length >= 20) s += SCORE_WEIGHTS.bio;
  if (Array.isArray(p.soft_skills) && p.soft_skills.length > 0) s += SCORE_WEIGHTS.soft_skills;
  if (p.niveau_etudes) s += SCORE_WEIGHTS.niveau_etudes;
  if (p.ville) s += SCORE_WEIGHTS.ville;
  if (Array.isArray(p.langues) && p.langues.length > 0) s += SCORE_WEIGHTS.langues;
  if (p.disponibilite) s += SCORE_WEIGHTS.disponibilite;
  if (kycApproved) s += SCORE_WEIGHTS.kyc;
  if (twoFactorEnabled) s += SCORE_WEIGHTS.twoFactor;
  return s;
}

// Fonction utilitaire pour formater les dates joliment
const formatDate = (dateString: string) => {
  if (!dateString) return 'Date à définir';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateString));
};

export default function DashboardSecretaire() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [userId, setUserId] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mesCandidatures, setMesCandidatures] = useState<Candidature[]>([]);
  const [mesOffres, setMesOffres] = useState<Offre[]>([]);
  const [completion, setCompletion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ... (Garde ton useEffect exactement comme avant)
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }
      setUserId(session.user.id);

      const [profilRes, missionsRes, candidaturesRes, metierRes, kycRes, twoFactorRes] = await Promise.all([
        supabase.from('profils').select('nom').eq('id', session.user.id).maybeSingle(),
        supabase.from('missions').select('id, titre, description, date_debut, profils(nom)').eq('statut', 'ouverte').order('created_at', { ascending: false }),
        supabase.from('candidatures').select('mission_id, statut, missions(titre)').eq('secretaire_id', session.user.id),
        supabase.from('profils_secretaires').select('photo_url, bio, ville, disponibilite, niveau_etudes, langues, outils, soft_skills, competences, annees_experience').eq('id', session.user.id).maybeSingle(),
        supabase.from('kyc_verifications').select('status').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('two_factor_auth').select('enabled').eq('user_id', session.user.id).maybeSingle(),
      ]);

      if (profilRes.data) setNom(profilRes.data.nom);
      const kycApproved = kycRes.data?.status === 'approved';
      const twoFactorEnabled = twoFactorRes.data?.enabled === true;
      setCompletion(computeScore(metierRes.data || null, kycApproved, twoFactorEnabled));
      if (metierRes.data?.photo_url) setPhotoUrl(metierRes.data.photo_url);
      if (missionsRes.data) setMissions(missionsRes.data as unknown as Mission[]);
      if (candidaturesRes.data) setMesCandidatures(candidaturesRes.data as unknown as Candidature[]);

      const { data: offresRaw } = await supabase.from('offres').select('id, statut, message, created_at, entreprise_id, mission_id, missions(titre)').eq('secretaire_id', session.user.id).order('created_at', { ascending: false });
      
      if (offresRaw && offresRaw.length > 0) {
        const entIds = Array.from(new Set(offresRaw.map(o => o.entreprise_id)));
        const { data: ents } = await supabase.from('profils').select('id, nom').in('id', entIds);
        const map = new Map((ents ?? []).map(e => [e.id, e.nom as string]));
        setMesOffres(offresRaw.map(o => ({ ...o, entreprise_nom: map.get(o.entreprise_id) ?? 'Entreprise' })) as unknown as Offre[]);
      }
      setLoading(false);
    };
    fetchData();
  }, [router]);

  const postuler = async (missionId: number) => {
    // ... (Garde ta fonction postuler exactement comme avant)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const mission = missions.find(m => m.id === missionId);
    if (mission) setMesCandidatures(prev => [...prev, { mission_id: missionId, statut: 'en_attente', missions: { titre: mission.titre } }]);

    const { error } = await supabase.from('candidatures').insert([{ mission_id: missionId, secretaire_id: session.user.id, statut: 'en_attente' }]);

    if (error) {
      setMesCandidatures(prev => prev.filter(c => c.mission_id !== missionId));
      if (error.code === '23505') toast.error('Vous avez déjà postulé à cette mission.');
      else toast.error('Erreur : ' + error.message);
    } else {
      toast.success('Candidature envoyée !');
    }
  };

  // UI d'attente optimisée (Skeleton)
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-pulse">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="h-40 bg-slate-200 rounded-3xl w-full"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-200 rounded-2xl w-full"></div>)}
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-slate-200 rounded-2xl w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-6xl mx-auto">

        {/* 1. HEADER & PROGRESSION REPENSÉS */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
          {/* Décoration d'arrière-plan */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

          <div className="flex items-center gap-5 flex-1 w-full relative z-10">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-inner overflow-hidden shrink-0 flex items-center justify-center text-3xl ring-4 ring-white">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span>🧑‍💻</span>
              )}
            </div>

            <div className="flex-1 w-full">
              <div className="flex items-center justify-between xl:justify-start gap-4">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                  Bonjour, {nom}
                </h1>
                {userId && <NotificationBell userId={userId} role="secretaire" />}
              </div>
              
              <div className="mt-3 max-w-md">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-sm font-bold text-slate-700">Visibilité du profil</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${completion === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {completion}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      completion >= 100 ? 'bg-emerald-500' : completion >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${completion}%` }}
                  />
                </div>
                {completion < 100 && (
                  <p className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-amber-500">💡</span> Complétez votre profil pour attirer plus d&apos;entreprises.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'actions groupés */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto relative z-10">
            <Link
              href="/dashboard/secretaire/profil"
              className="flex-1 xl:flex-none text-center bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-sm"
            >
              Modifier le profil
            </Link>
            <Link
              href="/dashboard/kyc"
              className="flex-1 xl:flex-none text-center bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-semibold hover:border-blue-300 hover:bg-blue-50 transition"
              title="Vérification d'identité"
            >
              🪪 KYC
            </Link>
            <Link
              href="/dashboard/secretaire/profil"
              className="flex-1 xl:flex-none text-center bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-semibold hover:border-blue-300 hover:bg-blue-50 transition"
              title="Double authentification"
            >
              🔐 2FA
            </Link>
            <Link
              href="/dashboard/secretaire/avis"
              className="flex-1 xl:flex-none text-center bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-amber-100 transition"
            >
              ⭐ Avis
            </Link>
          </div>
        </div>

        {/* 2. CONTENU PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Colonne Gauche : Missions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                💼 Nouvelles missions
              </h2>
            </div>

            {missions.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center">
                <span className="text-4xl mb-4">📭</span>
                <p className="text-slate-800 font-bold text-lg">Aucune mission pour le moment</p>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">Les entreprises publient de nouvelles offres régulièrement. Gardez l&apos;œil ouvert !</p>
              </div>
            ) : (
              <div className="space-y-4">
                {missions.map((m) => {
                  const dejaPostule = mesCandidatures.some(c => c.mission_id === m.id);
                  return (
                    <div key={m.id} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col sm:flex-row gap-5">
                      
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                            🏢 {m.profils?.nom || 'Entreprise anonyme'}
                          </span>
                          {/* Affichage de la date qui manquait dans la v1 ! */}
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            📅 Début le {formatDate(m.date_debut)}
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-black tracking-tight text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {m.titre}
                        </h3>
                        <p className="text-slate-600 text-sm line-clamp-2 leading-relaxed">
                          {m.description}
                        </p>
                      </div>

                      <div className="sm:w-48 shrink-0 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-5">
                        <button
                          onClick={() => postuler(m.id)}
                          disabled={dejaPostule}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                            dejaPostule
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-95'
                          }`}
                        >
                          {dejaPostule ? '✓ Envoyée' : 'Postuler'}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Colonne Droite : Suivi (Sticky pour scroller avec confort) */}
          <div className="space-y-8 lg:sticky lg:top-8 self-start">
            
            {/* Section Offres directes */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  📩 Offres directes
                </h2>
                {mesOffres.filter(o => o.statut === 'en_attente').length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                    {mesOffres.filter(o => o.statut === 'en_attente').length}
                  </span>
                )}
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {mesOffres.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500 font-medium">Aucune proposition reçue.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {mesOffres.map(o => {
                      const sty = OFFRE_STATUT_LABEL[o.statut] ?? OFFRE_STATUT_LABEL['en_attente'];
                      return (
                        <div key={o.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <p className="text-sm font-bold text-slate-900 truncate" title={o.entreprise_nom}>
                              {o.entreprise_nom}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                              {formatDate(o.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mb-2 truncate">
                            {o.missions?.titre ? `Mission : ${o.missions.titre}` : 'Proposition de mission'}
                          </p>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${sty.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`}></span>
                            {sty.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Section Suivi Candidatures */}
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                📊 Mes candidatures
              </h2>
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {mesCandidatures.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500 font-medium">Vous n&apos;avez postulé à aucune mission.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {mesCandidatures.map((c, idx) => (
                      <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <span className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">
                          {c.missions?.titre}
                        </span>
                        <span className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border ${
                          c.statut === 'acceptee'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.statut === 'refusee'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {c.statut.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}