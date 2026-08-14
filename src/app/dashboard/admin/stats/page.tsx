'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { Breadcrumbs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { exportToCSV, exportToPDF } from '@/lib/export';
import { SkeletonStats } from '@/components/Skeleton';

type Stats = {
  totalMessages: number;
  messagesLast7d: number;
  avgResponseMinutes: number;
  topSenders: { nom: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
};

export default function AdminStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle('Statistiques');

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: profil } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (!profil || profil.role !== 'admin') { router.push('/dashboard'); return; }

      // Total messages
      const { count: totalMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true });

      // Messages last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: messagesLast7d } = await supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo);

      // Average response time (simplified)
      const { data: allMsgs } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, created_at')
        .order('created_at', { ascending: true })
        .limit(500);

      let totalResponseMs = 0;
      let responseCount = 0;
      if (allMsgs) {
        for (let i = 1; i < allMsgs.length; i++) {
          if (allMsgs[i].sender_id !== allMsgs[i - 1].sender_id) {
            const diff = new Date(allMsgs[i].created_at).getTime() - new Date(allMsgs[i - 1].created_at).getTime();
            if (diff < 24 * 60 * 60 * 1000) {
              totalResponseMs += diff;
              responseCount++;
            }
          }
        }
      }
      const avgResponseMinutes = responseCount > 0 ? Math.round(totalResponseMs / responseCount / 60000) : 0;

      // Top senders
      const { data: senderData } = await supabase.from('messages').select('sender_id');
      const senderCounts = new Map<string, number>();
      (senderData ?? []).forEach(m => senderCounts.set(m.sender_id, (senderCounts.get(m.sender_id) || 0) + 1));
      const topIds = [...senderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
      const { data: topProfiles } = await supabase.from('profils').select('id, nom').in('id', topIds);
      const topMap = new Map((topProfiles ?? []).map(p => [p.id, p.nom]));
      const topSenders = topIds.map(id => ({ nom: topMap.get(id) || 'Inconnu', count: senderCounts.get(id) || 0 }));

      // Daily activity (last 14 days)
      const dailyMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dailyMap.set(d.toISOString().slice(0, 10), 0);
      }
      (allMsgs ?? []).forEach(m => {
        const day = m.created_at.slice(0, 10);
        if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      });
      const dailyActivity = [...dailyMap.entries()].map(([date, count]) => ({ date, count }));

      setStats({ totalMessages: totalMessages ?? 0, messagesLast7d: messagesLast7d ?? 0, avgResponseMinutes, topSenders, dailyActivity });
      setLoading(false);
    };
    run();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="h-8 bg-slate-200 rounded animate-pulse w-48" />
        <SkeletonStats />
        <div className="h-64 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-32 mb-4" />
          <div className="h-40 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
  if (!stats) return null;

  const maxDaily = Math.max(...stats.dailyActivity.map(d => d.count), 1);

  const handleExportCSV = () => {
    const data = stats.dailyActivity.map(d => ({
      Date: d.date,
      Messages: d.count,
    }));
    exportToCSV(data, 'stats_messages');
  };

  const handleExportPDF = () => {
    const data = stats.dailyActivity.map(d => ({
      Date: d.date,
      Messages: d.count,
    }));
    exportToPDF('Statistiques des messages', data, 'stats_messages');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Administration', href: '/dashboard/admin' },
          { label: 'Statistiques' },
        ]} />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Statistiques des Discussions</h1>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
            <button onClick={handleExportPDF} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total messages</p>
            <p className="text-4xl font-black text-slate-900">{stats.totalMessages.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Messages (7 jours)</p>
            <p className="text-4xl font-black text-blue-600">{stats.messagesLast7d.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Temps de réponse moyen</p>
            <p className="text-4xl font-black text-emerald-600">{stats.avgResponseMinutes} <span className="text-lg">min</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top senders */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="font-black text-slate-900 text-sm mb-4">Top expéditeurs</h2>
            <div className="space-y-3">
              {stats.topSenders.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold text-slate-800">{s.nom}</span>
                      <span className="text-xs text-slate-400">{s.count} msgs</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s.count / (stats.topSenders[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily activity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="font-black text-slate-900 text-sm mb-4">Activité (14 jours)</h2>
            <div className="flex items-end gap-1 h-40">
              {stats.dailyActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }} />
                  <span className="text-[8px] text-slate-400 -rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
