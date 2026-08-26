'use client';

import { useEffect, useMemo, useState } from 'react';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ui';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { formatDate } from '@/lib/i18n';
import { revalidateScope } from '@/lib/actions/cache';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

type Profil = {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: 'entreprise' | 'secretaire' | 'admin';
  created_at: string;
  specialite?: string | null;
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
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [total, setTotal] = useState(0);
  const [confirmState, setConfirmState] = useState<
    | { kind: 'demote'; userId: string; newRole: Profil['role'] }
    | { kind: 'delete'; userId: string; nom: string }
    | null
  >(null);

  /*
   * Rechargement automatique au retour sur l'onglet et après une reconnexion.
   *
   * L'écran ne se chargeait qu'au montage : un onglet laissé ouvert affichait
   * indéfiniment un état périmé, et le seul recours était de recharger la page.
   * Incrémenter cette clé rejoue l'effet de chargement existant — y compris sa
   * vérification de session, ce qui est souhaitable après une longue absence.
   */
  const [refreshKey, setRefreshKey] = useState(0);
  useAutoRefresh(() => setRefreshKey(key => key + 1));

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }
      setMe(session.user.id);

      const { data: my } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (my?.role !== 'admin') {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count } = await supabase
        .from('profils')
        .select('id, nom, email, telephone, role, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      // Récupérer les spécialités séparément
      const userIds = (data ?? []).map(u => u.id);
      const { data: secData } = await supabase
        .from('profils_secretaires')
        .select('id, specialite')
        .in('id', userIds.length > 0 ? userIds : ['__none__']);

      const specMap = new Map((secData ?? []).map(s => [s.id, s.specialite]));

      if (data) {
        const enriched = data.map(u => ({
          ...u,
          specialite: specMap.get(u.id) ?? null,
        }));
        setUsers(enriched as Profil[]);
      }
      if (count !== null) setTotal(count);
      setLoading(false);
    };
    run();
  }, [router, page, refreshKey]);

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

  // Les confirmations natives (`window.confirm`) bloquent le rendu, ne sont pas
  // stylables et sont ignorables dans certains navigateurs mobiles. Le dialogue
  // du design system est utilisé à la place, pour deux actions irréversibles.
  const changeRole = async (userId: string, newRole: Profil['role']) => {
    setUpdating(userId);
    setMessage({ text: '', type: '' });
    const { error } = await supabase.from('profils').update({ role: newRole }).eq('id', userId);
    if (error) {
      setMessage({ text: 'Erreur : ' + error.message, type: 'error' });
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage({ text: `Rôle mis à jour ✓`, type: 'success' });
      await revalidateScope('admin-users');
    }
    setUpdating(null);
  };

  const deleteUser = async (userId: string) => {
    setUpdating(userId);
    setMessage({ text: '', type: '' });

    try {
      // Note : Vous devrez créer cette route d'API utilisant supabase-admin (Service Role Key)
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setMessage({ text: 'Utilisateur supprimé avec succès.', type: 'success' });
      } else {
        setMessage({ text: 'Erreur lors de la suppression.', type: 'error' });
      }
    } catch (error) {
      console.error('[admin/utilisateurs] Suppression échouée :', error);
      setMessage({ text: 'Erreur réseau.', type: 'error' });
    }
    setUpdating(null);
  };

  // Helper pour afficher la spécialité ou le rôle par défaut
  const getSpecialite = (u: Profil) => {
    if (u.role === 'secretaire' && u.specialite) {
      return u.specialite;
    }
    return u.role;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold font-sans">
        Accès réservé à l&apos;administrateur.
      </div>
    );
  }

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
                    <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const isMe = u.id === me;
                    const isUpdating = updating === u.id;
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {/* Nom cliquable vers le profil */}
                            <Link href={`/dashboard/admin/utilisateurs/${u.id}`} className="hover:text-blue-600 hover:underline transition-colors">
                              {u.nom || '—'}
                            </Link>
                            {isMe && <span className="ml-2 text-[10px] font-black text-blue-600">(vous)</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[240px]">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{u.telephone || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {/* Affichage de la spécialité au lieu du rôle */}
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${ROLE_STYLE[u.role]}`}>
                            {getSpecialite(u)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                          {/* Select pour modifier le rôle */}
                          <select
                            value={u.role}
                            disabled={isUpdating || isAdmin} // Impossible de modifier le rôle si c'est un admin
                            onChange={e => {
                              const newRole = e.target.value as Profil['role'];
                              // Se retirer soi-même les droits admin est
                              // irréversible depuis l'interface : confirmation.
                              if (u.id === me && newRole !== 'admin') {
                                setConfirmState({ kind: 'demote', userId: u.id, newRole });
                                return;
                              }
                              void changeRole(u.id, newRole);
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          
                          {/* Bouton de suppression, masqué ou désactivé pour les admins */}
                          <button
                            type="button"
                            onClick={() => setConfirmState({ kind: 'delete', userId: u.id, nom: u.nom })}
                            disabled={isUpdating || isAdmin}
                            title={isAdmin ? "Impossible de supprimer un administrateur" : "Supprimer l'utilisateur"}
                            className={`p-1.5 rounded-lg transition-colors ${isAdmin ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50 hover:text-red-700'}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>
            <span className="text-sm font-bold text-slate-600 px-3">
              Page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        onClose={() => setConfirmState(null)}
        loading={updating !== null}
        variant="danger"
        title={confirmState?.kind === 'delete' ? 'Supprimer cet utilisateur ?' : 'Retirer vos droits administrateur ?'}
        confirmLabel={confirmState?.kind === 'delete' ? 'Supprimer définitivement' : 'Retirer mes droits'}
        message={
          confirmState?.kind === 'delete'
            ? `Le compte de ${confirmState.nom || 'cet utilisateur'} et ses données associées seront supprimés. Cette action est irréversible.`
            : "Vous perdrez immédiatement l'accès à la console d'administration et ne pourrez pas revenir en arrière depuis l'interface."
        }
        onConfirm={() => {
          if (!confirmState) return;
          const action =
            confirmState.kind === 'delete'
              ? deleteUser(confirmState.userId)
              : changeRole(confirmState.userId, confirmState.newRole);
          void action.finally(() => setConfirmState(null));
        }}
      />
    </main>
  );
}