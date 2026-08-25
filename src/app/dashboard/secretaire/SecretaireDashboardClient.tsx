'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import KycStatusBanner from '@/components/KycStatusBanner';
import { postulerAction } from '@/lib/data/secretaire-client';
import { LOCALE } from '@/lib/i18n';

type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut: string;
  created_at: string;
  entreprise: { id: string; nom: string }[] | { id: string; nom: string } | null;
  candidatures?: { id: number; statut: string; secretaire_id: string }[];
};

// Les relations imbriquées PostgREST sont typées « tableau ou objet » : le
// client Supabase les infère en tableau alors qu'une relation « plusieurs vers
// un » renvoie un objet. Les deux formes sont donc acceptées et normalisées
// par `unwrapRelation`.
type Relation<T> = T[] | T | null | undefined;

function unwrapRelation<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type Candidature = {
  id?: number;
  mission_id: number;
  statut: string;
  created_at?: string;
  secretaire_id?: string;
  mission?: Relation<{ id: number; titre: string }>;
};

type Offre = {
  id: number;
  statut: string;
  message: string | null;
  created_at: string;
  entreprise_id: string;
  mission_id: number | null;
  entreprise: Relation<{ id: string; nom: string }>;
  mission: Relation<{ id: number; titre: string }>;
};

type Props = {
  userId: string;
  userName: string;
  userAvatar?: string;
  completion: number;
  kycApproved: boolean;
  twoFactorEnabled: boolean;
  missions: Mission[];
  candidatures: Candidature[];
  offres: Offre[];
};

export default function SecretaireDashboardClient({
  userId,
  userName,
  userAvatar,
  completion,
  kycApproved,
  twoFactorEnabled,
  missions,
  candidatures,
  offres
}: Props) {
  const [missionsState, setMissionsState] = useState<Mission[]>(missions);
  const [candidaturesState, setCandidaturesState] = useState<Candidature[]>(candidatures);
  // `offres` n'est jamais modifié côté client : la copie dans un état
  // local était inutile (le setter n'était appelé nulle part).

  const postuler = useCallback(async (missionId: number) => {
    const mission = missionsState.find(m => m.id === missionId);
    if (!mission) return;

    setMissionsState(prev => prev.map(m =>
      m.id === missionId ? { ...m, candidatures: [...(m.candidatures || []), { id: Date.now(), statut: 'en_attente', secretaire_id: userId }] } : m
    ));

    const result = await postulerAction(userId, missionId);
    if (result.error) {
      if ('code' in result.error && result.error.code === '23505') toast.error('Vous avez déjà postulé à cette mission.');
      else toast.error('Erreur : ' + result.error.message);
      setMissionsState(prev => prev.map(m => m.id === missionId ? { ...m, candidatures: m.candidatures?.filter(c => c.secretaire_id !== userId) } : m));
    } else {
      toast.undo('Candidature envoyée !', () => {
        setMissionsState(prev => prev.map(m =>
          m.id === missionId ? { ...m, candidatures: m.candidatures?.filter(c => c.secretaire_id !== userId) } : m
        ));
        setCandidaturesState(prev => prev.filter(c => c.mission_id !== missionId));
      });
      setCandidaturesState(prev => [...prev, { mission_id: missionId, statut: 'en_attente', mission: { id: 0, titre: mission.titre } }]);
    }
  }, [missionsState, userId]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date à définir';
    return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateString));
  };

  const OFFRE_STATUT_LABEL: Record<string, { label: string; color: string; dot: string }> = {
    en_attente: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    concluee:   { label: 'Conclue',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    refusee:    { label: 'Refusée',    color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    annulee:    { label: 'Annulée',    color: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none" />
          <div className="flex items-center gap-5 flex-1 w-full relative z-10">
            <div className="w-20 h-20 md:w-20 md:h-20 rounded-lg shadow-inner overflow-hidden shrink-0 flex items-center justify-center text-3xl ring-4 ring-white">
              {userAvatar ? (
                /* L'URL de la photo est fournie par l'utilisateur : next/image
                   lève une erreur bloquante si son hôte n'est pas déclaré dans
                   next.config.ts, ce qui casserait toute la page. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userAvatar} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                // Ressource locale au lieu du CDN flaticon : une image tierce
                // sur le tableau de bord est une dépendance externe inutile.
                <Image src="/avatar-placeholder.png" alt="Profil" width={80} height={80} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between xl:justify-start gap-4">
                <h1 className="text-2xl md:text-3xl sm:text-sm font-black tracking-tight text-slate-900">
                  Bonjour, {userName}
                </h1>
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
                {completion !== 100 && completion < 100 && (
                  <p className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-amber-500">💡</span>Complétez votre profil pour attirer plus d&apos;entreprises.
                    <Link
                      href="/dashboard/secretaire/profil"
                      className="ml-1 inline-flex items-center text-white bg-blue-600 border border-transparent hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 shadow-sm font-medium leading-5 rounded-lg text-sm px-4 py-2.5 focus:outline-none transition-colors"
                    >
                      Compléter
                      <svg
                        className="w-4 h-4 ms-1.5 rtl:rotate-180 -me-0.5"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 12H5m14 0-4 4m4-4-4-4"
                        />
                      </svg>
                    </Link>
                  </p>
                )}
                {(!kycApproved || !twoFactorEnabled) && (
                  <p className="text-xs text-red-600 mt-1.5 font-bold flex items-center gap-1.5">
                    <span>🔒</span>
                    {!kycApproved && !twoFactorEnabled && 'KYC et 2FA requis pour être visible par les entreprises.'}
                    {!kycApproved && twoFactorEnabled && 'KYC requis pour être visible par les entreprises.'}
                    {kycApproved && !twoFactorEnabled && '2FA requise pour être visible par les entreprises.'}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 lg:gap-8 w-full lg:w-auto relative z-10">
            <Link href="/dashboard/secretaire/profil" className="col-span-2 lg:col-auto text-center bg-slate-900 text-white px-4 lg:px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-sm text-sm lg:text-base">Modifier le profil</Link>
            <Link
              href="/dashboard/kyc"
              className={`text-center bg-white border border-slate-200 text-slate-600 px-3 lg:px-4 py-2.5 rounded-xl font-semibold hover:border-blue-300 hover:bg-blue-50 transition text-sm lg:text-base ${kycApproved ? 'hidden' : ''}`}
              title="Vérification d'identité"
            >
              KYC
            </Link>
            <Link
              href="/dashboard/profil/2fa"
              className={`text-center bg-white border border-slate-200 text-slate-600 px-3 lg:px-4 py-2.5 rounded-xl font-semibold hover:border-blue-300 hover:bg-blue-50 transition text-sm lg:text-base ${twoFactorEnabled ? 'hidden' : ''}`}
              title="Double authentification"
            >
              🔐 2FA
            </Link>
            <Link href="/dashboard/secretaire/avis" className="text-center bg-amber-50 border border-amber-200 text-amber-700 px-3 lg:px-4 py-2.5 rounded-xl font-semibold hover:bg-amber-100 transition text-sm lg:text-base">⭐ Avis</Link>
          </div>
        </div>

        <KycStatusBanner userId={userId} />

        {/* CONTENU PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne Gauche : Missions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">💼 Nouvelles missions</h2>
            </div>
            {missionsState.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m16.5 0V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v.75m16.5 0v7.5a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25v-7.5" />
                  </svg>
                </div>
                <p className="text-slate-800 font-bold text-lg mb-1">Aucune mission disponible</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Les entreprises publient de nouvelles offres régulièrement. Revenez bientôt !</p>
              </div>
            ) : (
              <div className="space-y-4">
                {missionsState.map((m) => {
                  const dejaPostule = candidaturesState.some(c => c.mission_id === m.id);
                  const ent = unwrapRelation(m.entreprise);
                  const entrepriseNom = ent?.nom;
                  return (
                    <div key={m.id} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col sm:flex-row gap-5">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                            🏢 {entrepriseNom || 'Entreprise anonyme'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            📅 Début le {formatDate(m.date_debut)}
                          </span>
                        </div>
                        <h3 className="text-lg font-black tracking-tight text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{m.titre}</h3>
                        <p className="text-slate-600 text-sm line-clamp-2 leading-relaxed">{m.description}</p>
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

          {/* Colonne Droite : Suivi */}
          <div className="space-y-8 lg:sticky lg:top-24 self-start">
            {/* Offres directes */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">📩 Offres directes</h2>
                {offres.filter(o => o.statut === 'en_attente').length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                    {offres.filter(o => o.statut === 'en_attente').length}
                  </span>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {offres.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Aucune proposition reçue</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {offres.map(o => {
                      const sty = OFFRE_STATUT_LABEL[o.statut] ?? OFFRE_STATUT_LABEL['en_attente'];
                      return (
                        <div key={o.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <p className="text-sm font-bold text-slate-900 truncate" title={unwrapRelation(o.entreprise)?.nom}>
                            {unwrapRelation(o.entreprise)?.nom}</p>
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">{formatDate(o.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mb-2 truncate">
                            {unwrapRelation(o.mission)?.titre ? `Mission : ${unwrapRelation(o.mission)?.titre}` : 'Proposition de mission'}
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

            {/* Candidatures */}
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">📊 Mes candidatures</h2>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {candidaturesState.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Aucune candidature envoyée</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {candidaturesState.map((c, idx) => (
                      <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <span className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{unwrapRelation(c.mission)?.titre}</span>
                        <span className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border ${
                          c.statut === 'acceptee' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : c.statut === 'refusee' ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{c.statut.replace('_', ' ')}</span>
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