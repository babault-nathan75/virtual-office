'use client';

import { useEffect, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import { getKycSignedUrl, KYC_BUCKETS } from '@/lib/kycStorage';
import { formatDate } from '@/lib/i18n';

type KycEntry = {
  id: string;
  user_id: string;
  statut: string;
  prenom: string;
  nom: string | null;
  date_naissance: string;
  nationalite: string | null;
  type_compte: string;
  piece_identite_url: string;
  selfie_url: string;
  document_entreprise_url: string | null;
  nom_entreprise: string | null;
  created_at: string;
  updated_at: string | null;
  derniere_soumission_at: string | null;
  motif_rejet: string | null;
  user_nom: string;
  user_email: string;
};

/**
 * Date de la dernière soumission par l'utilisateur.
 * Repli sur `created_at` pour les dossiers antérieurs à la migration 008.
 */
function dateSoumission(kyc: Pick<KycEntry, 'derniere_soumission_at' | 'created_at'>) {
  return kyc.derniere_soumission_at ?? kyc.created_at;
}

/** Un dossier resoumis a une date de soumission postérieure à sa création. */
function estResoumis(kyc: Pick<KycEntry, 'derniere_soumission_at' | 'created_at'>) {
  if (!kyc.derniere_soumission_at) return false;
  return new Date(kyc.derniere_soumission_at).getTime() - new Date(kyc.created_at).getTime() > 60_000;
}

export default function AdminKycPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kycList, setKycList] = useState<KycEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [acting, setActing] = useState<string | null>(null);
  const [selectedKyc, setSelectedKyc] = useState<KycEntry | null>(null);
  const [signedUrls, setSignedUrls] = useState<{ piece: string; selfie: string; doc: string | null } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEscapeKey(selectedKyc !== null, () => { setSelectedKyc(null); setSignedUrls(null); });
  useEscapeKey(rejectModal !== null, () => { setRejectModal(null); setRejectReason(''); });

  const openDetails = async (kyc: KycEntry) => {
    setSelectedKyc(kyc);
    setSignedUrls(null);
    const [piece, selfie, doc] = await Promise.all([
      getKycSignedUrl(KYC_BUCKETS.piece_identite, kyc.piece_identite_url || ''),
      getKycSignedUrl(KYC_BUCKETS.selfie, kyc.selfie_url || ''),
      getKycSignedUrl(KYC_BUCKETS.document_entreprise, kyc.document_entreprise_url || ''),
    ]);
    setSignedUrls({ piece: piece ?? '', selfie: selfie ?? '', doc });
  };

  async function loadKyc() {
    const { data: kycs } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('type_compte', 'secretaire');

    if (!kycs) return;

    // Tri effectué côté client sur la date de dernière soumission : un dossier
    // corrigé après refus doit remonter en tête de file, alors qu'un tri SQL
    // sur `created_at` le laissait au fond.
    kycs.sort(
      (a, b) => new Date(dateSoumission(b)).getTime() - new Date(dateSoumission(a)).getTime()
    );

    // Récupérer les infos des utilisateurs
    const userIds = kycs.map(k => k.user_id);
    const { data: profils } = await supabase
      .from('profils')
      .select('id, nom, email')
      .in('id', userIds);

    const profilMap = new Map((profils ?? []).map(p => [p.id, p]));

    setKycList(kycs.map(k => ({
      ...k,
      user_nom: profilMap.get(k.user_id)?.nom ?? '—',
      user_email: profilMap.get(k.user_id)?.email ?? '—',
    })) as KycEntry[]);
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: profil } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (!profil || profil.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      await loadKyc();
      setLoading(false);
    };
    fetchData();
  }, [router]);

  const handleApprove = async (kycId: string) => {
    setActing(kycId);
    const kyc = kycList.find(k => k.id === kycId);

    const { error } = await supabase
      .from('kyc_verifications')
      .update({ statut: 'approved', updated_at: new Date().toISOString() })
      .eq('id', kycId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('KYC approuvé !');
      setKycList(prev => prev.map(k => k.id === kycId ? { ...k, statut: 'approved', updated_at: new Date().toISOString() } : k));

      // Notify user (email + in-app)
      if (kyc) {
        fetch('/api/kyc/notify-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: kyc.user_id, statut: 'approved' }),
        }).catch(() => {});
      }
    }
    setActing(null);
  };

  const handleReject = async () => {
    if (rejectModal === null) return;
    if (!rejectReason.trim()) {
      toast.error('Veuillez saisir un motif de rejet.');
      return;
    }
    setActing(rejectModal);
    const kyc = kycList.find(k => k.id === rejectModal);

    const { error } = await supabase
      .from('kyc_verifications')
      .update({
        statut: 'rejected',
        updated_at: new Date().toISOString(),
        motif_rejet: rejectReason.trim() || null,
      })
      .eq('id', rejectModal);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('KYC refusé.');
      setKycList(prev => prev.map(k => k.id === rejectModal ? { ...k, statut: 'rejected', motif_rejet: rejectReason.trim() || null } : k));

      // Notify user (email + in-app)
      if (kyc) {
        fetch('/api/kyc/notify-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: kyc.user_id, statut: 'rejected', motif: rejectReason.trim() }),
        }).catch(() => {});
      }
    }
    setRejectModal(null);
    setRejectReason('');
    setActing(null);
  };

  const filtered = kycList.filter(k => filter === 'all' || k.statut === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/admin" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition">
          ← Console d&apos;administration
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Vérifications KYC</h1>
          <p className="text-slate-500 font-medium mt-1">
            {kycList.filter(k => k.statut === 'pending').length} demande(s) en attente
          </p>
        </header>

        {/* Filtres */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight border-2 transition ${
                filter === f
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvés' : 'Refusés'}
              {f === 'pending' && ` (${kycList.filter(k => k.statut === 'pending').length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-slate-500 font-medium">Aucune vérification {filter === 'pending' ? 'en attente' : 'trouvée'}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(kyc => (
              <div key={kyc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold bg-emerald-100 text-emerald-700`}>
                      {kyc.prenom.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 tracking-tight">{kyc.prenom} {kyc.nom}</h3>
                      <p className="text-xs text-slate-500 font-medium">{kyc.user_email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        👩‍💻 Secrétaire ·{' '}
                        {estResoumis(kyc) ? (
                          <>
                            <span className="font-bold text-blue-600">
                              Resoumis le {formatDate(dateSoumission(kyc))}
                            </span>
                            {' '}(dossier initial du {formatDate(kyc.created_at)})
                          </>
                        ) : (
                          <>Soumis le {formatDate(dateSoumission(kyc))}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => openDetails(kyc)}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                    >
                      Voir détails
                    </button>
                    {kyc.statut === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(kyc.id)}
                          disabled={acting === kyc.id}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {acting === kyc.id ? '...' : '✓ Approuver'}
                        </button>
                        <button
                          onClick={() => setRejectModal(kyc.id)}
                          disabled={acting === kyc.id}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          ✕ Refuser
                        </button>
                      </>
                    )}
                    {kyc.statut === 'approved' && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✓ Approuvé</span>
                    )}
                    {kyc.statut === 'rejected' && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">✕ Refusé</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale détails */}
      {selectedKyc && (
        <div role="dialog" aria-modal="true" aria-label="Dossier KYC" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={() => { setSelectedKyc(null); setSignedUrls(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Dossier KYC — {selectedKyc.prenom} {selectedKyc.nom}
              </h3>
              <button onClick={() => { setSelectedKyc(null); setSignedUrls(null); }} className="text-slate-400 hover:text-slate-900 text-2xl font-light">&times;</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Prénoms</p>
                  <p className="text-sm font-bold text-slate-800">{selectedKyc.prenom}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Nom</p>
                  <p className="text-sm font-bold text-slate-800">{selectedKyc.nom || '—'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Date de naissance</p>
                  <p className="text-sm font-bold text-slate-800">{selectedKyc.date_naissance}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Nationalité</p>
                  <p className="text-sm font-bold text-slate-800">{selectedKyc.nationalite || '—'}</p>
                </div>
              </div>

              {selectedKyc.nom_entreprise && (
                <div className="bg-blue-50 p-3 rounded-xl">
                  <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-0.5">Entreprise</p>
                  <p className="text-sm font-bold text-blue-900">{selectedKyc.nom_entreprise}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">📄 Pièce d&apos;identité</p>
                {signedUrls?.piece ? (
                  <a href={signedUrls.piece} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm font-bold hover:underline">
                    Voir le document →
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Chargement…</span>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">🤳 Selfie</p>
                {signedUrls?.selfie ? (
                  <a href={signedUrls.selfie} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm font-bold hover:underline">
                    Voir le selfie →
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Chargement…</span>
                )}
              </div>

              {selectedKyc.document_entreprise_url && (
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">🏢 Document entreprise</p>
                  {signedUrls?.doc ? (
                    <a href={signedUrls.doc} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm font-bold hover:underline">
                      Voir le document →
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Chargement…</span>
                  )}
                </div>
              )}

              {selectedKyc.motif_rejet && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                  <p className="text-xs font-bold text-red-700 mb-1">Raison du refus</p>
                  <p className="text-sm text-red-900">{selectedKyc.motif_rejet}</p>
                </div>
              )}

              {selectedKyc.statut === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => { handleApprove(selectedKyc.id); setSelectedKyc(null); setSignedUrls(null); }}
                    disabled={acting === selectedKyc.id}
                    className="flex-1 py-3 rounded-full bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition shadow-lg disabled:opacity-50"
                  >
                    ✓ Approuver
                  </button>
                  <button
                    onClick={() => { setRejectModal(selectedKyc.id); setSelectedKyc(null); setSignedUrls(null); }}
                    disabled={acting === selectedKyc.id}
                    className="flex-1 py-3 rounded-full bg-red-50 text-red-600 font-bold border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    ✕ Refuser
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale refus */}
      {rejectModal !== null && (
        <div role="dialog" aria-modal="true" aria-label="Motif du refus" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[101]" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-900 mb-1">Raison du refus</h3>
            <p className="text-xs text-slate-500 mb-3">Ce motif sera transmis à l&apos;utilisateur pour qu&apos;il puisse corriger son dossier.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex: Document illisible, photo floue, informations non conformes..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500 transition resize-none"
            />
            {!rejectReason.trim() && (
              <p className="text-xs text-red-500 mt-1 font-medium">Le motif est obligatoire</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition">
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
