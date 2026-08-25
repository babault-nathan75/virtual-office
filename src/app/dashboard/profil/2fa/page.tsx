'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import OtpInput from '@/components/OtpInput';
import { Button } from '@/components/ui';
import { AuthAlert } from '@/components/AuthShell';
import TrustedDevices from '@/components/TrustedDevices';
import { supabase } from '@/lib/supabaseClient';
import { roleHomePath, type Role } from '@/lib/roles';

type Step = 'idle' | 'enrolling' | 'enabled';

/**
 * Activation d'une application d'authentification (Google Authenticator,
 * Authy, 1Password…).
 *
 * L'option « code par email » a disparu de cet écran : un code par email est
 * désormais demandé à chaque connexion pour tous les comptes. La présenter
 * comme un réglage à activer décrivait le comportement par défaut et laissait
 * croire, quand elle était éteinte, que le compte n'était pas protégé.
 */
export default function TwoFactorSettingsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<Role>('secretaire');
  const [qrData, setQrData] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/connexion');
        return;
      }

      const [{ data: profil }, { data: tfa }] = await Promise.all([
        supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle(),
        // `secret` n'est plus lisible par le client (GRANT au niveau colonne) :
        // on ne demande que l'état d'activation.
        supabase.from('two_factor_auth').select('enabled').eq('user_id', session.user.id).maybeSingle(),
      ]);

      if (!active) return;
      if (profil?.role) setRole(profil.role as Role);
      if (tfa?.enabled) setStep('enabled');
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  const startEnrollment = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/2fa/setup', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ text: data.error ?? "L'activation a échoué.", type: 'error' });
        return;
      }

      setQrData(data.qrData);
      setSecret(data.secret);
      setStep('enrolling');
    } catch {
      setMessage({ text: 'Connexion au serveur impossible.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const confirmEnrollment = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ text: data.error ?? 'Code incorrect.', type: 'error' });
        setCode('');
        return;
      }

      setStep('enabled');
      setMessage({ text: 'Application d\'authentification activée.', type: 'success' });
    } catch {
      setMessage({ text: 'Connexion au serveur impossible.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" aria-busy="true">
        <span className="sr-only">Chargement…</span>
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
        <Link
          href={roleHomePath(role)}
          className="text-sm text-blue-600 hover:underline font-bold mb-6 inline-block"
        >
          ← Retour au tableau de bord
        </Link>

        {role === 'admin' && step !== 'enabled' && (
          <div role="alert" className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="font-bold text-amber-800 text-sm">
              Application d&apos;authentification obligatoire pour les administrateurs
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Le panneau d&apos;administration donne accès aux données de tous les utilisateurs :
              un second facteur hors email y est exigé.
            </p>
          </div>
        )}

        <section className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(15,23,42,0.08)] p-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Application d&apos;authentification
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Par défaut, un code vous est envoyé par email à chaque connexion. En activant une
            application d&apos;authentification, ce code sera généré hors ligne par votre
            téléphone — plus rapide, et insensible à une compromission de votre boîte mail.
          </p>

          {message && <AuthAlert type={message.type}>{message.text}</AuthAlert>}

          {step === 'enabled' && (
            <div className="text-center py-6">
              <svg className="mx-auto mb-4 h-14 w-14 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path strokeLinecap="round" d="M8 10V7a4 4 0 118 0v3" />
                <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
              </svg>
              <p className="text-emerald-700 font-bold text-lg">Second facteur actif</p>
              <p className="text-slate-500 text-sm mt-2 mb-6">
                Vos codes de connexion proviennent désormais de votre application.
              </p>
              <Link
                href={roleHomePath(role)}
                className="inline-flex items-center justify-center py-3 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
              >
                Retour au tableau de bord
              </Link>
            </div>
          )}

          {step === 'idle' && (
            <Button
              onClick={startEnrollment}
              loading={loading}
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full rounded-xl"
            >
              Activer une application d&apos;authentification
            </Button>
          )}

          {step === 'enrolling' && (
            <div className="space-y-6">
              <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                <li>Ouvrez votre application d&apos;authentification.</li>
                <li>Scannez le QR code ci-dessous.</li>
                <li>Saisissez le code à 6 chiffres qu&apos;elle affiche.</li>
              </ol>

              {qrData && (
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    {/* `unoptimized` : le QR code est une data: URL générée en
                        mémoire, l'optimiseur d'images ne peut pas la traiter. */}
                    <Image src={qrData} alt="QR code d'activation" width={200} height={200} unoptimized />
                  </div>
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowSecret(value => !value)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
                >
                  {showSecret ? 'Masquer la clé' : 'Impossible de scanner ? Saisie manuelle'}
                </button>
                {showSecret && (
                  <p className="mt-2 font-mono text-xs bg-slate-100 px-3 py-2 rounded-lg break-all select-all">
                    {secret}
                  </p>
                )}
              </div>

              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={confirmEnrollment}
                disabled={loading}
                invalid={message?.type === 'error'}
                autoFocus
              />

              <Button
                onClick={() => confirmEnrollment(code)}
                loading={loading}
                disabled={loading || code.length !== 6}
                variant="primary"
                size="lg"
                className="w-full rounded-xl"
              >
                Activer
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('idle');
                  setCode('');
                  setQrData('');
                  setSecret('');
                  setMessage(null);
                }}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 font-bold"
              >
                Annuler
              </button>
            </div>
          )}
        </section>

        <TrustedDevices />
      </div>
    </main>
  );
}
