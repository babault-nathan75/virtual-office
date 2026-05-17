'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
  profils: { nom: string } | null;
};

type Candidature = {
  mission_id: number;
};

export default function RechercherPoste() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mesCandidatures, setMesCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [postulating, setPostulating] = useState<number | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }
      setUserId(session.user.id);

      // Toutes les missions ouvertes (RLS filtre déjà côté DB)
      const { data: ms } = await supabase
        .from('missions')
        .select('id, titre, description, date_debut, date_fin, created_at, profils(nom)')
        .eq('statut', 'ouverte')
        .order('created_at', { ascending: false });

      // Mes candidatures pour savoir où j'ai déjà postulé
      const { data: cs } = await supabase
        .from('candidatures')
        .select('mission_id')
        .eq('secretaire_id', session.user.id);

      if (ms) setMissions(ms as unknown as Mission[]);
      if (cs) setMesCandidatures(cs as Candidature[]);
      setLoading(false);
    };
    fetchAll();
  }, [router]);

  const filtered = useMemo(() => {
    if (!q.trim()) return missions;
    const needle = q.toLowerCase().trim();
    return missions.filter(m =>
      [m.titre, m.description, m.profils?.nom]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [missions, q]);

  const postuler = async (missionId: number) => {
    if (!userId) return;
    setPostulating(missionId);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('candidatures').insert([
      { mission_id: missionId, secretaire_id: userId, statut: 'en_attente' },
    ]);

    if (error) {
      // 23505 = unique constraint (déjà postulé)
      if (error.code === '23505') {
        setMessage({ text: 'Vous avez déjà postulé à cette mission.', type: 'error' });
      } else {
        setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
      }
    } else {
      setMesCandidatures(prev => [...prev, { mission_id: missionId }]);
      setMessage({ text: 'Candidature envoyée ✓', type: 'success' });
    }
    setPostulating(null);
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Chargement des missions...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 font-sans antialiased">
      <div className="max-w-5xl mx-auto">

        <Link
          href="/dashboard/secretaire"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Mon espace de travail
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Rechercher un poste</h1>
          <p className="text-slate-500 font-medium mt-1">
            {missions.length} mission{missions.length > 1 ? 's' : ''} ouverte{missions.length > 1 ? 's' : ''} publiée{missions.length > 1 ? 's' : ''} par les entreprises.
          </p>
        </header>

        {message.text && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Recherche
          </label>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Titre, mot-clé, nom d'entreprise…"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-300"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-500 font-medium">
              {q ? 'Aucune mission ne correspond à votre recherche.' : 'Aucune mission disponible pour le moment.'}
            </p>
            <p className="text-xs text-slate-400 mt-2">Revenez plus tard, de nouvelles missions sont publiées régulièrement.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(m => {
              const deja = mesCandidatures.some(c => c.mission_id === m.id);
              const isPostulating = postulating === m.id;
              return (
                <article key={m.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-black tracking-tight text-slate-900">{m.titre}</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Publiée par <b className="text-slate-700">{m.profils?.nom ?? '—'}</b>
                        {' · '}
                        {new Date(m.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3 font-medium">
                    {m.description}
                  </p>

                  {(m.date_debut || m.date_fin) && (
                    <div className="flex flex-wrap gap-3 mb-4 text-xs">
                      {m.date_debut && (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          Début : {new Date(m.date_debut).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {m.date_fin && (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          Fin : {new Date(m.date_fin).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => postuler(m.id)}
                    disabled={deja || isPostulating}
                    className={`w-full py-3 rounded-full font-extrabold text-sm tracking-tight transition ${
                      deja
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPostulating
                          ? 'bg-slate-200 text-slate-500 cursor-wait'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                    }`}
                  >
                    {deja ? '✓ Candidature envoyée' : isPostulating ? 'Envoi en cours...' : 'Postuler à cette mission'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
