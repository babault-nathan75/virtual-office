'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';

type KycStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'error';

export default function KycGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<KycStatus>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkKyc = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: profil } = await supabase
        .from('profils')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // Les admins bypassent le KYC
      if (profil?.role === 'admin') {
        setStatus('approved');
        setLoading(false);
        return;
      }

      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('status')
        .eq('user_id', session.user.id)
        .single();

      if (!kyc) {
        setStatus('none');
      } else {
        setStatus(kyc.status as KycStatus);
      }
      setLoading(false);
    };

    checkKyc();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Pas de KYC soumis → obligatoire
  if (status === 'none') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Vérification requise
          </h1>
          <p className="text-slate-500 font-medium text-sm mb-6">
            Pour accéder à la plateforme, vous devez compléter la vérification de votre identité (KYC).
          </p>
          <Link
            href="/dashboard/kyc"
            className="block w-full py-3.5 rounded-full bg-blue-600 text-white font-extrabold tracking-tight hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            Commencer la vérification
          </Link>
        </div>
      </div>
    );
  }

  // KYC en attente
  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Vérification en cours
          </h1>
          <p className="text-slate-500 font-medium text-sm mb-4">
            Votre dossier KYC est en cours de vérification par notre équipe.
            Vous recevrez un email une fois la vérification terminée.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-xs text-amber-800 font-bold">
              Délai estimé : 24-48 heures ouvrées
            </p>
          </div>
          <Link
            href="/"
            className="block w-full py-3.5 rounded-full bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition text-sm"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  // KYC rejeté → permettre de resoumettre
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Vérification refusée
          </h1>
          <p className="text-slate-500 font-medium text-sm mb-6">
            Votre dossier KYC a été refusé. Veuillez soumettre à nouveau vos documents.
          </p>
          <Link
            href="/dashboard/kyc"
            className="block w-full py-3.5 rounded-full bg-blue-600 text-white font-extrabold tracking-tight hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            Resoumettre mes documents
          </Link>
        </div>
      </div>
    );
  }

  // KYC approuvé → accès complet
  return <>{children}</>;
}
