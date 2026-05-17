'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PasswordInput from '@/components/PasswordInput';

export default function Reinitialisation() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Quand l'utilisateur clique sur le lien dans l'email, Supabase
    // établit automatiquement une session de récupération.
    // On vérifie qu'on a bien une session avant d'afficher le formulaire.
    let mounted = true;

    (async () => {
      // Petit délai pour laisser Supabase traiter le hash/code de récupération
      await new Promise(r => setTimeout(r, 100));
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setStatus(session ? 'ready' : 'invalid');
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const mismatch = confirm !== '' && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setStatus('done');
    setLoading(false);
    // On déconnecte explicitement pour forcer la re-connexion avec le nouveau mot de passe
    await supabase.auth.signOut();
    setTimeout(() => router.push('/connexion'), 2500);
  };

  if (status === 'checking') {
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
          {status === 'done' ? 'Mot de passe mis à jour' : 'Nouveau mot de passe'}
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">

          {status === 'invalid' && (
            <>
              <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm text-center font-medium mb-5">
                Le lien de réinitialisation est invalide ou a expiré.
              </div>
              <Link
                href="/mot-de-passe-oublie"
                className="block w-full text-center py-3.5 rounded-full text-white font-extrabold tracking-tight text-sm transition shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700"
              >
                Demander un nouveau lien
              </Link>
            </>
          )}

          {status === 'ready' && (
            <>
              <p className="text-sm text-slate-500 font-medium text-center mb-5">
                Choisissez un nouveau mot de passe (6 caractères minimum).
              </p>

              {errorMsg && (
                <div className="mb-5 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nouveau mot de passe</label>
                  <PasswordInput
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Confirmer</label>
                  <PasswordInput
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    invalid={mismatch}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {mismatch && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium">Les mots de passe ne correspondent pas.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || mismatch || password.length < 6}
                  className="w-full py-4 rounded-full text-white font-extrabold tracking-tight text-base bg-blue-600 hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Mise à jour...' : 'Définir le nouveau mot de passe'}
                </button>
              </form>
            </>
          )}

          {status === 'done' && (
            <>
              <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm text-center font-medium mb-5">
                ✅ Votre mot de passe a été modifié. Redirection vers la connexion…
              </div>
              <Link
                href="/connexion"
                className="block w-full text-center py-3.5 rounded-full text-white font-extrabold tracking-tight text-sm transition shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
