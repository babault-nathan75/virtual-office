'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { Button, Card } from '@/components/ui';

// ============================================================
// Données des QCM (listes de choix)
// ============================================================

const OUTILS = [
  'Word', 'Excel', 'PowerPoint',
  'Google Docs', 'Google Sheets',
  'Outlook', 'Gmail', 'WhatsApp Business',
  'Zoom', 'Teams', 'Google Meet',
  'Canva', 'Adobe Acrobat',
  'Sage', 'Saari', 'QuickBooks',
];

const SOFT_SKILLS = [
  'Rigueur', 'Ponctualité', 'Discrétion',
  'Organisation', 'Autonomie', 'Réactivité',
  'Communication écrite', 'Communication orale',
  'Gestion du stress', 'Esprit d’équipe', 'Sens du service',
];

const LANGUES = [
  'Français', 'Anglais', 'Espagnol',
  'Allemand',
];

const NIVEAUX = ['BEPC', 'BAC', 'BTS', 'Licence', 'Master', 'Doctorat'];

const DISPOS = [
  { value: 'immediate', label: 'Immédiate' },
  { value: 'semaine', label: 'Sous une semaine' },
  { value: 'mois', label: 'Sous un mois' },
  { value: 'a_discuter', label: 'À discuter' },
] as const;

const SPECIALITES_SECRETAIRE = [
  { group: 'Secrétariat Général et Administratif', items: [
    'Secrétaire administratif', 'Secrétaire de direction', 'Secrétaire assistant',
    'Secrétaire d\'accueil', 'Secrétaire bureautique',
  ]},
  { group: 'Secrétariat Spécialisé par Secteur', items: [
    'Secrétaire médical', 'Secrétaire juridique', 'Secrétaire comptable',
    'Secrétaire commercial', 'Secrétaire technique', 'Secrétaire RH',
    'Secrétaire logistique', 'Secrétaire vétérinaire', 'Secrétaire paramédical',
  ]},
  { group: 'Langues et Communication', items: [
    'Secrétaire bilingue', 'Secrétaire de rédaction', 'Secrétaire d\'édition',
  ]},
  { group: 'Secteur Public, Éducatif et Associatif', items: [
    'Secrétaire de mairie', 'Secrétaire scolaire', 'Secrétaire d\'association',
  ]},
  { group: 'Formes Modernes', items: [
    'Télésecrétaire', 'Secrétaire indépendant', 'Assistant virtuel',
  ]},
] as const;

// ============================================================
// Petits helpers d'UI
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
  const idleHover = color === 'blue' ? 'hover:border-blue-300' : 'hover:border-emerald-300';
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={isActive}
            className={`px-3 py-1.5 rounded-full border-2 text-sm font-bold tracking-tight transition ${
              isActive ? active : `bg-white text-slate-700 border-slate-200 ${idleHover}`
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function RadioRow<T extends string>({
  options, value, onChange,
}: {
  options: readonly { value: T; label: string }[] | readonly T[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  const items = (options as readonly unknown[]).map(o =>
    typeof o === 'string' ? { value: o as T, label: o } : (o as { value: T; label: string })
  );
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(o => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={isActive}
            className={`px-4 py-1.5 rounded-full border-2 text-sm font-bold tracking-tight transition ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Page profil
// ============================================================

export default function ProfilSecretaire() {
  const router = useRouter();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Photo
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profil
  const [bio, setBio] = useState('');
  const [ville, setVille] = useState('');
  const [disponibilite, setDisponibilite] = useState<string>('');
  const [niveauEtudes, setNiveauEtudes] = useState<string>('');
  const [specialite, setSpecialite] = useState<string>('');
  const [langues, setLangues] = useState<string[]>([]);
  const [outils, setOutils] = useState<string[]>([]);
  const [softSkills, setSoftSkills] = useState<string[]>([]);
  const [competences, setCompetences] = useState('');
  const [experience, setExperience] = useState('');

  useEffect(() => {
    const fetchProfil = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }
      setUserId(session.user.id);

      const { data } = await supabase
        .from('profils_secretaires')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setPhotoUrl(data.photo_url ?? '');
        setBio(data.bio ?? '');
        setVille(data.ville ?? '');
        setDisponibilite(data.disponibilite ?? '');
        setNiveauEtudes(data.niveau_etudes ?? '');
        setSpecialite(data.specialite ?? '');
        setLangues(data.langues ?? []);
        setOutils(data.outils ?? []);
        setSoftSkills(data.soft_skills ?? []);
        setCompetences(data.competences ? data.competences.join(', ') : '');
        setExperience(data.annees_experience?.toString() ?? '');
      }
      setFetching(false);
    };
    fetchProfil();
  }, [router]);

  // ----- Upload photo --------------------------------------------------------

  const handlePhotoSelected = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Photo trop lourde (max 5 Mo).', type: 'error' });
      return;
    }
    setUploadingPhoto(true);
    setMessage({ text: '', type: '' });

    try {
      // Nettoyage des anciens avatars dans le dossier user
      const { data: existing } = await supabase.storage.from('avatars').list(userId);
      if (existing && existing.length) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map(f => `${userId}/${f.name}`));
      }

      // Upload
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // URL publique + cache-buster
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlBust = `${publicUrl}?v=${Date.now()}`;

      // Persistance dans profils_secretaires
      const { error: dbErr } = await supabase
        .from('profils_secretaires')
        .upsert({ id: userId, photo_url: urlBust });
      if (dbErr) throw dbErr;

      setPhotoUrl(urlBust);
      setMessage({ text: 'Photo mise à jour ✓', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ text: 'Erreur upload photo : ' + msg, type: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ----- Save profile --------------------------------------------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const competencesArr = competences
      .split(',')
      .map(c => c.trim())
      .filter(c => c !== '');

    if (!bio.trim()) { setMessage({ text: 'La bio est obligatoire.', type: 'error' }); return; }
    if (!ville.trim()) { setMessage({ text: 'La ville est obligatoire.', type: 'error' }); return; }
    if (!disponibilite) { setMessage({ text: 'La disponibilité est obligatoire.', type: 'error' }); return; }
    if (!specialite) { setMessage({ text: 'La spécialité est obligatoire.', type: 'error' }); return; }
    if (competencesArr.length === 0) { setMessage({ text: 'Au moins une compétence est requise.', type: 'error' }); return; }
    if (outils.length === 0) { setMessage({ text: 'Sélectionnez au moins un outil.', type: 'error' }); return; }
    if (softSkills.length === 0) { setMessage({ text: 'Sélectionnez au moins un soft skill.', type: 'error' }); return; }
    if (!niveauEtudes) { setMessage({ text: 'Le niveau d\'études est obligatoire.', type: 'error' }); return; }
    if (langues.length === 0) { setMessage({ text: 'Sélectionnez au moins une langue.', type: 'error' }); return; }
    if (!experience || parseInt(experience) <= 0) { setMessage({ text: 'Les années d\'expérience sont obligatoires.', type: 'error' }); return; }

    setSaving(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('profils_secretaires').upsert({
      id: userId,
      photo_url: photoUrl || null,
      bio: bio || null,
      ville: ville || null,
      disponibilite: disponibilite || null,
      niveau_etudes: niveauEtudes || null,
      specialite: specialite || null,
      langues,
      outils,
      soft_skills: softSkills,
      competences: competencesArr,
      annees_experience: parseInt(experience) || 0,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
    } else {
      setMessage({ text: '✅ Profil mis à jour ! Redirection...', type: 'success' });
      setTimeout(() => router.push('/dashboard/secretaire'), 1200);
    }
    setSaving(false);
  };

  if (fetching) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        Chargement de vos informations...
      </div>
    );
  }

  // ----- Render --------------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/secretaire"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          ← Retour au tableau de bord
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* Header avec photo */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-8 text-center text-white">
            <div className="relative inline-block">
              <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-white/30 overflow-hidden mx-auto flex items-center justify-center text-4xl font-black backdrop-blur-sm">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="Photo de profil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white/60">👤</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label="Modifier la photo"
                className="absolute -bottom-1 -right-1 bg-white text-blue-700 rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:scale-110 transition disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoSelected(f);
                  e.target.value = '';
                }}
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-5">Mon profil</h1>
            <p className="text-blue-100 text-sm font-medium mt-1">
              Un profil complet multiplie par 3 vos chances d&apos;être sélectionnée.
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            {message.text && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-bold text-center ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-10">

              {/* Section 1 — Présentation */}
              <section className="space-y-5">
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-xl flex items-center justify-center text-sm">1</span>
                  Présentation
                </h2>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Bio courte <span className="text-red-500">*</span></label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    required
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    placeholder="Présentez-vous en quelques lignes : votre parcours, votre approche du travail…"
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{bio.length}/500</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Ville <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={ville}
                    onChange={e => setVille(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Abidjan — Cocody"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Disponibilité <span className="text-red-500">*</span></label>
                  <RadioRow options={DISPOS} value={disponibilite} onChange={setDisponibilite} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Spécialité <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={specialite}
                    onChange={e => setSpecialite(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">— Choisissez votre spécialité —</option>
                    {SPECIALITES_SECRETAIRE.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Section 2 — Compétences */}
              <section className="space-y-5">
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-xl flex items-center justify-center text-sm">2</span>
                  Compétences métier
                </h2>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Vos expertises (libres, séparées par des virgules) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={competences}
                    onChange={e => setCompetences(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    placeholder="Ex: Facturation, Accueil téléphonique, Gestion d'agenda…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Outils maîtrisés <span className="text-red-500">*</span> <span className="text-slate-400 font-medium">({outils.length} sélectionné{outils.length > 1 ? 's' : ''})</span>
                  </label>
                  <ChipMultiSelect options={OUTILS} selected={outils} onChange={setOutils} color="blue" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Soft skills <span className="text-red-500">*</span> <span className="text-slate-400 font-medium">({softSkills.length})</span>
                  </label>
                  <ChipMultiSelect options={SOFT_SKILLS} selected={softSkills} onChange={setSoftSkills} color="emerald" />
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Section 3 — Parcours */}
              <section className="space-y-5">
                <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-xl flex items-center justify-center text-sm">3</span>
                  Parcours
                </h2>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Niveau d&apos;études <span className="text-red-500">*</span></label>
                  <RadioRow options={NIVEAUX} value={niveauEtudes} onChange={setNiveauEtudes} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Langues parlées <span className="text-red-500">*</span> <span className="text-slate-400 font-medium">({langues.length})</span>
                  </label>
                  <ChipMultiSelect options={LANGUES} selected={langues} onChange={setLangues} color="blue" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Années d&apos;expérience <span className="text-red-500">*</span></label>
                  <div className="relative max-w-xs">
                    <input
                      type="number"
                      min={1}
                      required
                      value={experience}
                      onChange={e => setExperience(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      placeholder="Ex: 5"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">ans</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-700 mb-1">💼 Tarif</p>
                  <p>
                    Vous n&apos;avez pas besoin de fixer votre tarif. C&apos;est la plateforme qui négocie le
                    montant directement avec l&apos;entreprise lors de la mise en relation.
                  </p>
                </div>
              </section>

              <Button
                type="submit"
                disabled={saving}
                variant="primary"
                size="lg"
                className="w-full mt-6"
              >
                {saving ? 'Enregistrement...' : 'Mettre à jour mon profil'}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <Link
                href="/dashboard/profil/2fa"
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">🔐</div>
                <div>
                  <p className="font-extrabold text-slate-900 text-sm">Authentification à deux facteurs (2FA)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Sécurisez votre compte avec Google Authenticator ou un code par email</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
