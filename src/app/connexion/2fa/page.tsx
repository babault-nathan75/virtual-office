'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/Link';
import { Suspense } from 'react';
import { toast } from '@/components/Toast';

function TwoFAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!userId) router.replace('/connexion');
  }, [userId, router]);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/2fa/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Code invalide');
      setLoading(false);
      return;
    }

    const { data: profilData } = await supabase
      .from('profils')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const role = profilData?.role;
    if (role === 'admin') router.push('/dashboard/admin');
    else if (role === 'entreprise') router.push('/dashboard/entreprise');
    else router.push('/dashboard/secretaire');
  };

  const handleSendEmail = async () => {
    setSending(true);
    setError('');

    const res = await fetch('/api/2fa/email-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Erreur lors de l\'envoi');
    } else {
      setError('');
      toast.success('Code envoyé par email !');
    }
    setSending(false);
  };

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition">
          <img src="/logo.png" alt="Logo SecrétariatPro" width={72} height={72} className="rounded-2xl mb-3 object-contain shadow-lg shadow-blue-100" />
          <span className="text-2xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>
        <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">Vérification 2FA</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Entrez le code de votre application d&apos;authentification.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleValidate} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Code à 6 chiffres</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-slate-200 px-4 py-4 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full mt-2 py-4 rounded-full text-white font-extrabold tracking-tight text-base transition shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="text-sm text-blue-600 hover:underline font-bold"
            >
              {sending ? 'Envoi en cours...' : 'Recevoir le code par email'}
            </button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <Link href="/connexion" className="text-sm font-bold text-slate-600 hover:underline">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Connexion2FA() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <TwoFAContent />
    </Suspense>
  );
}
