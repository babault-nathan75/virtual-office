'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from '@/components/Link';

type Props = {
  userId: string;
};

type KycInfo = {
  statut: string | null;
  motif_rejet: string | null;
};

const STATUS_LABEL: Record<string, { title: string; badge: string; card: string }> = {
  pending: { title: 'En cours de vérification', badge: 'bg-amber-100 text-amber-700', card: 'bg-amber-50 border-amber-200' },
  approved: { title: 'KYC validé', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-emerald-50 border-emerald-200' },
  rejected: { title: 'KYC rejeté', badge: 'bg-red-100 text-red-700', card: 'bg-red-50 border-red-200' },
};

export default function KycStatusBanner({ userId }: Props) {
  const [kyc, setKyc] = useState<KycInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const subId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const fetchKyc = async () => {
      const { data } = await supabase
        .from('kyc_verifications')
        .select('statut, motif_rejet')
        .eq('user_id', userId)
        .maybeSingle();
      if (!mounted) return;
      setKyc((data ?? null) as KycInfo | null);
      setLoading(false);
    };
    fetchKyc();

    const channel = supabase
      .channel(`kyc-status-${userId}-${subId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kyc_verifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as Partial<{ statut: string | null; motif_rejet: string | null }>;
        setKyc({ statut: row.statut ?? null, motif_rejet: row.motif_rejet ?? null });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) return null;

  const statut = kyc?.statut;
  if (!statut || !STATUS_LABEL[statut]) {
    return (
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-sm font-black text-blue-900 tracking-tight">Vérification d&apos;identité requise</p>
            <p className="text-xs text-blue-700 font-medium">Complétez votre KYC pour accéder à l&apos;ensemble de la plateforme.</p>
          </div>
        </div>
        <Link
          href="/dashboard/kyc"
          className="shrink-0 text-center bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm"
        >
          Commencer la vérification
        </Link>
      </div>
    );
  }

  const style = STATUS_LABEL[statut];
  const isApproved = statut === 'approved';
  const isRejected = statut === 'rejected';

  return (
    <div className={`mb-8 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${style.card}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{isApproved ? '✅' : isRejected ? '❌' : '⏳'}</span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-slate-900 tracking-tight">{style.title}</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide ${style.badge}`}>
              {statut}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {isApproved
              ? 'Votre identité a été vérifiée avec succès par un administrateur.'
              : isRejected
                ? (kyc?.motif_rejet ? `Motif : ${kyc.motif_rejet}` : 'Votre dossier a été refusé. Veuillez soumettre à nouveau vos documents.')
                : 'Votre dossier KYC est en cours de vérification par notre équipe. Délai estimé : 24-48 heures ouvrées.'}
          </p>
        </div>
      </div>
      {isRejected && (
        <Link
          href="/dashboard/kyc"
          className="shrink-0 text-center bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition shadow-sm"
        >
          Resoumettre mon dossier
        </Link>
      )}
    </div>
  );
}
