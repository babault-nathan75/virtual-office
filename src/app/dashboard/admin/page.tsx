'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import dynamic from 'next/dynamic';

const StatsCharts = dynamic(() => import('@/components/StatsCharts'), { ssr: false, loading: () => null });

type ContactProfil = {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
};

type Offre = {
  id: number;
  statut: string;
  message: string | null;
  created_at: string;
  entreprise_id: string;
  secretaire_id: string;
  mission_id: number | null;
  missions: { titre: string } | null;
  entreprise: ContactProfil;
  secretaire: ContactProfil;
};

export default function DashboardAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [offresEnAttente, setOffresEnAttente] = useState<Offre[]>([]);
  // Ajout de nbSecretaires et nbEntreprises dans le state des statistiques
  const [stats, setStats] = useState({ enAttente: 0, conclues: 0, nbSecretaires: 0, nbEntreprises: 0 });
  const [acting, setActing] = useState<number | null>(null);
  const [modalConfirm, setModalConfirm] = useState<{ id: number; statut: 'concluee' | 'refusee' } | null>(null);
  const [historique, setHistorique] = useState<{ id: number; created_at: string; mission_titre: string; entreprise_nom: string; secretaire_nom: string }[]>([]);

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: u } = await supabase.from('profils').select('role').eq('id', session.user.id).single();
      if (!u || u.role !== 'admin') {
        setErreur("Accès réservé à l'administrateur.");
        setLoading(false);
        return;
      }

      // Requêtes en parallèle
      const [offresRes, concluesRes, entRes, secRes] = await Promise.all([
        supabase.from('offres')
          .select('id, statut, message, created_at, entreprise_id, secretaire_id, mission_id, missions(titre)')
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: false }),
        supabase.from('offres')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'concluee'),
        supabase.from('offres')
          .select('entreprise_id', { count: 'exact', head: true })
          .eq('statut', 'concluee'),
        supabase.from('offres')
          .select('secretaire_id', { count: 'exact', head: true })
          .eq('statut', 'concluee'),
      ]);

      const offresRaw = offresRes.data;

      if (offresRaw && offresRaw.length > 0) {
        const ids = Array.from(new Set(offresRaw.flatMap(o => [o.entreprise_id, o.secretaire_id])));
        const { data: profs } = await supabase
          .from('profils')
          .select('id, nom, email, telephone')
          .in('id', ids);
        const map = new Map((profs ?? []).map(p => [p.id, p as ContactProfil]));

        setOffresEnAttente(offresRaw.map(o => ({
          ...o,
          entreprise: map.get(o.entreprise_id) ?? { id: o.entreprise_id, nom: '?', email: '', telephone: null },
          secretaire: map.get(o.secretaire_id) ?? { id: o.secretaire_id, nom: '?', email: '', telephone: null },
        })) as unknown as Offre[]);
      }

      setStats({ 
        enAttente: offresRaw?.length ?? 0, 
        conclues: concluesRes.count ?? 0,
        nbEntreprises: entRes.count ?? 0,
        nbSecretaires: secRes.count ?? 0
      });

      // Historique des mises en relation conclues
      const { data: histOffres } = await supabase
        .from('offres')
        .select('id, created_at, mission_id, entreprise_id, secretaire_id, missions(titre)')
        .eq('statut', 'concluee')
        .order('created_at', { ascending: false })
        .limit(20);

      if (histOffres && histOffres.length > 0) {
        const allIds = Array.from(new Set(histOffres.flatMap(o => [o.entreprise_id, o.secretaire_id])));
        const { data: histProfs } = await supabase.from('profils').select('id, nom').in('id', allIds);
        const histMap = new Map((histProfs ?? []).map(p => [p.id, p.nom]));
        setHistorique(histOffres.map(o => ({
          id: o.id,
          created_at: o.created_at,
          mission_titre: (o.missions as any)?.titre ?? '—',
          entreprise_nom: histMap.get(o.entreprise_id) ?? '?',
          secretaire_nom: histMap.get(o.secretaire_id) ?? '?',
        })));
      }

      setLoading(false);
    };
    run();
  }, [router]);

  const gererOffre = async (offreId: number, nouveauStatut: 'concluee' | 'refusee') => {
    setActing(offreId);
    const { error } = await supabase.from('offres').update({ statut: nouveauStatut }).eq('id', offreId);
    if (error) {
      toast.error(error.message);
      setActing(null);
      return;
    }
    setOffresEnAttente(prev => prev.filter(o => o.id !== offreId));
    setStats(prev => ({
      ...prev,
      enAttente: prev.enAttente - 1,
      conclues: prev.conclues + (nouveauStatut === 'concluee' ? 1 : 0),
    }));
    toast.success(nouveauStatut === 'concluee' ? 'Mise en relation finalisée !' : 'Offre refusée');
    setActing(null);
  };

  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold font-sans">
        {erreur}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="bg-slate-900 rounded-3xl p-6 md:p-8 mb-8 shadow-[0_30px_60px_-15px_rgba(15,23,42,0.25)] text-white flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-400 p-3 rounded-2xl text-slate-900 text-2xl">🛡️</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Console d&apos;administration</h1>
              <p className="text-slate-400 font-medium text-sm">Supervision des mises en relation</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => window.location.reload()} className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition">
              Actualiser
            </button>
            <Link href="/dashboard/admin/messages" className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition">
              Messages
            </Link>
            <Link href="/dashboard/admin/kyc" className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition">
              KYC
            </Link>
            <Link href="/dashboard/admin/utilisateurs" className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition">
              Utilisateurs
            </Link>
            <Link href="/profile" className="bg-amber-400/10 text-amber-300 hover:bg-amber-400 hover:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm transition">
              Mon profil
            </Link>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Offres à traiter</p>
            <p className="text-4xl font-black text-slate-900">{stats.enAttente}</p>
          </div>
          
          {/* Card modifiée avec l'ajout des secrétaires et entreprises */}
          <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-200">
            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">Mises en relation conclues</p>
            <div className="flex items-baseline justify-between">
              <p className="text-4xl font-black">{stats.conclues}</p>
              <p className="text-xs font-medium text-emerald-100 bg-emerald-700/50 px-2.5 py-1 rounded-lg">
                🏢 {stats.nbEntreprises} {stats.nbEntreprises > 1 ? 'entreprises' : 'entreprise'} | 👩‍💻 {stats.nbSecretaires} {stats.nbSecretaires > 1 ? 'secrétaires' : 'secrétaire'}
              </p>
            </div>
          </div>
          
          <Link href="/" className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-blue-300 transition flex items-center justify-center text-blue-700 font-bold">
            Voir le site public →
          </Link>
        </div>

        {/* Stats avec graphiques */}
        <StatsCharts />

        <h2 className="text-xl font-black tracking-tight text-slate-900 mb-5 flex items-center gap-2">
          🤝 Offres en attente de finalisation
          {stats.enAttente > 0 && (
            <span className="bg-amber-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-md">{stats.enAttente}</span>
          )}
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold animate-pulse">Chargement...</div>
        ) : offresEnAttente.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
            <p className="text-4xl mb-3">✨</p>
            <p className="text-slate-500 font-bold text-lg">Aucune offre à traiter pour le moment.</p>
            <p className="text-sm text-slate-400 mt-2 font-medium">Les nouvelles offres des entreprises apparaîtront ici.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {offresEnAttente.map(o => {
              const isActing = acting === o.id;
              return (
                <div key={o.id} className="bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] overflow-hidden">

                  <div className="bg-slate-50 p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                        {o.mission_id ? 'Offre suite à candidature' : 'Offre directe'}
                      </span>
                      {o.missions?.titre && (
                        <h3 className="text-lg font-black tracking-tight text-slate-900">
                          Mission « {o.missions.titre} »
                        </h3>
                      )}
                      {!o.missions?.titre && (
                        <h3 className="text-lg font-black tracking-tight text-slate-900">
                          Recherche directe (sans mission)
                        </h3>
                      )}
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Reçue le</p>
                      <p className="font-bold text-slate-700 text-sm">{new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ENTREPRISE */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg">🏢</div>
                        <h4 className="text-sm font-black tracking-tight text-slate-800 uppercase">L&apos;entreprise</h4>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Nom :</span> <span className="font-bold text-slate-900">{o.entreprise.nom}</span></p>
                        <p className="flex justify-between text-sm gap-2"><span className="text-slate-400">Email :</span> <a href={`mailto:${o.entreprise.email}`} className="font-bold text-blue-600 truncate">{o.entreprise.email}</a></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Tél :</span> <span className="font-bold text-slate-900">{o.entreprise.telephone || '—'}</span></p>
                      </div>
                    </div>

                    {/* SECRÉTAIRE */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-emerald-100 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg">👩‍💻</div>
                        <h4 className="text-sm font-black tracking-tight text-slate-800 uppercase">La secrétaire</h4>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Nom :</span> <span className="font-bold text-slate-900">{o.secretaire.nom}</span></p>
                        <p className="flex justify-between text-sm gap-2"><span className="text-slate-400">Email :</span> <a href={`mailto:${o.secretaire.email}`} className="font-bold text-emerald-600 truncate">{o.secretaire.email}</a></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Tél :</span> <span className="font-bold text-slate-900">{o.secretaire.telephone || '—'}</span></p>
                      </div>
                    </div>
                  </div>

                  {o.message && (
                    <div className="px-6 pb-4">
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-sm text-slate-700 italic">
                        « {o.message} »
                      </div>
                    </div>
                  )}

                  <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-3">
                      <button
                        onClick={() => setModalConfirm({ id: o.id, statut: 'concluee' })}
                        disabled={isActing}
                        aria-label="Finaliser la mise en relation"
                        className="flex-1 bg-slate-900 text-white font-extrabold tracking-tight py-3.5 rounded-2xl hover:bg-emerald-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActing ? 'En cours...' : '✓ Mise en relation finalisée'}
                      </button>
                      <button
                        onClick={() => setModalConfirm({ id: o.id, statut: 'refusee' })}
                        disabled={isActing}
                        aria-label="Refuser l'offre"
                        className="bg-white text-slate-500 font-bold px-6 py-3.5 rounded-2xl border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                      Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Historique des mises en relation */}
        {historique.length > 0 && (
          <>
            <h2 className="text-xl font-black tracking-tight text-slate-900 mb-5 mt-10 flex items-center gap-2">
              📋 Historique des mises en relation
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                      <th className="text-left px-5 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Mission</th>
                      <th className="text-left px-5 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Entreprise</th>
                      <th className="text-left px-5 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Secrétaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historique.map(h => (
                      <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-medium text-slate-600">{new Date(h.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-5 py-3 font-bold text-slate-900">{h.mission_titre}</td>
                        <td className="px-5 py-3 font-medium text-blue-600">{h.entreprise_nom}</td>
                        <td className="px-5 py-3 font-medium text-emerald-600">{h.secretaire_nom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={modalConfirm !== null}
        title={modalConfirm?.statut === 'concluee' ? 'Finaliser la mise en relation ?' : 'Refuser cette offre ?'}
        message={modalConfirm?.statut === 'concluee'
          ? 'Cette action validera la mise en relation entre l\'entreprise et la secrétaire. Les coordonnées seront révélées aux deux parties.'
          : 'Êtes-vous sûr de vouloir refuser cette offre ? Cette action est irréversible.'}
        confirmLabel={modalConfirm?.statut === 'concluee' ? 'Oui, finaliser' : 'Refuser'}
        danger={modalConfirm?.statut === 'refusee'}
        onConfirm={() => {
          if (modalConfirm) gererOffre(modalConfirm.id, modalConfirm.statut);
          setModalConfirm(null);
        }}
        onCancel={() => setModalConfirm(null)}
      />
    </div>
  );
}