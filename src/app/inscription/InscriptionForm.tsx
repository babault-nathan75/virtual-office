'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrength from '@/components/PasswordStrength';
import Turnstile from '@/components/Turnstile';
import { AuthAlert } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/analytics';
import { inscriptionSchema, type InscriptionFormData } from '@/lib/validations';

type Props = { siteKey: string };

const FIELD_BASE =
  'w-full rounded-xl border pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:bg-white';

export default function InscriptionForm({ siteKey }: Props) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionSchema),
    mode: 'onBlur',
    defaultValues: {
      nom: '',
      email: '',
      telephone: '',
      password: '',
      confirmPassword: '',
      role: 'entreprise',
    },
  });

  const password = watch('password');
  const role = watch('role');
  const isEntreprise = role === 'entreprise';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
      else setCheckingSession(false);
    });
  }, [router]);

  const onSubmit = async (data: InscriptionFormData) => {
    if (!captchaToken) {
      setMessage({ text: 'Veuillez patienter : vérification anti-robot en cours.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: data.nom,
          email: data.email,
          telephone: data.telephone,
          password: data.password,
          role: data.role,
          turnstileToken: captchaToken,
          website: '',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Un jeton Turnstile n'est valable qu'une fois : sans réinitialisation,
        // toute nouvelle tentative après une erreur échouerait sur le captcha.
        setCaptchaToken('');
        setCaptchaReset(value => value + 1);

        if (result.field === 'email' || result.field === 'password') {
          setError(result.field, { type: 'server', message: result.error });
        }
        setMessage({ text: result.error ?? "L'inscription a échoué.", type: 'error' });
        return;
      }

      trackEvent('signup_submitted', { role: data.role });
      router.push(`/verification?purpose=signup&email=${encodeURIComponent(result.email)}`);
    } catch {
      setCaptchaToken('');
      setCaptchaReset(value => value + 1);
      setMessage({ text: 'Connexion au serveur impossible. Vérifiez votre réseau.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    });
    if (error) setMessage({ text: error.message, type: 'error' });
  };

  if (checkingSession) {
    return (
      <div className="min-h-[320px] flex items-center justify-center" aria-busy="true">
        <span className="sr-only">Chargement…</span>
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const accentRing = isEntreprise
    ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
    : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600';

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Créer un compte
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sélectionnez votre profil et commencez votre expérience.
        </p>
      </header>

      {message && <AuthAlert type={message.type}>{message.text}</AuthAlert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset>
          <legend className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Vous souhaitez
          </legend>
          <div className="grid grid-cols-2 gap-3.5">
            <RoleOption
              selected={isEntreprise}
              onSelect={() => setValue('role', 'entreprise', { shouldValidate: true })}
              accent="blue"
              title="Recruter"
              subtitle="Entreprise"
              iconPath="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-1-4h.01M9 16h.01M9 12h.01M13 16h.01M13 12h.01M14 8h.01M10 8h.01"
            />
            <RoleOption
              selected={!isEntreprise}
              onSelect={() => setValue('role', 'secretaire', { shouldValidate: true })}
              accent="emerald"
              title="Travailler"
              subtitle="Secrétaire"
              iconPath="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="nom"
            label={isEntreprise ? "Nom de l'entreprise" : 'Prénom & Nom'}
            error={errors.nom?.message}
            iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          >
            <input
              id="nom"
              type="text"
              autoComplete={isEntreprise ? 'organization' : 'name'}
              className={`${FIELD_BASE} ${accentRing} ${errors.nom ? 'border-red-300' : 'border-slate-200'}`}
              placeholder={isEntreprise ? 'Ex : Tech Solutions' : 'Ex : Marie DUPONT'}
              aria-invalid={Boolean(errors.nom)}
              {...register('nom')}
            />
          </Field>

          <Field
            id="telephone"
            label="Téléphone"
            error={errors.telephone?.message}
            iconPath="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          >
            <input
              id="telephone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className={`${FIELD_BASE} ${accentRing} ${errors.telephone ? 'border-red-300' : 'border-slate-200'}`}
              placeholder="Ex : +225 01 02 03 04 05"
              aria-invalid={Boolean(errors.telephone)}
              {...register('telephone')}
            />
          </Field>
        </div>

        <Field
          id="email"
          label="Adresse email"
          error={errors.email?.message}
          hint="Le code de vérification y sera envoyé."
          iconPath="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={`${FIELD_BASE} ${accentRing} ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
            placeholder="votre@email.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mot de passe
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-strength"
              {...register('password')}
            />
            <div id="password-strength">
              <PasswordStrength password={password} />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1 font-medium">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirmation
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.confirmPassword)}
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1 font-medium">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {/* Champ leurre : masqué aux humains et aux lecteurs d'écran, rempli
            par les robots qui parcourent le DOM. */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="website">Ne pas remplir</label>
          <input id="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Turnstile
          siteKey={siteKey}
          action="signup"
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken('')}
          resetSignal={captchaReset}
          className="pt-1"
        />

        <p className="text-[11px] text-slate-500 leading-relaxed">
          En vous inscrivant, vous acceptez nos{' '}
          <Link href="/cgu" className="text-slate-700 font-semibold underline hover:text-slate-900">
            Conditions Générales
          </Link>{' '}
          et notre{' '}
          <Link href="/confidentialite" className="text-slate-700 font-semibold underline hover:text-slate-900">
            Politique de Confidentialité
          </Link>
          .
        </p>

        <Button
          type="submit"
          disabled={loading || !captchaToken}
          loading={loading}
          variant="primary"
          size="lg"
          className={`w-full py-3.5 text-sm font-bold rounded-xl shadow-md hover:shadow-lg ${
            isEntreprise
              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
          }`}
        >
          {loading
            ? 'Création en cours…'
            : isEntreprise
              ? 'Créer mon compte Entreprise'
              : 'Créer mon compte Secrétaire'}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex-1 h-px bg-slate-200/80" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ou</span>
        <span className="flex-1 h-px bg-slate-200/80" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all font-semibold text-sm text-slate-700 disabled:opacity-50 hover:border-slate-300 shadow-sm"
      >
        <GoogleIcon />
        Continuer avec Google
      </button>

      <p className="mt-8 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
          Connectez-vous
        </Link>
      </p>
    </>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  iconPath,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  iconPath: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        {children}
        <svg
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath} />
        </svg>
      </div>
      {error ? (
        <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function RoleOption({
  selected,
  onSelect,
  accent,
  title,
  subtitle,
  iconPath,
}: {
  selected: boolean;
  onSelect: () => void;
  accent: 'blue' | 'emerald';
  title: string;
  subtitle: string;
  iconPath: string;
}) {
  const selectedStyles =
    accent === 'blue'
      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
      : 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20';
  const iconStyles =
    accent === 'blue' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
        selected
          ? `${selectedStyles} shadow-sm`
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className={`p-2.5 rounded-xl transition ${selected ? iconStyles : 'bg-slate-100 text-slate-500'}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath} />
        </svg>
      </span>
      <span>
        <span className="block font-bold text-sm leading-tight text-slate-900">{title}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{subtitle}</span>
      </span>
      {selected && (
        <span
          className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
            accent === 'blue' ? 'bg-blue-600' : 'bg-emerald-600'
          }`}
        />
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
