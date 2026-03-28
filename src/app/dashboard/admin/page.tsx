'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ProfilContact = {
  nom: string;
  email: string;
  telephone: string | null;
};

type MatchAdmin = {
  id: number;
  created_at: string;
  missions: {
    titre: string;
    profils: ProfilContact | ProfilContact[] | null;
  } | null;
  profils: ProfilContact | ProfilContact[] | null;
};

export default function DashboardAdmin() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [stats, setStats] = useState({ pending: 0 });

  useEffect(() => {
    const fetchMatches = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }
      
      const { data: userData } = await supabase.from('profils').select('role').eq('id', session.user.id).single();
      if (!userData || userData.role !== 'admin') {
        setErreur("Accès réservé à l'administrateur.");
        setLoading(false);
        return;
      }

      const { data: candidaturesData, error } = await supabase
        .from('candidatures')
        .select(`
          id, created_at,
          missions ( titre, profils (nom, email, telephone) ),
          profils (nom, email, telephone)
        `)
        .eq('statut', 'acceptee')
        .order('created_at', { ascending: false });

      if (candidaturesData) {
        setMatches(candidaturesData as any);
        setStats({ pending: candidaturesData.length });
      }
      setLoading(false);
    };
    
    fetchMatches();
  }, [router]);

  const gererMatch = async (candidatureId: number, nouveauStatut: string) => {
    const { error } = await supabase.from('candidatures').update({ statut: nouveauStatut }).eq('id', candidatureId);
    if (error) return alert(error.message);
    setMatches(matches.filter(m => m.id !== candidatureId));
    setStats(prev => ({ pending: prev.pending - 1 }));
  };

  if (erreur) return <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold">{erreur}</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER ADMIN */}
        <header className="bg-slate-900 rounded-3xl p-8 mb-10 shadow-2xl shadow-slate-200 text-white flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-yellow-400 p-4 rounded-2xl text-slate-900 text-3xl">🛡️</div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Console de Contrôle</h1>
              <p className="text-slate-400 font-medium">Supervision des mises en relation SecrétariatPro</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => window.location.reload()} className="bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded-xl font-bold transition">Actualiser</button>
             <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-5 py-3 rounded-xl font-bold transition">Déconnexion</button>
          </div>
        </header>

        {/* STATS RAPIDES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Mises en relation en attente</p>
            <p className="text-4xl font-black text-slate-900">{stats.pending}</p>
          </div>
          <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100 text-white">
            <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-1">Statut Plateforme</p>
            <p className="text-xl font-black italic">Opérationnel à 100%</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
             <Link href="/" className="text-blue-600 font-bold hover:underline">Voir le site public &rarr;</Link>
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
          🤝 Dossiers à finaliser
          {stats.pending > 0 && <span className="bg-yellow-400 text-slate-900 text-xs px-2 py-1 rounded-lg">{stats.pending}</span>}
        </h2>

        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-400 font-bold">Synchronisation des données sécurisées...</div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-slate-200">
            <p className="text-4xl mb-4">✨</p>
            <p className="text-slate-500 font-bold text-xl">Tout est à jour ! Aucune mise en relation en attente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {matches.map((match) => {
              const secretaire = Array.isArray(match.profils) ? match.profils[0] : match.profils;
              const entreprise = Array.isArray(match.missions?.profils) ? match.missions?.profils[0] : match.missions?.profils;

              return (
                <div key={match.id} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition hover:border-blue-300">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Contrat Potentiel</span>
                      <h3 className="text-xl font-black text-slate-900">{match.missions?.titre}</h3>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Match détecté le</p>
                      <p className="font-bold text-slate-700">{new Date(match.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* ENTREPRISE */}
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner">🏢</div>
                        <h4 className="text-lg font-black text-slate-800">L'Employeur</h4>
                      </div>
                      <div className="space-y-4 bg-slate-50 p-6 rounded-2xl">
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Nom :</span> <span className="font-bold">{entreprise?.nom}</span></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Email :</span> <a href={`mailto:${entreprise?.email}`} className="font-bold text-blue-600">{entreprise?.email}</a></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Tél :</span> <span className="font-bold text-slate-900">{entreprise?.telephone || 'Non fourni'}</span></p>
                      </div>
                    </div>

                    {/* SECRÉTAIRE */}
                    <div>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-green-100 text-green-600 w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner">👩‍💻</div>
                        <h4 className="text-lg font-black text-slate-800">La Secrétaire</h4>
                      </div>
                      <div className="space-y-4 bg-slate-50 p-6 rounded-2xl">
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Nom :</span> <span className="font-bold">{secretaire?.nom}</span></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Email :</span> <a href={`mailto:${secretaire?.email}`} className="font-bold text-green-600">{secretaire?.email}</a></p>
                        <p className="flex justify-between text-sm"><span className="text-slate-400">Tél :</span> <span className="font-bold text-slate-900">{secretaire?.telephone || 'Non fourni'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-center gap-4">
                    <button 
                      onClick={() => gererMatch(match.id, 'traitee')}
                      className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-blue-600 transition shadow-lg shadow-slate-200"
                    >
                      ✅ Mise en relation effectuée
                    </button>
                    <button 
                      onClick={() => gererMatch(match.id, 'archivee')}
                      className="bg-white text-slate-400 font-bold px-8 py-4 rounded-2xl border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition"
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}