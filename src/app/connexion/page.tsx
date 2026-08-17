'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import { Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { setCachedRole, getCachedRole, roleHome, type Role } from '@/lib/roleStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { connexionSchema, type ConnexionFormData } from '@/lib/validations';

// Aucune politique de complexité n'est appliquée à la connexion : elle
// appartient à l'inscription (voir `inscriptionSchema`). L'imposer ici
// empêchait purement et simplement les comptes existants — créés avec un mot
// de passe de 8 à 11 caractères, ce qu'autorise l'inscription — de se connecter.

function ConnexionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const emailConfirmed = searchParams.get('confirmed') === '1';
  const justRegistered = searchParams.get('registered') === '1';

  const { register, handleSubmit, formState: { errors } } = useForm<ConnexionFormData>({
    resolver: zodResolver(connexionSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const cachedRole = getCachedRole(session.user.id);
        router.replace(cachedRole ? roleHome(cachedRole) : '/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleSignIn = async (data: ConnexionFormData) => {
    setLoading(true);
    setErrorMsg('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      const msg = authError.message;
      if (msg === 'Invalid login credentials') {
        setErrorMsg('Email ou mot de passe incorrect.');
      } else if (msg.includes('Email not confirmed')) {
        setErrorMsg('Votre email n\'a pas encore été confirmé. Vérifiez votre boîte de réception.');
      } else if (msg.includes('Too many requests')) {
        setErrorMsg('Trop de tentatives. Réessayez dans quelques minutes.');
      } else {
        setErrorMsg(msg);
      }
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { data: tfa } = await supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (tfa?.enabled) {
        router.push(`/connexion/2fa?userId=${authData.user.id}`);
        setLoading(false);
        return;
      }

      const { data: profilData, error: profilError } = await supabase
        .from('profils')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      let finalRole = profilData?.role;

      if (profilError || !profilData) {
        const nom = authData.user.user_metadata?.nom || authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Utilisateur';
        // user_metadata est modifiable par le client : on n'en accepte que les
        // rôles non privilégiés, jamais « admin ».
        const metaRole = authData.user.user_metadata?.role;
        const role = metaRole === 'secretaire' ? 'secretaire' : 'entreprise';
        try {
          const res = await fetch('/api/ensure-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authData.user.id, nom, role }),
          });
          const result = await res.json();
          finalRole = result.role || role;
        } catch {
          finalRole = role;
        }
      }

      if (finalRole === 'admin' && !tfa?.enabled) {
        router.push(`/dashboard/profil/2fa?required=1`);
        setLoading(false);
        return;
      }

      trackEvent('login_complete', { role: finalRole || 'unknown' });

      setCachedRole(finalRole as Role, authData.user.id);

      if (finalRole === 'entreprise') {
        router.push('/dashboard/entreprise');
      } else if (finalRole === 'secretaire') {
        router.push('/dashboard/secretaire');
      } else if (finalRole === 'admin') {
        router.push('/dashboard/admin');
      } else {
        router.push('/');
      }
    } else {
      // Sans utilisateur ni erreur, le bouton resterait bloqué sur
      // « Connexion en cours… » indéfiniment.
      setErrorMsg('Connexion impossible. Veuillez réessayer.');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-100/80 font-sans antialiased">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 transition-all">
        
        {/* Colonne Gauche : Branding & Reassurance Desktop */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-900 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900 via-indigo-950 to-slate-900 p-10 text-white flex-col justify-between relative overflow-hidden">
          
          {/* Lueur ambiante */}
          <div className="absolute top-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Logo & Headline */}
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group mb-10">
              <Image src="/logo.png" alt="Logo SecrétariatPro" width={44} height={44} className="rounded-xl object-contain shadow-md ring-2 ring-white/10 group-hover:scale-105 transition" />
              <span className="text-xl font-black tracking-tight text-white">
                Secrétariat<span className="text-blue-400">Pro</span>
              </span>
            </Link>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Ravi de vous revoir sur votre espace dédié.
            </h1>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed font-normal">
              Accédez instantanément à vos dossiers, votre réseau de secrétaires et vos outils de gestion administrative.
            </p>
          </div>

          {/* Reassurance Items */}
          <div className="relative z-10 my-8 space-y-3.5">
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-200">Connexion chiffrée</span>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-200">Authentification forte</span>
            </div>
          </div>

        </div>

        {/* Colonne Droite : Formulaire */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          
          {/* Header Mobile / Brand Logo */}
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.png" alt="Logo SecrétariatPro" width={38} height={38} className="rounded-xl object-contain shadow-md" />
              <span className="text-xl font-black tracking-tight text-slate-900">
                Secrétariat<span className="text-blue-600">Pro</span>
              </span>
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Bon retour !
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Veuillez saisir vos identifiants pour vous connecter.
            </p>
          </div>

          {/* Notifications & Alerts */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 border border-red-200 text-sm font-medium flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {emailConfirmed && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Email confirmé ! Vous pouvez à présent vous connecter.</span>
            </div>
          )}

          {justRegistered && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Compte créé avec succès ! Connectez-vous ci-dessous.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(handleSignIn)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <input
                  type="email"
                  {...register('email')}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white"
                  placeholder="votre@email.com"
                  autoComplete="email"
                  autoFocus
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mot de passe
                </label>
                <Link href="/mot-de-passe-oublie" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
                  Oublié ?
                </Link>
              </div>
              <PasswordInput
                required
                {...register('password')}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>}
            </div>

            {/* La case « Se souvenir de moi » a été retirée : elle n'était
                reliée à aucun état ni à aucune option de session, et laissait
                donc croire à un choix sans effet. La session Supabase est
                persistante par défaut. */}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full py-3.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion en cours...
                </span>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          {/* Separator */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200/80" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200/80" />
          </div>

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all font-semibold text-sm text-slate-700 disabled:opacity-50 hover:border-slate-300 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          {/* Card Footer */}
          <div className="mt-8 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-500 font-normal">
              Pas encore de compte ?{' '}
              <Link href="/inscription" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
                S&apos;inscrire maintenant
              </Link>
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function Connexion() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConnexionContent />
    </Suspense>
  );
}