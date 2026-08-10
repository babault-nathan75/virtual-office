'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrength from '@/components/PasswordStrength';
import { Button, Card } from '@/components/ui';
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

  const { register, handleSubmit, watch, formState: { errors } } = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: { nom: '', email: '', telephone: '', password: '', confirmPassword: '', role: 'entreprise' },
  });

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
      setMessage({ text: error.message, type: 'error' });
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
        body: JSON.stringify({ userId: authData.user.id, nom: data.nom, role, email: data.email }),
      });

      await supabase.auth.signOut();
      trackEvent('signup_complete', { role });
      window.location.href = '/connexion?registered=1';
    } else {
      window.location.href = '/connexion';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition">
          <img src="/logo.png" alt="Logo SecrétariatPro" width={72} height={72} className="rounded-2xl mb-3 object-contain shadow-lg shadow-blue-100" />
          <span className="text-2xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>
        <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">Créer un compte</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Rejoignez la plateforme en quelques secondes.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-6 sm:px-10">
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium text-center ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit(handleSignUp)} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 text-center tracking-tight">Quel est votre objectif&nbsp;?</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setRole('entreprise')} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === 'entreprise' ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm scale-[1.02]' : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-slate-50'}`}>
                  <span className="text-3xl mb-1">🏢</span>
                  <span className="font-extrabold text-sm tracking-tight">Recruter</span>
                  <span className="text-[10px] mt-0.5 text-slate-400 font-medium">Je suis une entreprise</span>
                </button>
                <button type="button" onClick={() => setRole('secretaire')} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === 'secretaire' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm scale-[1.02]' : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-slate-50'}`}>
                  <span className="text-3xl mb-1">👩‍💻</span>
                  <span className="font-extrabold text-sm tracking-tight">Travailler</span>
                  <span className="text-[10px] mt-0.5 text-slate-400 font-medium">Je suis secrétaire</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{role === 'entreprise' ? "Nom de l'entreprise ou du gérant" : 'Prénom(s) et Nom'}</label>
              <input type="text" {...register('nom')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={role === 'entreprise' ? 'Ex: Tech Solutions' : 'Ex: Marie DUPONT'} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Numéro de téléphone</label>
              <input type="tel" {...register('telephone')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: +225 01 02 03 04 05" />
              {errors.telephone && <p className="text-xs text-red-500 mt-1">{errors.telephone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Adresse email</label>
              <input type="email" {...register('email')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="votre@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Mot de passe</label>
                <PasswordInput required minLength={6} {...register('password')} placeholder="••••••••" autoComplete="new-password" />
                <PasswordStrength password={password} />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Confirmer</label>
                <PasswordInput required {...register('confirmPassword')} placeholder="••••••••" autoComplete="new-password" />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" disabled={loading} variant="primary" size="lg" className={`w-full mt-2 ${role === 'secretaire' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-200' : ''}`}>
              {loading ? 'Création en cours...' : role === 'entreprise' ? 'Créer mon compte Entreprise' : 'Créer mon compte Secrétaire'}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button type="button" onClick={handleGoogleSignUp} disabled={loading} className="mt-6 w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-600 font-medium">
              Vous avez déjà un compte&nbsp;?{' '}
              <Link href="/connexion" className="font-bold text-blue-600 hover:underline">Connectez-vous ici</Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
