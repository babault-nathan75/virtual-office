'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PasswordInput from '@/components/PasswordInput';

export default function Inscription() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Un user déjà connecté n'a rien à faire sur la page d'inscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (password !== confirmPassword) {
      setMessage({ text: "Les mots de passe ne correspondent pas.", type: 'error' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom: nom,
          role: role,
          telephone: telephone,
        },
      },
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({
        text: '🎉 Inscription réussie ! Vous pouvez maintenant vous connecter.',
        type: 'success',
      });
      setTimeout(() => router.push('/connexion'), 2000);
    }
    setLoading(false);
  };

  const passwordsMismatch = confirmPassword !== '' && password !== confirmPassword;

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition">
          <Image
            src="/logo.png"
            alt="Logo SecrétariatPro"
            width={72}
            height={72}
            priority
            className="rounded-2xl mb-3 object-contain shadow-lg shadow-blue-100"
          />
          <span className="text-2xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>
        <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">
          Créer un compte
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Rejoignez la plateforme en quelques secondes.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">

          {message.text && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium text-center ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">

            {/* Sélection du rôle */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 text-center tracking-tight">
                Quel est votre objectif&nbsp;?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('entreprise')}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${
                    role === 'entreprise'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm scale-[1.02]'
                      : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-3xl mb-1">🏢</span>
                  <span className="font-extrabold text-sm tracking-tight">Recruter</span>
                  <span className="text-[10px] mt-0.5 text-slate-400 font-medium">Je suis une entreprise</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('secretaire')}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${
                    role === 'secretaire'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm scale-[1.02]'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-3xl mb-1">👩‍💻</span>
                  <span className="font-extrabold text-sm tracking-tight">Travailler</span>
                  <span className="text-[10px] mt-0.5 text-slate-400 font-medium">Je suis secrétaire</span>
                </button>
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {role === 'entreprise' ? "Nom de l'entreprise ou du gérant" : 'Prénom et Nom'}
              </label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={role === 'entreprise' ? 'Ex: Tech Solutions' : 'Ex: Marie Dupont'}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Numéro de téléphone</label>
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: +225 01 02 03 04 05"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Adresse email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="votre@email.com"
              />
            </div>

            {/* Mots de passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Mot de passe</label>
                <PasswordInput
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Confirmer</label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  invalid={passwordsMismatch}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {passwordsMismatch && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium">Les mots de passe ne correspondent pas.</p>
                )}
              </div>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading || passwordsMismatch}
              className={`w-full mt-2 py-4 rounded-full text-white font-extrabold tracking-tight text-base transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${
                role === 'entreprise'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-200'
              }`}
            >
              {loading
                ? 'Création en cours...'
                : role === 'entreprise'
                  ? 'Créer mon compte Entreprise'
                  : 'Créer mon compte Secrétaire'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-600 font-medium">
              Vous avez déjà un compte&nbsp;?{' '}
              <Link href="/connexion" className="font-bold text-blue-600 hover:underline">
                Connectez-vous ici
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
