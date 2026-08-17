'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

type StatsData = {
  offresParMois: { mois: string; count: number }[];
  repartitionStatuts: { name: string; value: number }[];
  topEntreprises: { nom: string; count: number }[];
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function StatsCharts() {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      // Offres par mois (6 derniers mois)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: offres } = await supabase
        .from('offres')
        .select('created_at, statut, entreprise_id')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!offres) return;

      // Group by month
      const byMois: Record<string, number> = {};
      for (const o of offres) {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMois[key] = (byMois[key] || 0) + 1;
      }
      const offresParMois = Object.entries(byMois).map(([mois, count]) => ({
        mois,
        count,
      }));

      // Répartition par statut
      const statuts: Record<string, number> = {};
      for (const o of offres) {
        statuts[o.statut] = (statuts[o.statut] || 0) + 1;
      }
      const repartitionStatuts = Object.entries(statuts).map(([name, value]) => ({ name, value }));

      // Top entreprises par nombre d'offres
      const entIds = Array.from(new Set(offres.map(o => o.entreprise_id)));
      const { data: profs } = await supabase.from('profils_publics').select('id, nom').in('id', entIds);
      const nomMap = new Map((profs ?? []).map(p => [p.id, p.nom]));

      const byEnt: Record<string, number> = {};
      for (const o of offres) {
        byEnt[o.entreprise_id] = (byEnt[o.entreprise_id] || 0) + 1;
      }
      const topEntreprises = Object.entries(byEnt)
        .map(([id, count]) => ({ nom: nomMap.get(id) ?? 'Inconnu', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setData({ offresParMois, repartitionStatuts, topEntreprises });
    };

    fetchStats();
  }, []);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Bar chart : offres par mois */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Offres par mois</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.offresParMois}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart : répartition statuts */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Répartition des statuts</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.repartitionStatuts}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {data.repartitionStatuts.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top entreprises */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 lg:col-span-2">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Top entreprises par activité</h3>
        <div className="space-y-3">
          {data.topEntreprises.map((e, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 w-5">#{i + 1}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full flex items-center px-3"
                  style={{ width: `${Math.max(10, (e.count / (data.topEntreprises[0]?.count || 1)) * 100)}%` }}
                >
                  <span className="text-[11px] font-bold text-white truncate">{e.nom}</span>
                </div>
              </div>
              <span className="text-xs font-black text-slate-600 w-8 text-right">{e.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
