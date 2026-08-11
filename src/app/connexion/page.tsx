'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/Link';
import PasswordInput from '@/components/PasswordInput';
import { Button, Card } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { connexionSchema, type ConnexionFormData } from '@/lib/validations';

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
        router.replace('/dashboard');
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
        setErrorMsg('Email ou mot de passe incorrect');
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
        const role = (authData.user.user_metadata?.role as string) || 'entreprise';
        try {
          const res = await fetch('/api/ensure-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authData.user.id, nom, role, email: authData.user.email }),
          });
          const result = await res.json();
          finalRole = result.role || role;
        } catch {
          finalRole = role;
        }
      }

      // Admin 2FA mandatory: redirect to 2FA setup if not enabled
      if (finalRole === 'admin' && !tfa?.enabled) {
        router.push(`/dashboard/profil/2fa?required=1`);
        setLoading(false);
        return;
      }

      trackEvent('login_complete', { role: finalRole || 'unknown' });

      if (finalRole === 'entreprise') {
        router.push('/dashboard/entreprise');
      } else if (finalRole === 'secretaire') {
        router.push('/dashboard/secretaire');
      } else if (finalRole === 'admin') {
        router.push('/dashboard/admin');
      } else {
        router.push('/');
      }
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
        <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">Bon retour&nbsp;!</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Connectez-vous à votre espace personnel.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-6 sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm text-center font-medium">{errorMsg}</div>
          )}
          {emailConfirmed && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm text-center font-medium">✅ Email confirmé ! Vous pouvez vous connecter.</div>
          )}
          {justRegistered && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm text-center font-medium">✅ Compte créé ! Connectez-vous.</div>
          )}

          <form onSubmit={handleSubmit(handleSignIn)} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <input type="email" {...register('email')} className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white" placeholder="votre@email.com" autoComplete="email" autoFocus />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-700">Mot de passe</label>
                <Link href="/mot-de-passe-oublie" className="text-xs font-bold text-blue-600 hover:underline">Oublié&nbsp;?</Link>
              </div>
              <PasswordInput required {...register('password')} placeholder="••••••••" autoComplete="current-password" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <Button type="submit" disabled={loading} variant="primary" size="lg" className="w-full mt-2">
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="mt-6 w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
              Pas encore de compte&nbsp;?{' '}
              <Link href="/inscription" className="font-bold text-blue-600 hover:underline">S&apos;inscrire</Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default function Connexion() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ConnexionContent />
    </Suspense>
  );
}
