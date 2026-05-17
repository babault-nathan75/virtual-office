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

const OFFRE_STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente de la plateforme', color: 'bg-amber-100 text-amber-700' },
  concluee:   { label: 'Conclue ✓',                   color: 'bg-emerald-100 text-emerald-700' },
  refusee:    { label: 'Refusée',                     color: 'bg-red-100 text-red-700' },
  annulee:    { label: 'Annulée',                     color: 'bg-slate-200 text-slate-600' },
};

// 10 critères = 100 points pile (le tarif est fixé par la plateforme, pas par la secrétaire)
const SCORE_WEIGHTS = {
  photo_url: 15,
  competences: 15,        // au moins 1 entrée
  outils: 15,             // au moins 1 sélectionné
  annees_experience: 15,  // > 0
  bio: 10,                // au moins 20 caractères
  soft_skills: 10,        // au moins 1 sélectionné
  niveau_etudes: 5,
  ville: 5,
  langues: 5,             // au moins 1
  disponibilite: 5,
};

function computeScore(p: Record<string, unknown> | null) {
  if (!p) return 0;
  let s = 0;
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
  return s;
}

export default function DashboardSecretaire() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mesCandidatures, setMesCandidatures] = useState<Candidature[]>([]);
  const [mesOffres, setMesOffres] = useState<Offre[]>([]);
  const [completion, setCompletion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }

      const { data: profil } = await supabase.from('profils').select('nom').eq('id', session.user.id).single();
      if (profil) setNom(profil.nom);

      const { data: missionsOuvertes } = await supabase
        .from('missions')
        .select('id, titre, description, date_debut, profils(nom)')
        .eq('statut', 'ouverte')
        .order('created_at', { ascending: false });

      const { data: candidatures } = await supabase
        .from('candidatures')
        .select('mission_id, statut, missions(titre)')
        .eq('secretaire_id', session.user.id);

      const { data: metier } = await supabase
        .from('profils_secretaires')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (metier) {
        setPhotoUrl(metier.photo_url ?? '');
        setCompletion(computeScore(metier));
      }

      if (missionsOuvertes) setMissions(missionsOuvertes as unknown as Mission[]);
      if (candidatures) setMesCandidatures(candidatures as unknown as Candidature[]);

      // Offres reçues par la secrétaire (avec nom de l'entreprise)
      const { data: offresRaw } = await supabase
        .from('offres')
        .select('id, statut, message, created_at, entreprise_id, mission_id, missions(titre)')
        .eq('secretaire_id', session.user.id)
        .order('created_at', { ascending: false });

      if (offresRaw && offresRaw.length > 0) {
        const entIds = Array.from(new Set(offresRaw.map(o => o.entreprise_id)));
        const { data: ents } = await supabase.from('profils').select('id, nom').in('id', entIds);
        const map = new Map((ents ?? []).map(e => [e.id, e.nom as string]));
        setMesOffres(offresRaw.map(o => ({
          ...o,
          entreprise_nom: map.get(o.entreprise_id) ?? 'Entreprise',
        })) as unknown as Offre[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [router]);

  const postuler = async (missionId: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('candidatures').insert([
      { mission_id: missionId, secretaire_id: session.user.id, statut: 'en_attente' },
    ]);
    if (!error) window.location.reload();
  };

  if (loading) return <div className="p-8 text-center font-medium text-slate-500">Chargement...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">

        {/* Header & progression */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5 flex-1 w-full">
            {/* Avatar */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Photo de profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-300">👤</span>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Bonjour, {nom} 👋</h1>
              <div className="mt-3 max-w-md">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm font-bold text-blue-700">Profil complété à {completion}%</span>
                  {completion < 100 && (
                    <span className="text-xs text-slate-400 font-medium">{100 - completion} pts restants</span>
                  )}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      completion >= 80 ? 'bg-emerald-500' : completion >= 50 ? 'bg-blue-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${completion}%` }}
                  />
                </div>
                {completion < 100 && (
                  <p className="text-[11px] text-slate-500 mt-1.5 font-medium italic">
                    Un profil complet vous rend visible et inspire confiance aux entreprises.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/secretaire/profil"
            className="w-full md:w-auto text-center bg-blue-600 text-white px-6 py-3 rounded-full font-extrabold tracking-tight hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            ⚙️ Modifier mon profil
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Missions */}
          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-xl font-black tracking-tight text-slate-900">🚀 Missions pour vous</h2>
            {missions.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-slate-500 font-medium">Aucune mission disponible pour le moment.</p>
                <p className="text-xs text-slate-400 mt-2">Revenez plus tard ou complétez votre profil pour augmenter votre visibilité.</p>
              </div>
            ) : missions.map((m) => {
              const dejaPostule = mesCandidatures.some(c => c.mission_id === m.id);
              return (
                <div key={m.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">{m.titre}</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold shrink-0">
                      {m.profils?.nom}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm mb-5 line-clamp-2 font-medium">{m.description}</p>
                  <button
                    onClick={() => postuler(m.id)}
                    disabled={dejaPostule}
                    className={`w-full py-3 rounded-full font-extrabold text-sm tracking-tight transition ${
                      dejaPostule
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    {dejaPostule ? '✓ Candidature envoyée' : 'Postuler maintenant'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Colonne droite : Offres reçues + Suivi candidatures */}
          <div className="space-y-6">

            {/* Offres reçues — section nouvelle */}
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 mb-3">
                📩 Offres reçues
                {mesOffres.filter(o => o.statut === 'en_attente').length > 0 && (
                  <span className="ml-2 inline-block bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full align-middle">
                    {mesOffres.filter(o => o.statut === 'en_attente').length}
                  </span>
                )}
              </h2>
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                {mesOffres.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center font-medium">Aucune offre pour l&apos;instant.</p>
                ) : (
                  <ul className="space-y-3">
                    {mesOffres.map(o => {
                      const sty = OFFRE_STATUT_LABEL[o.statut] ?? { label: o.statut, color: 'bg-slate-100 text-slate-600' };
                      return (
                        <li key={o.id} className="border-b border-slate-100 pb-3 last:border-0">
                          <p className="text-sm font-black tracking-tight text-slate-900">{o.entreprise_nom}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {o.missions?.titre ? `Mission « ${o.missions.titre} »` : 'Offre directe'}
                          </p>
                          <span className={`inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${sty.color}`}>
                            {sty.label}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">
                            {new Date(o.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Candidatures envoyées */}
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 mb-3">📊 Mes candidatures</h2>
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                {mesCandidatures.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center font-medium">Aucune candidature.</p>
                ) : (
                  <div className="space-y-3">
                    {mesCandidatures.map((c, idx) => (
                      <div key={idx} className="flex flex-col border-b border-slate-100 pb-3 last:border-0">
                        <span className="text-sm font-bold text-slate-800 truncate">{c.missions?.titre}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest mt-1 w-fit px-2 py-0.5 rounded-full ${
                          c.statut === 'acceptee'
                            ? 'bg-emerald-100 text-emerald-700'
                            : c.statut === 'refusee'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
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
    </div>
  );
}
