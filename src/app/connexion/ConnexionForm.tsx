'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import Turnstile from '@/components/Turnstile';
import { AuthAlert } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/analytics';
import { clearCachedRole, getCachedRole, roleHome } from '@/lib/roleStore';
import { connexionSchema, type ConnexionFormData } from '@/lib/validations';

type Props = { siteKey: string };

/**
 * N'accepte qu'un chemin interne : une destination venue de l'URL est
 * contrôlée par l'attaquant, et sans ce filtre la connexion deviendrait un
 * tremplin de redirection ouverte depuis le vrai domaine.
 */
function safeInternalPath(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

export default function ConnexionForm({ siteKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  const verified = searchParams.get('verified') === '1';
  const registered = searchParams.get('registered') === '1';
  const loggedOut = searchParams.get('deconnexion') === '1';
  // Destination mémorisée par le proxy quand une page protégée a été demandée
  // sans session. Conservée telle quelle ici ; c'est l'écran de vérification
  // qui la valide avant de l'utiliser.
  const suivant = searchParams.get('suivant') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnexionFormData>({
    resolver: zodResolver(connexionSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const cached = getCachedRole(session.user.id);
        router.replace(cached ? roleHome(cached) : '/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const onSubmit = async (data: ConnexionFormData) => {
    if (!captchaToken) {
      setErrorMsg('Veuillez patienter : vérification anti-robot en cours.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          turnstileToken: captchaToken,
          website: '',
        }),
      });

      const result = await response.json();

      // Un jeton Turnstile est à usage unique : qu'on aille vers l'étape OTP ou
      // qu'on affiche une erreur, celui-ci est consommé.
      setCaptchaToken('');
      setCaptchaReset(value => value + 1);

      if (!response.ok && result.next !== 'verify') {
        setErrorMsg(result.error ?? 'Connexion impossible.');
        return;
      }

      /*
       * Appareil de confiance : le second facteur a déjà été validé sur cet
       * appareil il y a moins de 30 jours, la session est ouverte directement.
       */
      if (result.next === 'done') {
        trackEvent('login_trusted_device', { role: result.role ?? 'unknown' });
        clearCachedRole();
        // Les composants serveur doivent relire les cookies de session tout
        // juste posés, sinon la page suivante se rend encore comme déconnectée.
        router.refresh();
        router.replace(safeInternalPath(suivant) ?? result.redirectTo ?? '/dashboard');
        return;
      }

      const purpose = result.purpose === 'signup' ? 'signup' : 'login';
      trackEvent('login_password_ok', {});

      const params = new URLSearchParams({
        purpose,
        email: result.email ?? data.email,
      });
      if (suivant) params.set('suivant', suivant);
      router.push(`/verification?${params.toString()}`);
    } catch {
      setCaptchaToken('');
      setCaptchaReset(value => value + 1);
      setErrorMsg('Connexion au serveur impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErrorMsg(error.message);
  };

  if (checkingSession) {
    return (
      <div className="min-h-[320px] flex items-center justify-center" aria-busy="true">
        <span className="sr-only">Chargement…</span>
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Bon retour !
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Saisissez vos identifiants. Un code de vérification vous sera ensuite envoyé par email.
        </p>
      </header>

      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}
      {verified && !errorMsg && (
        <AuthAlert type="success">Compte vérifié ! Vous pouvez maintenant vous connecter.</AuthAlert>
      )}
      {registered && !errorMsg && (
        <AuthAlert type="success">Compte créé avec succès. Connectez-vous ci-dessous.</AuthAlert>
      )}
      {loggedOut && !errorMsg && <AuthAlert type="info">Vous avez été déconnecté.</AuthAlert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Adresse email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              className={`w-full rounded-xl border pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white ${
                errors.email ? 'border-red-300' : 'border-slate-200'
              }`}
              placeholder="votre@email.com"
              {...register('email')}
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          {errors.email && <p className="text-xs text-red-600 mt-1 font-medium">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mot de passe
            </label>
            <Link href="/mot-de-passe-oublie" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
              Oublié ?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={Boolean(errors.password)}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-600 mt-1 font-medium">{errors.password.message}</p>
          )}
        </div>

        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="website-login">Ne pas remplir</label>
          <input id="website-login" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Turnstile
          siteKey={siteKey}
          action="login"
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken('')}
          resetSignal={captchaReset}
        />

        <Button
          type="submit"
          disabled={loading || !captchaToken}
          loading={loading}
          variant="primary"
          size="lg"
          className="w-full py-3.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg shadow-blue-600/20"
        >
          {loading ? 'Vérification…' : 'Continuer'}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex-1 h-px bg-slate-200/80" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ou</span>
        <span className="flex-1 h-px bg-slate-200/80" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all font-semibold text-sm text-slate-700 disabled:opacity-50 hover:border-slate-300 shadow-sm"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continuer avec Google
      </button>

      <p className="mt-8 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
          S&apos;inscrire
        </Link>
      </p>
    </>
  );
}
