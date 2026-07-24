'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
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

// Fonction utilitaire pour générer des initiales
const getInitials = (name: string) => {
  return name.substring(0, 2).toUpperCase();
};

// Vérifier si une offre a moins de 24h
const isRecent = (dateString: string) => {
  const diff = new Date().getTime() - new Date(dateString).getTime();
  return diff < 24 * 60 * 60 * 1000;
};

export default function DashboardAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [offresEnAttente, setOffresEnAttente] = useState<Offre[]>([]);
  const [stats, setStats] = useState({ enAttente: 0, conclues: 0, nbSecretaires: 0, nbEntreprises: 0 });
  const [acting, setActing] = useState<number | null>(null);
  const [modalConfirm, setModalConfirm] = useState<{ id: number; statut: 'concluee' | 'refusee' } | null>(null);
  const [historique, setHistorique] = useState<{ id: number; created_at: string; mission_titre: string; entreprise_nom: string; secretaire_nom: string }[]>([]);

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: u } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (!u || u.role !== 'admin') {
        setErreur("Accès réservé à l'administrateur.");
        setLoading(false);
        return;
      }

      const [offresRes, concluesRes, entRes, secRes] = await Promise.all([
        supabase.from('offres')
          .select('id, statut, message, created_at, entreprise_id, secretaire_id, mission_id, missions(titre)')
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: false }),
        supabase.from('offres').select('id', { count: 'exact', head: true }).eq('statut', 'concluee'),
        supabase.from('offres').select('entreprise_id', { count: 'exact', head: true }).eq('statut', 'concluee'),
        supabase.from('offres').select('secretaire_id', { count: 'exact', head: true }).eq('statut', 'concluee'),
      ]);

      const offresRaw = offresRes.data;

      if (offresRaw && offresRaw.length > 0) {
        const ids = Array.from(new Set(offresRaw.flatMap(o => [o.entreprise_id, o.secretaire_id])));
        const { data: profs } = await supabase.from('profils').select('id, nom, email, telephone').in('id', ids);
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
    toast.success(nouveauStatut === 'concluee' ? 'Mise en relation finalisée !' : 'Offre refusée avec succès.');
    setActing(null);
  };

  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Accès refusé</h2>
          <p className="text-slate-500">{erreur}</p>
          <button onClick={() => router.push('/')} className="mt-6 w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition">Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header Amélioré */}
        <header className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-2xl shadow-slate-900/20 text-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
          {/* Décoration de fond */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 rounded-2xl shadow-lg shadow-orange-500/20">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Console d'administration</h1>
              <p className="text-slate-400 font-medium mt-1">Supervision globale de la plateforme</p>
            </div>
          </div>
          
          <nav className="flex gap-3 flex-wrap relative z-10 w-full xl:w-auto">
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition text-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Actualiser
            </button>
            <Link href="/dashboard/admin/messages" className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition text-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Discussions
            </Link>
            <Link href="/dashboard/admin/kyc" className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition text-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              KYC
            </Link>
            <Link href="/dashboard/admin/utilisateurs" className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition text-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Utilisateurs
            </Link>
            <Link href="/dashboard/admin/stats" className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition text-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Statistiques
            </Link>
            <Link href="/profile" className="flex items-center gap-2 bg-amber-400 text-slate-900 hover:bg-amber-300 px-4 py-2.5 rounded-xl font-bold text-sm transition ml-auto xl:ml-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Mon profil
            </Link>
          </nav>
        </header>

        {/* Stats avec layout amélioré */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-colors">
            <div className="absolute top-0 right-0 bg-amber-50 w-24 h-24 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Offres à traiter</p>
            <p className="text-5xl font-black text-slate-900 relative z-10">{stats.enAttente}</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-[2rem] text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-white/10 w-32 h-32 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <p className="text-[11px] font-black text-emerald-100 uppercase tracking-widest mb-2 relative z-10">Mises en relation conclues</p>
            <div className="flex flex-col justify-between relative z-10 h-full">
              <p className="text-5xl font-black mb-2">{stats.conclues}</p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  {stats.nbEntreprises} Ent.
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {stats.nbSecretaires} Sec.
                </span>
              </div>
            </div>
          </div>
          
          <Link href="/" className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center text-center group cursor-pointer">
            <div className="bg-blue-50 text-blue-600 p-4 rounded-full mb-3 group-hover:scale-110 group-hover:bg-blue-100 transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </div>
            <span className="text-slate-800 font-bold">Voir le site public</span>
            <span className="text-xs text-slate-400 mt-1">Quitter l'administration</span>
          </Link>
        </div>

        <StatsCharts />

        {/* Section Offres en attente */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              À valider
              {stats.enAttente > 0 && (
                <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-lg">
                  {stats.enAttente} attente{stats.enAttente > 1 ? 's' : ''}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            /* Skeleton Loading State */
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-[2rem] border border-slate-100 p-6 animate-pulse">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-6 bg-slate-200 rounded-md w-1/3"></div>
                    <div className="h-8 bg-slate-100 rounded-lg w-24"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-32 bg-slate-50 rounded-2xl"></div>
                    <div className="h-32 bg-slate-50 rounded-2xl"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : offresEnAttente.length === 0 ? (
            /* Empty State Amélioré */
            <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Vous êtes à jour !</h3>
              <p className="text-slate-500 max-w-md">Toutes les demandes de mise en relation ont été traitées. Les nouvelles offres apparaîtront automatiquement ici.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {offresEnAttente.map(o => {
                const isActing = acting === o.id;
                const recemmentAjoute = isRecent(o.created_at);

                return (
                  <div key={o.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    {/* En-tête de l'offre */}
                    <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${o.mission_id ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                          {o.mission_id ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${o.mission_id ? 'text-blue-600' : 'text-purple-600'}`}>
                              {o.mission_id ? 'Suite à candidature' : 'Mise en relation directe'}
                            </span>
                            {recemmentAjoute && (
                              <span className="bg-orange-100 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Nouveau</span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 leading-tight">
                            {o.missions?.titre ? `Mission : ${o.missions.titre}` : 'Recherche de profil'}
                          </h3>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date de réception</p>
                        <p className="font-bold text-slate-700">{new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>

                    {/* Contenu : Acteurs */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                      {/* Séparateur visuel sur Desktop */}
                      <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-slate-100 -translate-x-1/2"></div>
                      
                      {/* ENTREPRISE */}
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          Demandeur
                        </h4>
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100 shrink-0">
                            {getInitials(o.entreprise.nom)}
                          </div>
                          <div className="space-y-1.5 flex-1 overflow-hidden">
                            <p className="font-bold text-slate-900 truncate">{o.entreprise.nom}</p>
                            <a href={`mailto:${o.entreprise.email}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition truncate">
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              <span className="truncate">{o.entreprise.email}</span>
                            </a>
                            {o.entreprise.telephone && (
                              <p className="flex items-center gap-2 text-sm text-slate-500">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                {o.entreprise.telephone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SECRÉTAIRE */}
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          Profil ciblé
                        </h4>
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100 shrink-0">
                            {getInitials(o.secretaire.nom)}
                          </div>
                          <div className="space-y-1.5 flex-1 overflow-hidden">
                            <p className="font-bold text-slate-900 truncate">{o.secretaire.nom}</p>
                            <a href={`mailto:${o.secretaire.email}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition truncate">
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              <span className="truncate">{o.secretaire.email}</span>
                            </a>
                            {o.secretaire.telephone && (
                              <p className="flex items-center gap-2 text-sm text-slate-500">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                {o.secretaire.telephone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Message (si existant) */}
                    {o.message && (
                      <div className="px-6 pb-6">
                        <div className="bg-slate-50 rounded-2xl p-4 relative">
                          <svg className="w-6 h-6 text-slate-200 absolute -top-3 left-4 bg-white px-1" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                          <p className="text-sm text-slate-600 leading-relaxed pt-2">
                            {o.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-4 bg-slate-900 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => setModalConfirm({ id: o.id, statut: 'concluee' })}
                        disabled={isActing}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActing ? (
                          <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Valider la mise en relation
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setModalConfirm({ id: o.id, statut: 'refusee' })}
                        disabled={isActing}
                        className="flex items-center justify-center gap-2 bg-slate-800 text-slate-300 font-bold px-6 py-3.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historique des mises en relation */}
        {historique.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6 flex items-center gap-3">
              Historique récent
            </h2>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest rounded-tl-2xl">Date</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Mission</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Entreprise</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Secrétaire</th>
                      <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-right rounded-tr-2xl">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historique.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-500 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 max-w-xs truncate" title={h.mission_titre}>{h.mission_titre}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{h.entreprise_nom}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{h.secretaire_nom}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Conclue
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation inchangé mais prêt pour le design */}
      <ConfirmModal
        open={modalConfirm !== null}
        title={modalConfirm?.statut === 'concluee' ? 'Valider la mise en relation ?' : 'Refuser cette demande ?'}
        message={modalConfirm?.statut === 'concluee'
          ? 'Cette action validera la mise en relation entre l\'entreprise et la secrétaire. Leurs coordonnées complètes seront révélées mutuellement.'
          : 'Êtes-vous sûr de vouloir refuser cette offre ? L\'entreprise en sera notifiée. Cette action est irréversible.'}
        confirmLabel={modalConfirm?.statut === 'concluee' ? 'Oui, valider' : 'Refuser'}
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