'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ============================================================
// Constantes
// ============================================================

const OUTILS = [
  'Word', 'Excel', 'PowerPoint',
  'Google Docs', 'Google Sheets',
  'Outlook', 'Gmail', 'WhatsApp Business',
  'Zoom', 'Teams', 'Google Meet',
  'Canva', 'Adobe Acrobat',
  'Sage', 'Saari', 'QuickBooks',
];

const LANGUES = [
  'Français', 'Anglais', 'Espagnol',
  'Baoulé', 'Dioula', 'Bété', 'Sénoufo',
];

const NIVEAUX = ['BEPC', 'BAC', 'BTS', 'Licence', 'Master', 'Doctorat'];

const DISPOS = [
  { value: 'immediate', label: 'Immédiate' },
  { value: 'semaine', label: 'Sous une semaine' },
  { value: 'mois', label: 'Sous un mois' },
  { value: 'a_discuter', label: 'À discuter' },
] as const;

const DISPO_LABEL: Record<string, string> = Object.fromEntries(
  DISPOS.map(d => [d.value, d.label])
);

// ============================================================
// Types
// ============================================================

type Secretaire = {
  id: string;
  nom: string;
  photo_url?: string | null;
  bio?: string | null;
  ville?: string | null;
  disponibilite?: string | null;
  niveau_etudes?: string | null;
  langues?: string[] | null;
  outils?: string[] | null;
  soft_skills?: string[] | null;
  competences?: string[] | null;
  annees_experience?: number | null;
};

type Filters = {
  q: string;
  outils: string[];
  langues: string[];
  disponibilite: string;
  niveauEtudes: string;
  ville: string;
  experienceMin: number;
};

const INITIAL_FILTERS: Filters = {
  q: '',
  outils: [],
  langues: [],
  disponibilite: '',
  niveauEtudes: '',
  ville: '',
  experienceMin: 0,
};

// ============================================================
// Algorithme de scoring pondéré (100% local, déterministe)
// ============================================================
// Principe :
// - Pour chaque filtre actif, on ajoute des points au "score" du profil
// - "maxPossible" suit le score max théorique vu les filtres actifs
// - "match" = score / maxPossible (en %)
// - Un bonus "qualité du profil" est toujours compté pour départager
//   les profils quand aucun filtre actif
// ============================================================

function scoreSecretaire(s: Secretaire, f: Filters) {
  let score = 0;
  let max = 0;

  // 1. Recherche libre (mot-clé)
  if (f.q.trim()) {
    const q = f.q.toLowerCase().trim();
    const haystack = [
      s.bio,
      s.nom,
      s.ville,
      ...(s.competences ?? []),
      ...(s.outils ?? []),
      ...(s.soft_skills ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    max += 30;
    if (haystack.includes(q)) score += 30;
  }

  // 2. Outils en commun
  if (f.outils.length > 0) {
    const common = f.outils.filter(o => s.outils?.includes(o)).length;
    max += f.outils.length * 10;
    score += common * 10;
  }

  // 3. Langues en commun
  if (f.langues.length > 0) {
    const common = f.langues.filter(l => s.langues?.includes(l)).length;
    max += f.langues.length * 5;
    score += common * 5;
  }

  // 4. Disponibilité exacte
  if (f.disponibilite) {
    max += 15;
    if (s.disponibilite === f.disponibilite) score += 15;
  }

  // 5. Niveau d'études ≥ filtre
  if (f.niveauEtudes) {
    max += 10;
    const idxF = NIVEAUX.indexOf(f.niveauEtudes);
    const idxS = NIVEAUX.indexOf(s.niveau_etudes ?? '');
    if (idxS >= idxF) score += 10;
  }

  // 6. Ville (match partiel insensible casse)
  if (f.ville.trim()) {
    max += 10;
    if (s.ville?.toLowerCase().includes(f.ville.toLowerCase().trim())) score += 10;
  }

  // 7. Années d'expérience min
  if (f.experienceMin > 0) {
    max += 10;
    if ((s.annees_experience ?? 0) >= f.experienceMin) score += 10;
  }

  // 8. Bonus qualité du profil — toujours compté (max +10)
  let bonus = 0;
  if (s.photo_url) bonus += 4;
  if ((s.bio?.trim().length ?? 0) >= 20) bonus += 3;
  if ((s.competences?.length ?? 0) >= 3) bonus += 3;
  score += bonus;
  max += 10;

  const match = max > 0 ? Math.round((score / max) * 100) : 0;
  return { score, max, match };
}

// ============================================================
// Petit composant chip
// ============================================================

function ChipMultiSelect({
  options, selected, onChange, color = 'blue',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  color?: 'blue' | 'emerald';
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  const active = color === 'blue'
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-emerald-600 text-white border-emerald-600';
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={isActive}
            className={`px-2.5 py-1 rounded-full border-2 text-xs font-bold tracking-tight transition ${
              isActive ? active : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function ChercherSecretaire() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [secretaires, setSecretaires] = useState<Secretaire[]>([]);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [openProfile, setOpenProfile] = useState<Secretaire | null>(null);

  // ----- Auth + fetch ---------------------------------------------------------

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }

      // Profils des secrétaires (nom seulement — surtout pas email/tel)
      const { data: profils } = await supabase
        .from('profils')
        .select('id, nom')
        .eq('role', 'secretaire');

      // Données métier
      const { data: metiers } = await supabase
        .from('profils_secretaires')
        .select('id, photo_url, bio, ville, disponibilite, niveau_etudes, langues, outils, soft_skills, competences, annees_experience');

      // Merge
      const merged: Secretaire[] = (profils ?? []).map(p => {
        const m = (metiers ?? []).find(x => x.id === p.id) ?? {};
        return { id: p.id, nom: p.nom, ...m };
      });

      setSecretaires(merged);
      setLoading(false);
    };
    fetchAll();
  }, [router]);

  // ----- Tri + scoring (mémo) -------------------------------------------------

  const results = useMemo(() => {
    return secretaires
      .map(s => ({ ...s, ...scoreSecretaire(s, filters) }))
      .sort((a, b) => b.score - a.score);
  }, [secretaires, filters]);

  const activeFiltersCount =
    (filters.q ? 1 : 0) +
    filters.outils.length +
    filters.langues.length +
    (filters.disponibilite ? 1 : 0) +
    (filters.niveauEtudes ? 1 : 0) +
    (filters.ville ? 1 : 0) +
    (filters.experienceMin > 0 ? 1 : 0);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        Chargement des profils...
      </div>
    );
  }

  // ----- Render --------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard/entreprise"
              className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-3 transition"
            >
              ← Tableau de bord
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Trouver une secrétaire
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              {secretaires.length} profil{secretaires.length > 1 ? 's' : ''} dans la base.
              Filtrez ci-dessous pour les classer par pertinence.
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(INITIAL_FILTERS)}
              className="text-sm font-bold text-red-600 hover:text-red-800 underline self-start md:self-end"
            >
              Réinitialiser les filtres ({activeFiltersCount})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

          {/* ============== FILTRES ============== */}
          <aside className="lg:sticky lg:top-4 lg:self-start space-y-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                Recherche libre
              </label>
              <input
                type="text"
                value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                placeholder="Mot-clé (bio, compétence…)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                Disponibilité
              </label>
              <div className="space-y-2">
                {DISPOS.map(d => (
                  <label key={d.value} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dispo"
                      checked={filters.disponibilite === d.value}
                      onChange={() => setFilters(f => ({ ...f, disponibilite: d.value }))}
                      className="accent-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700">{d.label}</span>
                  </label>
                ))}
                {filters.disponibilite && (
                  <button
                    type="button"
                    onClick={() => setFilters(f => ({ ...f, disponibilite: '' }))}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium underline mt-1"
                  >
                    effacer
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Ville</label>
              <input
                type="text"
                value={filters.ville}
                onChange={e => setFilters(f => ({ ...f, ville: e.target.value }))}
                placeholder="Ex: Abidjan"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                Expérience min.
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={filters.experienceMin}
                  onChange={e => setFilters(f => ({ ...f, experienceMin: Number(e.target.value) }))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-bold text-slate-700 w-12 text-right">
                  {filters.experienceMin} an{filters.experienceMin > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                Niveau d&apos;études min.
              </label>
              <select
                value={filters.niveauEtudes}
                onChange={e => setFilters(f => ({ ...f, niveauEtudes: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="">Indifférent</option>
                {NIVEAUX.map(n => <option key={n} value={n}>{n} ou +</option>)}
              </select>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                Outils requis
              </label>
              <ChipMultiSelect options={OUTILS} selected={filters.outils} onChange={(v) => setFilters(f => ({ ...f, outils: v }))} />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                Langues
              </label>
              <ChipMultiSelect options={LANGUES} selected={filters.langues} onChange={(v) => setFilters(f => ({ ...f, langues: v }))} color="emerald" />
            </div>
          </aside>

          {/* ============== RÉSULTATS ============== */}
          <section>
            {results.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-slate-500 font-medium">Aucune secrétaire inscrite pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map(s => <ResultCard key={s.id} s={s} onOpen={() => setOpenProfile(s)} />)}
              </div>
            )}
          </section>
        </div>

        {/* ============== MODAL PROFIL ============== */}
        {openProfile && (
          <ProfileModal s={openProfile} onClose={() => setOpenProfile(null)} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// ResultCard
// ============================================================

function ResultCard({ s, onOpen }: { s: Secretaire & { match: number; score: number }; onOpen: () => void }) {
  const matchStyle =
    s.match >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    s.match >= 50 ? 'bg-blue-100 text-blue-700 border-blue-200' :
    'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-blue-300 transition shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
      <div className="flex items-start gap-4 mb-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
          {s.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.photo_url} alt={s.nom} className="w-full h-full object-cover" />
          ) : <span className="text-slate-300">👤</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black tracking-tight text-slate-900 truncate">{s.nom}</h3>
          <p className="text-xs text-slate-500 font-medium truncate">
            {s.ville || 'Ville non précisée'}
            {s.annees_experience ? ` · ${s.annees_experience} an${s.annees_experience > 1 ? 's' : ''} d'exp.` : ''}
          </p>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${matchStyle}`}>
          {s.match}% match
        </span>
      </div>

      {s.bio && (
        <p className="text-sm text-slate-600 line-clamp-2 italic mb-3">« {s.bio} »</p>
      )}

      {(s.outils?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {s.outils!.slice(0, 4).map(o => (
            <span key={o} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[11px] font-bold">{o}</span>
          ))}
          {s.outils!.length > 4 && (
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[11px] font-bold">+{s.outils!.length - 4}</span>
          )}
        </div>
      )}

      <button
        onClick={onOpen}
        className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-blue-700 text-white text-sm font-extrabold tracking-tight transition"
      >
        Voir le profil
      </button>
    </div>
  );
}

// ============================================================
// ProfileModal — version lecture seule, sans coordonnées
// ============================================================

function ProfileModal({ s, onClose }: { s: Secretaire; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const proposerOffre = async () => {
    setSending(true);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMsg({ text: 'Vous devez être connecté pour proposer une offre.', type: 'error' });
      setSending(false);
      return;
    }
    const { error } = await supabase.from('offres').insert({
      entreprise_id: session.user.id,
      secretaire_id: s.id,
      mission_id: null,
      candidature_id: null,
      statut: 'en_attente',
    });
    if (error) {
      if (error.code === '23505') {
        setMsg({ text: 'Une offre est déjà en attente pour cette secrétaire.', type: 'error' });
      } else {
        setMsg({ text: 'Erreur : ' + error.message, type: 'error' });
      }
    } else {
      setMsg({ text: 'Offre envoyée ✓ L\'admin et la secrétaire ont été notifiés.', type: 'success' });
      setSent(true);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Profil de {s.nom}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl font-light leading-none">&times;</button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">

          <div className="flex gap-4 items-start">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-3xl border border-slate-200">
              {s.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo_url} alt={s.nom} className="w-full h-full object-cover" />
              ) : <span className="text-slate-300">👤</span>}
            </div>
            <div className="flex-1 min-w-0">
              {s.bio ? (
                <p className="text-sm text-slate-700 leading-relaxed italic">{s.bio}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Aucune bio.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Ville" value={s.ville} />
            <InfoCell label="Disponibilité" value={s.disponibilite ? DISPO_LABEL[s.disponibilite] : null} />
            <InfoCell label="Niveau d'études" value={s.niveau_etudes} />
            <InfoCell label="Expérience" value={s.annees_experience ? `${s.annees_experience} ans` : null} />
          </div>

          {(s.competences?.length ?? 0) > 0 && (
            <ChipsBlock label="Compétences" items={s.competences!} color="slate" />
          )}
          {(s.outils?.length ?? 0) > 0 && (
            <ChipsBlock label="Outils maîtrisés" items={s.outils!} color="blue" />
          )}
          {(s.soft_skills?.length ?? 0) > 0 && (
            <ChipsBlock label="Soft skills" items={s.soft_skills!} color="emerald" />
          )}
          {(s.langues?.length ?? 0) > 0 && (
            <ChipsBlock label="Langues" items={s.langues!} color="amber" />
          )}

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-1">💼 Tarif</p>
            <p className="text-sm text-blue-900 font-medium leading-relaxed">
              Le tarif est fixé par la plateforme lors de la mise en relation,
              en fonction du volume et du type de mission.
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              🔒 Pour des raisons de confidentialité, le numéro de téléphone et les coordonnées personnelles
              restent <b>masqués</b>. Publiez une mission ou contactez la plateforme pour déclencher la mise en relation.
            </p>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl text-sm font-bold text-center ${
              msg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {msg.text}
            </div>
          )}

          <button
            type="button"
            onClick={proposerOffre}
            disabled={sending || sent}
            className={`block w-full text-center py-3 rounded-full font-extrabold tracking-tight transition shadow-lg ${
              sent
                ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed shadow-emerald-100'
                : sending
                  ? 'bg-slate-200 text-slate-500 cursor-wait shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
            }`}
          >
            {sent ? '✓ Offre envoyée' : sending ? 'Envoi en cours...' : 'Proposer une offre'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-slate-50 p-3 rounded-xl">
      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-800 truncate">{value || '—'}</p>
    </div>
  );
}

function ChipsBlock({ label, items, color }: { label: string; items: string[]; color: 'slate' | 'blue' | 'emerald' | 'amber' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
  }[color];
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className={`${cls} px-2.5 py-1 rounded-lg text-xs font-bold`}>{it}</span>
        ))}
      </div>
    </div>
  );
}
