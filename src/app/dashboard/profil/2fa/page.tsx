'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';

export default function TwoFASetup() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [method, setMethod] = useState<'totp' | 'email' | null>(null);
  const [qrData, setQrData] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/connexion');
        return;
      }
      setUserId(session.user.id);

      supabase.auth.getUser().then(({ data: { user } }) => {
        setUserRole((user?.user_metadata?.role as string) || 'secretaire');
      });

      supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          setEnabled(data?.enabled || false);
          setChecking(false);
        });
    });
  }, [router]);

  const handleSetup = async (chosenMethod: 'totp' | 'email') => {
    setLoading(true);
    setMessage({ text: '', type: '' });

    const { data: profileData } = await supabase
      .from('profils')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const res = await fetch('/api/2fa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': profileData?.email || '',
      },
      body: JSON.stringify({ userId, method: chosenMethod }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage({ text: data.error, type: 'error' });
      setLoading(false);
      return;
    }

    setMethod(chosenMethod);
    if (data.qrData) setQrData(data.qrData);
    if (data.secret) setSecret(data.secret);
    if (chosenMethod === 'email') {
      setMessage({ text: 'Code envoyé par email ! Vérifiez votre boîte.', type: 'success' });
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);

    const res = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage({ text: data.error, type: 'error' });
      setLoading(false);
      return;
    }

    setEnabled(true);
    setMessage({ text: '2FA activée avec succès !', type: 'success' });
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="max-w-lg mx-auto py-12 px-4">
        <Link href={userRole === 'admin' ? '/dashboard/admin' : userRole === 'entreprise' ? '/dashboard/entreprise' : '/dashboard/secretaire/profil'} className="text-sm text-blue-600 hover:underline font-bold mb-6 inline-block">
          ← Retour au profil
        </Link>

        {userRole === 'admin' && !enabled && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-amber-800 text-sm">2FA obligatoire pour les administrateurs</p>
              <p className="text-xs text-amber-600 mt-1">Vous devez activer l&apos;authentification à deux facteurs pour accéder au panneau d&apos;administration.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Authentification à deux facteurs</h1>
          <p className="text-sm text-slate-500 font-medium mb-8">Sécurisez votre compte avec la 2FA.</p>

          {message.text && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium text-center ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          {enabled ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🔐</div>
              <p className="text-green-700 font-bold text-lg">2FA activée</p>
              <p className="text-slate-500 text-sm mt-2">Votre compte est sécurisé.</p>
            </div>
          ) : !method ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 font-medium mb-4">Choisissez votre méthode :</p>

              <button
                onClick={() => handleSetup('totp')}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">📱</div>
                <div>
                  <p className="font-extrabold text-slate-900">Google Authenticator</p>
                  <p className="text-xs text-slate-500 mt-0.5">Scannez un QR code avec l&apos;appli</p>
                </div>
              </button>

              <button
                onClick={() => handleSetup('email')}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">📧</div>
                <div>
                  <p className="font-extrabold text-slate-900">Code par email</p>
                  <p className="text-xs text-slate-500 mt-0.5">Recevez un code à 6 chiffres par email</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {method === 'totp' && qrData && (
                <div className="text-center">
                  <p className="text-sm text-slate-600 font-medium mb-4">
                    Scannez ce QR code avec Google Authenticator :
                  </p>
                  <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <img src={qrData} alt="QR Code 2FA" width={200} height={200} />
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    Secret : <span className="font-mono bg-slate-100 px-2 py-1 rounded">{secret}</span>
                  </p>
                </div>
              )}

              {method === 'email' && (
                <p className="text-sm text-slate-600 text-center">
                  Un code à 6 chiffres a été envoyé par email.
                </p>
              )}

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
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold tracking-tight text-base transition shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Vérification...' : 'Activer la 2FA'}
              </button>

              <button
                onClick={() => { setMethod(null); setCode(''); setQrData(''); setSecret(''); setMessage({ text: '', type: '' }); }}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 font-bold"
              >
                Changer de méthode
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
