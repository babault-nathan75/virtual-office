'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toast';
import NotificationBell from '@/components/NotificationBell';
import Link from '@/components/Link';
import type { AdminDashboardData } from '@/lib/data/admin-client';
import { decideKyc } from '@/lib/actions/adminKyc';
import RefreshOnReturn from '@/components/RefreshOnReturn';

type Props = {
  userId: string;
  userName: string;
  stats: AdminDashboardData;
};

export default function AdminDashboardClient({ userId, userName, stats }: Props) {
  const router = useRouter();
  // `showUsers`/`showKyc` et `handleRoleChange` n'étaient rattachés à aucun
  // rendu : le changement de rôle se fait depuis /dashboard/admin/utilisateurs.
  /*
   * `router.refresh()` plutôt que `window.location.reload()` : le rechargement
   * complet ne servait à rien puisque le cache serveur, jamais invalidé,
   * renvoyait la même liste. L'action serveur invalide maintenant l'étiquette
   * `admin-dashboard`, et `refresh()` va rechercher les données à jour sans
   * repartir d'une page blanche.
   */
  const decide = useCallback(
    async (targetUserId: string, decision: 'approved' | 'rejected') => {
      const result = await decideKyc({ userId: targetUserId, decision });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === 'approved' ? 'Dossier approuvé' : 'Dossier refusé');
      router.refresh();
    },
    [router]
  );

  const handleKycApprove = useCallback(
    (targetUserId: string) => decide(targetUserId, 'approved'),
    [decide]
  );

  const handleKycReject = useCallback(
    (targetUserId: string) => decide(targetUserId, 'rejected'),
    [decide]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">

    {/* Remet l'écran à jour au retour sur l'onglet, sans rechargement. */}

    <RefreshOnReturn />
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">Administration — {userName}</h1>
              <p className="text-slate-500">Vue d&apos;ensemble de la plateforme</p>
            </div>
            <NotificationBell userId={userId} role="admin" />
          </div>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm font-medium text-slate-500 uppercase">Messages totaux</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stats.totalMessages.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-slate-500 uppercase">7 derniers jours</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{stats.messagesLast7d}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
            <p className="text-sm font-medium text-slate-500 uppercase">Temps réponse moy.</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{stats.avgResponseTime}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
            <p className="text-sm font-medium text-slate-500 uppercase">Offres conclues</p>
            <p className="text-3xl font-black text-amber-600 mt-1">{stats.stats.totalOffresConcluees}</p>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500">
            <h3 className="font-bold text-lg text-slate-900 mb-3">📊 Activité 14 jours</h3>
            <div className="h-32 flex items-end justify-between gap-1">
              {stats.activity.map((d, i) => (
                <div key={i} className="flex-1 bg-blue-500 rounded-t" style={{ height: `${Math.max(4, (d.count / Math.max(...stats.activity.map(a => a.count), 1)) * 100)}%` }} title={`${d.date}: ${d.count}`} />
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-pink-500">
            <h3 className="font-bold text-lg text-slate-900 mb-3">👥 Top expéditeurs</h3>
            <div className="space-y-2">
              {stats.topSenders.length > 0 ? stats.topSenders.map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">{s.nom}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{s.count} msg</span>
                </div>
              )) : <p className="text-sm text-slate-400">Aucune donnée</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-cyan-500">
            <h3 className="font-bold text-lg text-slate-900 mb-3">🏢 Entreprises & Secrétaires</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-sm text-slate-500">Entreprises</p>
                <p className="text-2xl font-black text-slate-900">{stats.stats.totalEntreprises}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-sm text-slate-500">Secrétaires</p>
                <p className="text-2xl font-black text-slate-900">{stats.stats.totalSecretaires}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KYC en attente */}
        {stats.kycPending.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-900">🪪 KYC en attente ({stats.kycPending.length})</h3>
              {/* `setShowKyc(true)` n'était lu nulle part : le bouton était
                  inerte. Il mène désormais à la page de gestion des KYC. */}
              <Link href="/dashboard/admin/kyc" className="text-sm font-bold text-blue-600 hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-2">
              {stats.kycPending.slice(0, 3).map(k => (
                <div key={k.user_id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                  <span className="font-medium text-slate-800">{k.nom}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleKycApprove(k.user_id)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700">Approuver</button>
                    <button onClick={() => handleKycReject(k.user_id)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700">Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nouvelles missions */}
        {stats.newMissions.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-green-500">
            <h3 className="font-bold text-lg text-slate-900 mb-4">📋 Nouvelles missions</h3>
            <div className="space-y-2">
              {stats.newMissions.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div>
                    <p className="font-bold text-slate-800">{m.titre}</p>
                    <p className="text-sm text-slate-500">Par {m.entreprise_nom || 'Entreprise'} • {new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Ouverte</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liens admin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/admin/messages" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition text-center">
            <p className="text-3xl mb-2">💬</p>
            <p className="font-bold text-lg text-slate-900">Gérer les discussions</p>
            <p className="text-sm text-slate-500 mt-1">Voir tous les échanges</p>
          </Link>
          <Link href="/dashboard/admin/kyc" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition text-center">
            <p className="text-3xl mb-2">🪪</p>
            <p className="font-bold text-lg text-slate-900">Vérifications KYC</p>
            <p className="text-sm text-slate-500 mt-1">Valider les identités</p>
          </Link>
          <Link href="/dashboard/admin/utilisateurs" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition text-center">
            <p className="text-3xl mb-2">👥</p>
            <p className="font-bold text-lg text-slate-900">Gérer utilisateurs</p>
            <p className="text-sm text-slate-500 mt-1">Rôles, stats, export</p>
          </Link>
        </div>
      </div>
    </div>
  );
}