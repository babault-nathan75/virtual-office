'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

type Profil = {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: 'entreprise' | 'secretaire' | 'admin';
  created_at?: string;
};

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  entreprise: { label: 'Entreprise',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  secretaire: { label: 'Secrétaire',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  admin:      { label: 'Administrateur', color: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export default function Profile() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Form state
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password section
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ----- Init -----

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }
      setUserId(session.user.id);

      const { data: p } = await supabase
        .from('profils')
        .select('id, nom, email, telephone, role, created_at')
        .eq('id', session.user.id)
        .single();

      if (p) {
        setProfil(p as Profil);
        setNom(p.nom ?? '');
        setTelephone(p.telephone ?? '');
      }

      // Avatar : prio user_metadata, fallback photo_url si secretaire
      const meta = (session.user.user_metadata ?? {}) as { avatar_url?: string };
      let url = meta.avatar_url ?? '';
      if (!url && p?.role === 'secretaire') {
        const { data: ps } = await supabase
          .from('profils_secretaires')
          .select('photo_url')
          .eq('id', session.user.id)
          .single();
        if (ps?.photo_url) url = ps.photo_url;
      }
      setAvatarUrl(url);
      setLoading(false);
    };
    fetch();
  }, [router]);

  // ----- Upload avatar -----

  const handlePhoto = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Photo trop lourde (max 5 Mo).', type: 'error' });
      return;
    }
    setUploadingPhoto(true);
    setMessage({ text: '', type: '' });

    try {
      // Nettoie les anciens avatars
      const { data: existing } = await supabase.storage.from('avatars').list(userId);
      if (existing && existing.length) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map(f => `${userId}/${f.name}`));
      }

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlBust = `${publicUrl}?v=${Date.now()}`;

      // 1) user_metadata (lu par la Navbar)
      const { error: authErr } = await supabase.auth.updateUser({
        data: { avatar_url: urlBust },
      });
      if (authErr) throw authErr;

      // 2) Si secrétaire, garde la même photo côté profils_secretaires (pour la vue entreprise)
      if (profil?.role === 'secretaire') {
        await supabase
          .from('profils_secretaires')
          .upsert({ id: userId, photo_url: urlBust });
      }

      setAvatarUrl(urlBust);
      setMessage({ text: 'Photo mise à jour ✓', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ text: 'Erreur upload : ' + msg, type: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ----- Save infos -----

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setMessage({ text: '', type: '' });

    // 1) profils (source de vérité)
    const { error: pErr } = await supabase
      .from('profils')
      .update({ nom, telephone })
      .eq('id', userId);

    // 2) user_metadata pour la Navbar (full_name lu par le composant)
    const { error: authErr } = await supabase.auth.updateUser({
      data: { full_name: nom, nom, telephone },
    });

    if (pErr || authErr) {
      setMessage({ text: 'Erreur : ' + (pErr?.message ?? authErr?.message), type: 'error' });
    } else {
      setMessage({ text: 'Informations mises à jour ✓', type: 'success' });
    }
    setSaving(false);
  };

  // ----- Change password -----

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    if (newPassword.length < 6) {
      setMessage({ text: 'Le mot de passe doit faire au moins 6 caractères.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Les mots de passe ne correspondent pas.', type: 'error' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
    } else {
      setMessage({ text: 'Mot de passe mis à jour ✓', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  // ----- Logout -----

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Chargement...</div>;
  }

  if (!profil) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        Profil introuvable.{' '}
        <Link href="/" className="text-blue-600 underline font-bold">Retour à l&apos;accueil</Link>
      </div>
    );
  }

  const roleInfo = ROLE_LABEL[profil.role] ?? { label: profil.role, color: 'bg-slate-100 text-slate-700' };
  const passwordMismatch = confirmPassword !== '' && newPassword !== confirmPassword;

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-3xl mx-auto space-y-6">

        <Link
          href="/"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition"
        >
          ← Retour à l&apos;accueil
        </Link>

        {/* HEADER */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="bg-gradient-to-br from-slate-900 to-blue-800 p-8 text-center text-white relative">
            <div className="relative inline-block">
              <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-white/30 overflow-hidden mx-auto flex items-center justify-center text-4xl backdrop-blur-sm">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white/60">👤</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label="Changer la photo"
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
                  if (f) handlePhoto(f);
                  e.target.value = '';
                }}
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-5">{profil.nom || 'Sans nom'}</h1>
            <p className="text-blue-100 text-sm font-medium mt-1">{profil.email}</p>
            <span className={`inline-block mt-3 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        </div>

        {/* MESSAGE */}
        {message.text && (
          <div className={`p-4 rounded-2xl text-sm font-bold text-center ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* INFOS PERSONNELLES */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-8">
          <h2 className="text-lg font-black tracking-tight text-slate-900 mb-6">
            Informations personnelles
          </h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {profil.role === 'entreprise' ? "Nom de l'entreprise ou du gérant" : 'Nom complet'}
              </label>
              <input
                type="text"
                required
                value={nom}
                onChange={e => setNom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Téléphone</label>
              <input
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+225 01 02 03 04 05"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={profil.email}
                readOnly
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1.5 font-medium">
                L&apos;email ne peut pas être modifié ici. Contactez le support si besoin.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold tracking-tight text-sm transition shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Mettre à jour mes informations'}
            </button>
          </form>
        </div>

        {/* SÉCURITÉ — Mot de passe */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-8">
          <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">
            Sécurité
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-6">
            Changer votre mot de passe. Il doit faire au moins 6 caractères.
          </p>

          <form onSubmit={handlePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nouveau mot de passe</label>
              <PasswordInput
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Confirmer</label>
              <PasswordInput
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                invalid={passwordMismatch}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {passwordMismatch && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingPassword || !newPassword || passwordMismatch}
              className="w-full py-3.5 rounded-full bg-slate-900 hover:bg-blue-700 text-white font-extrabold tracking-tight text-sm transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingPassword ? 'Mise à jour...' : 'Changer mon mot de passe'}
            </button>
          </form>
        </div>

        {/* LIENS RAPIDES (variantes selon rôle) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-8">
          <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4">Raccourcis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard"
              className="text-center py-3 px-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition font-bold text-slate-700 text-sm"
            >
              🏠 Mon tableau de bord
            </Link>
            {profil.role === 'secretaire' && (
              <Link
                href="/dashboard/secretaire/profil"
                className="text-center py-3 px-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition font-bold text-slate-700 text-sm"
              >
                ⚙️ Mon profil métier
              </Link>
            )}
            {profil.role === 'entreprise' && (
              <Link
                href="/dashboard/entreprise/chercher"
                className="text-center py-3 px-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition font-bold text-slate-700 text-sm"
              >
                🔍 Trouver une secrétaire
              </Link>
            )}
          </div>
        </div>

        {/* DÉCONNEXION */}
        <div className="bg-white rounded-3xl border border-red-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-8">
          <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">Déconnexion</h2>
          <p className="text-sm text-slate-500 font-medium mb-5">
            Vous serez redirigé vers la page d&apos;accueil.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 font-extrabold tracking-tight text-sm transition border border-red-200"
          >
            Se déconnecter
          </button>
        </div>

        {profil.created_at && (
          <p className="text-center text-xs text-slate-400 font-medium pt-2">
            Membre depuis le {new Date(profil.created_at).toLocaleDateString('fr-FR')}
          </p>
        )}
      </div>
    </main>
  );
}
