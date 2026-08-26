'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/i18n';
import { revalidateScope } from '@/lib/actions/cache';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
  profils: { nom: string } | null;
};

type Candidature = {
  mission_id: number;
};

type AIScore = {
  score: number;
  explication: string;
  points_forts: string[];
  points_a_verifier: string[];
};

export default function RechercherPoste() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mesCandidatures, setMesCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [postulating, setPostulating] = useState<number | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [useAI, setUseAI] = useState(false);
  const [aiScores, setAiScores] = useState<Record<number, AIScore>>({});
  const [loadingAI, setLoadingAI] = useState(false);

  const debouncedQ = useDebounce(q, 300);

  /*
   * Rechargement automatique au retour sur l'onglet et après une reconnexion.
   *
   * L'écran ne se chargeait qu'au montage : un onglet laissé ouvert affichait
   * indéfiniment un état périmé, et le seul recours était de recharger la page.
   * Incrémenter cette clé rejoue l'effet de chargement existant — y compris sa
   * vérification de session, ce qui est souhaitable après une longue absence.
   */
  const [refreshKey, setRefreshKey] = useState(0);
  useAutoRefresh(() => setRefreshKey(key => key + 1));

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }
      setUserId(session.user.id);

      // IDs des entreprises avec KYC approuvé
      const { data: approvedKycs } = await supabase
        .from('kyc_verifications')
        .select('user_id')
        .eq('statut', 'approved')
        .eq('type_compte', 'entreprise');

      const approvedEntIds = (approvedKycs ?? []).map(k => k.user_id);

      // Toutes les missions ouvertes des entreprises vérifiées
      const { data: ms } = await supabase
        .from('missions')
        .select('id, titre, description, date_debut, date_fin, created_at, profils(nom)')
        .eq('statut', 'ouverte')
        .in('entreprise_id', approvedEntIds.length > 0 ? approvedEntIds : ['__none__'])
        .order('created_at', { ascending: false });

      // Mes candidatures pour savoir où j'ai déjà postulé
      const { data: cs } = await supabase
        .from('candidatures')
        .select('mission_id')
        .eq('secretaire_id', session.user.id);

      if (ms) setMissions(ms as unknown as Mission[]);
      if (cs) setMesCandidatures(cs as Candidature[]);
      setLoading(false);
    };
    fetchAll();
  }, [router, refreshKey]);

  // ----- Fetch scores IA pour les missions -----------------------------------

  const fetchAIScores = async () => {
    if (!userId || missions.length === 0) return;
    setLoadingAI(true);
    const scores: Record<number, AIScore> = {};
    for (const m of missions) {
      try {
        const res = await fetch('/api/match-secretaire-mission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretaireId: userId, mission: m }),
        });
        if (res.ok) {
          const data = await res.json();
          scores[m.id] = data;
        }
      } catch {
        // En cas d'erreur, on garde le tri par défaut
      }
    }
    setAiScores(scores);
    setLoadingAI(false);
  };

  // ----- Filtrage + tri IA ---------------------------------------------------

  const filtered = useMemo(() => {
    let result = missions;
    if (debouncedQ.trim()) {
      const needle = debouncedQ.toLowerCase().trim();
      result = result.filter(m =>
        [m.titre, m.description, m.profils?.nom]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    if (useAI && Object.keys(aiScores).length > 0) {
      result = [...result].sort((a, b) => (aiScores[b.id]?.score ?? 0) - (aiScores[a.id]?.score ?? 0));
    }
    return result;
  }, [missions, debouncedQ, useAI, aiScores]);

  const postuler = async (missionId: number) => {
    if (!userId) return;
    setPostulating(missionId);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('candidatures').insert([
      { mission_id: missionId, secretaire_id: userId, statut: 'en_attente' },
    ]);

    if (error) {
      // 23505 = unique constraint (déjà postulé)
      if (error.code === '23505') {
        setMessage({ text: 'Vous avez déjà postulé à cette mission.', type: 'error' });
      } else {
        setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
      }
    } else {
      setMesCandidatures(prev => [...prev, { mission_id: missionId }]);
      setMessage({ text: 'Candidature envoyée ✓', type: 'success' });
      // La candidature apparaît sur les deux tableaux de bord : les caches des
      // deux versants doivent expirer, sinon l'entreprise ne la verra pas
      // arriver avant la fin de la fenêtre de cache.
      await revalidateScope('candidatures');
    }
    setPostulating(null);
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Chargement des missions...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 font-sans antialiased">
      <div className="max-w-5xl mx-auto">

        <Link
          href="/dashboard/secretaire"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Mon espace de travail
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Rechercher un poste</h1>
          <p className="text-slate-500 font-medium mt-1">
            {missions.length} mission{missions.length > 1 ? 's' : ''} ouverte{missions.length > 1 ? 's' : ''} publiée{missions.length > 1 ? 's' : ''} par les entreprises.
          </p>
        </header>

        {message.text && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Recherche
          </label>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Titre, mot-clé, nom d'entreprise…"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-300"
          />
        </div>

        {/* Toggle IA pour les missions */}
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setUseAI(!useAI);
              if (!useAI && Object.keys(aiScores).length === 0) {
                fetchAIScores();
              }
            }}
            disabled={loadingAI}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition ${
              useAI
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-purple-300'
            } ${loadingAI ? 'opacity-60 cursor-wait' : ''}`}
          >
            {loadingAI ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                </svg>
                Analyse IA en cours...
              </>
            ) : (
              <>
                <span className="text-lg">✨</span>
                Classer par pertinence IA {useAI ? 'activé' : ''}
              </>
            )}
          </button>
          {useAI && !loadingAI && (
            <span className="text-xs text-purple-600 font-bold">
              {Object.keys(aiScores).length} mission{Object.keys(aiScores).length > 1 ? 's' : ''} analysée{Object.keys(aiScores).length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-500 font-medium">
              {q ? 'Aucune mission ne correspond à votre recherche.' : 'Aucune mission disponible pour le moment.'}
            </p>
            <p className="text-xs text-slate-400 mt-2">Revenez plus tard, de nouvelles missions sont publiées régulièrement.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(m => {
              const deja = mesCandidatures.some(c => c.mission_id === m.id);
              const isPostulating = postulating === m.id;
              const aiScore = aiScores[m.id];
              return (
                <article key={m.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-black tracking-tight text-slate-900">{m.titre}</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Publiée par <b className="text-slate-700">{m.profils?.nom ?? '—'}</b>
                        {' · '}
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                    {aiScore && (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                          aiScore.score >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          aiScore.score >= 50 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {aiScore.score}% compatible
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          ✨ IA
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3 font-medium">
                    {m.description}
                  </p>

                  {aiScore && (
                    <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 mb-4">
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-1">Analyse IA</p>
                      <p className="text-sm text-purple-900 font-medium">{aiScore.explication}</p>
                      {aiScore.points_forts.length > 0 && (
                        <div className="mt-2">
                          {aiScore.points_forts.map((pf, i) => (
                            <p key={i} className="text-xs text-emerald-700 font-medium">✓ {pf}</p>
                          ))}
                        </div>
                      )}
                      {aiScore.points_a_verifier.length > 0 && (
                        <div className="mt-1">
                          {aiScore.points_a_verifier.map((pv, i) => (
                            <p key={i} className="text-xs text-amber-600 font-medium">⚠ {pv}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(m.date_debut || m.date_fin) && (
                    <div className="flex flex-wrap gap-3 mb-4 text-xs">
                      {m.date_debut && (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          Début : {formatDate(m.date_debut)}
                        </span>
                      )}
                      {m.date_fin && (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          Fin : {formatDate(m.date_fin)}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => postuler(m.id)}
                    disabled={deja || isPostulating}
                    className={`w-full py-3 rounded-full font-extrabold text-sm tracking-tight transition ${
                      deja
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPostulating
                          ? 'bg-slate-200 text-slate-500 cursor-wait'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                    }`}
                  >
                    {deja ? '✓ Candidature envoyée' : isPostulating ? 'Envoi en cours...' : 'Postuler à cette mission'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
