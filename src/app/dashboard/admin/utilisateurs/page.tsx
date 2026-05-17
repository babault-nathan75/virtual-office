'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Profil = {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: 'entreprise' | 'secretaire' | 'admin';
  created_at: string;
};

const ROLES: Profil['role'][] = ['entreprise', 'secretaire', 'admin'];

const ROLE_STYLE: Record<Profil['role'], string> = {
  entreprise: 'bg-blue-100 text-blue-700',
  secretaire: 'bg-emerald-100 text-emerald-700',
  admin:      'bg-amber-100 text-amber-800',
};

export default function GestionUtilisateurs() {
  const router = useRouter();
  const [me, setMe] = useState<string>('');
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<Profil[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Profil['role']>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }
      setMe(session.user.id);

      const { data: my } = await supabase.from('profils').select('role').eq('id', session.user.id).single();
      if (my?.role !== 'admin') {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const { data } = await supabase
        .from('profils')
        .select('id, nom, email, telephone, role, created_at')
        .order('created_at', { ascending: false });

      if (data) setUsers(data as Profil[]);
      setLoading(false);
    };
    run();
  }, [router]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter !== 'all') list = list.filter(u => u.role === filter);
    if (q.trim()) {
      const needle = q.toLowerCase().trim();
      list = list.filter(u =>
        (u.nom ?? '').toLowerCase().includes(needle) ||
        (u.email ?? '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [users, filter, q]);

  const changeRole = async (userId: string, newRole: Profil['role']) => {
    if (userId === me && newRole !== 'admin') {
      if (!confirm('Vous êtes sur le point de retirer vos propres droits admin. Vous ne pourrez plus revenir en arrière depuis l\'interface. Continuer ?')) return;
    }
    setUpdating(userId);
    setMessage({ text: '', type: '' });
    const { error } = await supabase.from('profils').update({ role: newRole }).eq('id', userId);
    if (error) {
      setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage({ text: `Rôle mis à jour ✓`, type: 'success' });
    }
    setUpdating(null);
  };

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold font-sans">
        Accès réservé à l&apos;administrateur.
      </div>
    );
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium font-sans">Chargement...</div>;
  }

  const counts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">

        <Link
          href="/dashboard/admin"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Console d&apos;administration
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Gestion des utilisateurs</h1>
          <p className="text-slate-500 font-medium mt-1">
            {users.length} utilisateur{users.length > 1 ? 's' : ''} au total
            {' · '}
            <span className="text-blue-700 font-bold">{counts.entreprise ?? 0} entreprise{(counts.entreprise ?? 0) > 1 ? 's' : ''}</span>
            {' · '}
            <span className="text-emerald-700 font-bold">{counts.secretaire ?? 0} secrétaire{(counts.secretaire ?? 0) > 1 ? 's' : ''}</span>
            {' · '}
            <span className="text-amber-700 font-bold">{counts.admin ?? 0} admin{(counts.admin ?? 0) > 1 ? 's' : ''}</span>
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

        {/* Filtres */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <div className="flex gap-2 flex-wrap">
            {(['all', ...ROLES] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className={`px-3 py-2 rounded-full text-xs font-bold tracking-tight border-2 transition ${
                  filter === opt
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {opt === 'all' ? 'Tous' : opt === 'entreprise' ? 'Entreprises' : opt === 'secretaire' ? 'Secrétaires' : 'Admins'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-500 font-medium">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Utilisateur</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 hidden md:table-cell">Téléphone</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 hidden lg:table-cell">Inscrit le</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Rôle</th>
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 text-right">Changer</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const isMe = u.id === me;
                    const isUpdating = updating === u.id;
                    return (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {u.nom || '—'}
                            {isMe && <span className="ml-2 text-[10px] font-black text-blue-600">(vous)</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[240px]">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{u.telephone || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                          {new Date(u.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${ROLE_STYLE[u.role]}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={u.role}
                            disabled={isUpdating}
                            onChange={e => changeRole(u.id, e.target.value as Profil['role'])}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400 font-medium italic">
          ⚠️ Promouvoir un utilisateur en <b>admin</b> lui donne accès à toutes les coordonnées des entreprises et secrétaires inscrites. À utiliser avec parcimonie.
        </p>
      </div>
    </main>
  );
}
