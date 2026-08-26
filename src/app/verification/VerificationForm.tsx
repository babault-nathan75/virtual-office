'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/Link';
import OtpInput from '@/components/OtpInput';
import Turnstile from '@/components/Turnstile';
import { AuthAlert } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { clearCachedRole } from '@/lib/roleStore';
import { trackEvent } from '@/lib/analytics';

const CODE_LENGTH = 6;

type Props = {
  purpose: 'signup' | 'login';
  /** Canal du second facteur : email, ou application d'authentification. */
  method: 'email' | 'totp';
  email: string;
  siteKey: string;
};

/**
 * Écran de saisie du code à usage unique.
 *
 * Il conclut les deux parcours : inscription (le code prouve la possession de
 * l'adresse email et active le compte) et connexion (le code constitue le
 * second facteur, exigé à chaque ouverture de session).
 */
/**
 * N'accepte qu'un chemin interne.
 *
 * Une destination venue de l'URL est contrôlée par l'attaquant : sans ce
 * filtre, `?suivant=https://exemple-malveillant.test` transformerait l'écran
 * de connexion en tremplin de redirection ouverte — un classique du
 * hameçonnage, d'autant plus crédible qu'il part du vrai domaine.
 */
function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

export default function VerificationForm({ purpose, method, email, siteKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(45);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  /*
   * Coché par défaut : c'est le cas courant, et laisser l'utilisateur ressaisir
   * un code à chaque connexion est précisément ce que ce changement supprime.
   * Décochable pour un poste partagé — cybercafé, ordinateur familial — où
   * mémoriser l'appareil dispenserait le suivant du second facteur.
   */
  const [trustDevice, setTrustDevice] = useState(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      // La saisie complète déclenche l'envoi automatiquement ET le bouton reste
      // cliquable : sans ce garde, les deux se chevauchent et le second appel
      // consomme une tentative avec un code déjà invalidé.
      if (submittingRef.current || value.length !== CODE_LENGTH) return;
      submittingRef.current = true;
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: value, purpose, email, trustDevice }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? 'Vérification impossible.');
          setCode('');
          if (data.next === 'login') {
            setTimeout(() => router.replace('/connexion'), 2500);
          }
          return;
        }

        trackEvent(purpose === 'signup' ? 'signup_verified' : 'login_verified', {
          role: data.role ?? 'unknown',
        });

        // Le rôle en cache appartient à la session précédente : le conserver
        // renvoie vers le mauvais tableau de bord après un changement de compte.
        clearCachedRole();

        // `refresh()` avant la navigation : les composants serveur doivent
        // relire les cookies de session tout juste posés, sinon le tableau de
        // bord se rend encore comme déconnecté.
        router.refresh();
        const suivant = safeInternalPath(searchParams.get('suivant'));
        router.replace(suivant ?? data.redirectTo ?? '/dashboard');
      } catch {
        setError('Connexion au serveur impossible. Vérifiez votre réseau.');
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [purpose, email, router, searchParams, trustDevice]
  );

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          email: purpose === 'signup' ? email : undefined,
          turnstileToken: purpose === 'signup' ? captchaToken : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "L'envoi a échoué.");
        setCooldown(data.cooldownSeconds ?? 45);
        setCaptchaReset(value => value + 1);
        setCaptchaToken('');
        return;
      }

      setNotice(`Un nouveau code a été envoyé à ${email}.`);
      setCode('');
      setCooldown(data.cooldownSeconds ?? 45);
    } catch {
      setError('Connexion au serveur impossible.');
    } finally {
      setResending(false);
    }
  };

  const isTotp = method === 'totp';
  const title = purpose === 'signup' ? 'Vérifiez votre email' : 'Confirmez votre connexion';

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {isTotp ? (
            <>
              Ouvrez votre application d&apos;authentification et saisissez le code à{' '}
              {CODE_LENGTH} chiffres affiché pour SecrétariatPro.
            </>
          ) : (
            <>
              Nous avons envoyé un code à {CODE_LENGTH} chiffres à{' '}
              <span className="font-semibold text-slate-800 break-all">{email}</span>. Il est
              valable 10 minutes. (Vérifier vos spams/indésirables si vous ne voyez pas)
            </>
          )}
        </p>
      </header>

      {error && <AuthAlert type="error">{error}</AuthAlert>}
      {notice && !error && <AuthAlert type="success">{notice}</AuthAlert>}

      <form
        onSubmit={event => {
          event.preventDefault();
          void submit(code);
        }}
        className="space-y-6"
      >
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={value => void submit(value)}
          disabled={loading}
          invalid={Boolean(error)}
          autoFocus
          length={CODE_LENGTH}
        />

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 cursor-pointer hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={event => setTrustDevice(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30"
          />
          <span className="text-sm text-slate-700 leading-snug">
            <span className="font-semibold">Ne plus demander de code sur cet appareil</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Pendant 30 jours. À décocher sur un ordinateur partagé.
            </span>
          </span>
        </label>

        <Button
          type="submit"
          disabled={loading || code.length !== CODE_LENGTH}
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full py-3.5 text-sm font-bold rounded-xl"
        >
          {loading ? 'Vérification…' : 'Valider le code'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        {isTotp ? (
          <p className="text-xs text-slate-400">
            Le code change toutes les 30 secondes. Si la validation échoue de façon répétée,
            vérifiez que l&apos;heure de votre téléphone est réglée automatiquement.
          </p>
        ) : (
          <>
        {purpose === 'signup' && (
          <Turnstile
            siteKey={siteKey}
            action="signup"
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken('')}
            resetSignal={captchaReset}
            className="mb-4 flex justify-center"
          />
        )}

        <p>
          Vous n&apos;avez rien reçu ?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="font-bold text-blue-600 hover:text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed transition"
          >
            {resending
              ? 'Envoi…'
              : cooldown > 0
                ? `Renvoyer dans ${cooldown}s`
                : 'Renvoyer le code'}
          </button>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Pensez à vérifier vos courriers indésirables.
        </p>
          </>
        )}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-5 text-center">
        <Link
          href={purpose === 'signup' ? '/inscription' : '/connexion'}
          className="text-sm font-bold text-slate-600 hover:text-slate-900 hover:underline transition"
        >
          ← Utiliser une autre adresse
        </Link>
      </div>
    </>
  );
}
