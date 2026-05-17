'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function MotDePasseOublie() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Si déjà connecté, rediriger vers le dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const redirectTo = `${window.location.origin}/reinitialisation`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({
        text: 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé. Vérifiez votre boîte (et les spams).',
        type: 'success',
      });
      setEmail('');
    }
    setLoading(false);
  };

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
          Mot de passe oublié&nbsp;?
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Saisissez votre email, nous vous envoyons un lien pour le réinitialiser.
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Adresse email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="votre@email.com"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 rounded-full text-white font-extrabold tracking-tight text-base bg-blue-600 hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-600 font-medium">
              <Link href="/connexion" className="font-bold text-blue-600 hover:underline">
                ← Retour à la connexion
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
