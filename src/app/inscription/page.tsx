'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrength from '@/components/PasswordStrength';
import { Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inscriptionSchema, type InscriptionFormData } from '@/lib/validations';

export default function Inscription() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: { nom: '', email: '', telephone: '', password: '', confirmPassword: '', role: 'entreprise' },
  });

  /* `watch()` de react-hook-form n'est pas mémoïsable : le compilateur React
     signale qu'il n'optimisera pas ce composant. Ce n'est pas corrigeable sans
     abandonner la bibliothèque, et `reactCompiler` est désactivé dans
     next.config.ts — l'avertissement est donc sans effet ici. */
  // eslint-disable-next-line react-hooks/incompatible-library
  const password = watch('password');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleRoleChange = (newRole: 'entreprise' | 'secretaire') => {
    setRole(newRole);
    setValue('role', newRole);
  };

  const handleSignUp = async (data: InscriptionFormData) => {
    setLoading(true);
    setMessage({ text: '', type: '' });

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { nom: data.nom, role, telephone: data.telephone },
      },
    });

    if (error) {
      const msg = error.message;
      if (msg === 'User already registered') {
        setMessage({ text: 'Un compte existe déjà avec cet email.', type: 'error' });
      } else if (msg.includes('Password should be at least')) {
        setMessage({ text: 'Le mot de passe doit contenir au moins 8 caractères.', type: 'error' });
      } else if (msg.includes('Unable to validate email address')) {
        setMessage({ text: 'Adresse email invalide.', type: 'error' });
      } else {
        setMessage({ text: msg, type: 'error' });
      }
      setLoading(false);
      return;
    }

    if (authData.user) {
      if (!authData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
        if (signInError) {
          setMessage({ text: 'Connexion automatique échouée. Veuillez vous connecter manuellement.', type: 'error' });
          setLoading(false);
          return;
        }
      }

      await fetch('/api/ensure-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id, nom: data.nom, role, email: data.email, telephone: data.telephone }),
      });

      await supabase.auth.signOut();
      trackEvent('signup_complete', { role });
      router.push('/connexion?registered=1');
    } else {
      router.push('/connexion');
    }
    setLoading(false);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isEntreprise = role === 'entreprise';

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-100/80 font-sans antialiased">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 transition-all">
        
        {/* Colonne Gauche : Reassurance & Branding Desktop */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-900 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900 via-indigo-950 to-slate-900 p-10 text-white flex-col justify-between relative overflow-hidden">
          
          {/* Lueur ambiante */}
          <div className="absolute top-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* En-tête marque */}
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group mb-8">
              <Image src="/logo.png" alt="Logo SecrétariatPro" width={40} height={40} className="rounded-xl object-contain shadow-md ring-2 ring-white/10 group-hover:scale-105 transition" />
              <span className="text-xl font-black tracking-tight text-white">
                Secrétariat<span className="text-blue-400">Pro</span>
              </span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-blue-200 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Inscrivez-vous dès maintenant
            </div>
            
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Simplifiez votre gestion administrative dès aujourd&apos;hui.
            </h1>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed font-normal">
              Rejoignez l&apos;écosystème leader qui connecte les entreprises exigeantes avec des secrétaires qualifiées.
            </p>
          </div>

          {/* Liste d'avantages avec icônes pro */}
          <div className="relative z-10 my-8 space-y-3.5">
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-200">Profils minutieusement vérifiés</span>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-200">Mise en relation instantanée & fluide</span>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-200">Espace 100% sécurisé et conforme RGPD</span>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Formulaire */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          
          {/* Header Mobile / Logo */}
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
              Créer un compte
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sélectionnez votre profil et commencez votre expérience.
            </p>
          </div>

          {/* Banner de notification */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 transition-all ${
              message.type === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <svg className={`w-5 h-5 shrink-0 ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(handleSignUp)} className="space-y-5">
            
            {/* Choix du profil */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Vous souhaitez
              </label>
              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Option Entreprise */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('entreprise')}
                  className={`relative flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    isEntreprise
                      ? 'border-blue-600 bg-blue-50/40 text-blue-950 shadow-sm ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl transition ${isEntreprise ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-1-4h.01M9 16h.01M9 12h.01M13 16h.01M13 12h.01M14 8h.01M10 8h.01" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight text-slate-900">Recruter</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Entreprise</p>
                  </div>
                  {isEntreprise && (
                    <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
                  )}
                </button>

                {/* Option Secrétaire */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('secretaire')}
                  className={`relative flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    !isEntreprise
                      ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-sm ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl transition ${!isEntreprise ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight text-slate-900">Travailler</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Secrétaire</p>
                  </div>
                  {!isEntreprise && (
                    <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white" />
                  )}
                </button>

              </div>
            </div>

            {/* Champs Nom & Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isEntreprise ? "Nom de l'entreprise" : 'Prénom & Nom'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    {...register('nom')}
                    className={`w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:bg-white ${
                      isEntreprise ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600' : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                    }`}
                    placeholder={isEntreprise ? 'Ex: Tech Solutions' : 'Ex: Marie DUPONT'}
                    autoFocus
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {errors.nom && <p className="text-xs text-red-500 mt-1 font-medium">{errors.nom.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Téléphone
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    {...register('telephone')}
                    className={`w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:bg-white ${
                      isEntreprise ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600' : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                    }`}
                    placeholder="Ex: +225 01 02 03 04 05"
                    autoComplete="tel"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                {errors.telephone && <p className="text-xs text-red-500 mt-1 font-medium">{errors.telephone.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <input
                  type="email"
                  {...register('email')}
                  className={`w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 bg-slate-50/50 text-sm outline-none transition placeholder:text-slate-400 focus:bg-white ${
                    isEntreprise ? 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600' : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                  }`}
                  placeholder="votre@email.com"
                  autoComplete="email"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>}
            </div>

            {/* Mot de passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mot de passe
                </label>
                {/* minLength aligné sur `inscriptionSchema` (8 caractères) :
                    la valeur 6 contredisait la validation réelle. */}
                <PasswordInput required minLength={8} {...register('password')} placeholder="••••••••" autoComplete="new-password" />
                <PasswordStrength password={password} />
                {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmation
                </label>
                <PasswordInput required {...register('confirmPassword')} placeholder="••••••••" autoComplete="new-password" />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            {/* CGU & Confidentialité Notice */}
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              En vous inscrivant, vous acceptez nos{' '}
              <Link href="/cgu" className="text-slate-700 font-semibold underline hover:text-slate-900">
                Conditions Générales
              </Link>{' '}
              et notre{' '}
              <Link href="/confidentialite" className="text-slate-700 font-semibold underline hover:text-slate-900">
                Politique de Confidentialité
              </Link>.
            </p>

            {/* Bouton de Soumission */}
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg ${
                !isEntreprise
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Création en cours...
                </span>
              ) : isEntreprise ? (
                'Créer mon compte Entreprise'
              ) : (
                'Créer mon compte Secrétaire'
              )}
            </Button>
          </form>

          {/* Séparateur */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200/80" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200/80" />
          </div>

          {/* Option Google */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
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

          {/* Pied de carte */}
          <div className="mt-8 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-500 font-normal">
              Vous avez déjà un compte ?{' '}
              <Link href="/connexion" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
                Connectez-vous ici
              </Link>
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}