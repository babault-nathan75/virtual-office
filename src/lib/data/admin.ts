import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';

const revalidate = revalidateTag as (tag: string) => void;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getAdminDashboardData(userId: string) {
  return getAdminDashboardDataCached(userId);
}

const getAdminDashboardDataCached = unstable_cache(
  async (userId: string) => {
    const supabase = getSupabaseAdmin();

    const [
      { data: profil },
      { count: totalMessages },
      { count: messagesLast7d },
      { data: recentMessages },
      { data: recentOffres },
      { data: kycPending },
      { data: newMissions }
    ] = await Promise.all([
      supabase.from('profils').select('nom, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('messages').select('sender_id, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('offres').select('id, statut, entreprise_id, secretaire_id, created_at').eq('statut', 'concluee').order('created_at', { ascending: false }).limit(50),
      supabase.from('kyc_verifications').select('user_id, created_at').eq('statut', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('missions').select('id, titre, created_at, entreprise_id').eq('statut', 'ouverte').order('created_at', { ascending: false }).limit(3)
    ]);

    let avgResponseTime = '—';
    if (recentMessages && recentMessages.length > 0) {
      const sent = recentMessages.filter(m => m.sender_id === userId);
      const received = recentMessages.filter(m => m.sender_id !== userId);
      if (received.length > 0 && sent.length > 0) {
        let totalDiff = 0;
        let pairs = 0;
        for (const r of received) {
          const reply = sent.find(s => new Date(s.created_at) > new Date(r.created_at));
          if (reply) {
            totalDiff += new Date(reply.created_at).getTime() - new Date(r.created_at).getTime();
            pairs++;
          }
        }
        if (pairs > 0) {
          const avgMs = totalDiff / pairs;
          const avgHours = avgMs / (1000 * 60 * 60);
          avgResponseTime = avgHours < 1 ? `${Math.round(avgHours * 60)} min` : `${avgHours.toFixed(1)} h`;
        }
      }
    }

    const senderCounts = new Map<string, number>();
    recentMessages?.forEach(m => {
      if (m.sender_id !== userId) {
        senderCounts.set(m.sender_id, (senderCounts.get(m.sender_id) || 0) + 1);
      }
    });
    const topSenders = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topProfiles: { id: string; nom: string }[] = [];
    if (topSenders.length > 0) {
      const { data: profs } = await supabase.from('profils').select('id, nom').in('id', topSenders.map(s => s[0]));
      topProfiles = profs ?? [];
    }
    const topSendersWithNames = topSenders.map(([id, count]) => ({
      nom: topProfiles.find(p => p.id === id)?.nom || 'Inconnu',
      count
    }));

    const activity: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());
      activity.push({ date: date.toISOString().split('T')[0], count: count || 0 });
    }

    let kycWithNames: { user_id: string; created_at: string; nom: string }[] = [];
    if (kycPending && kycPending.length > 0) {
      const { data: users } = await supabase.from('profils').select('id, nom').in('id', kycPending.map(k => k.user_id));
      const userMap = new Map((users ?? []).map(u => [u.id, u.nom]));
      kycWithNames = kycPending.map(k => ({ ...k, nom: userMap.get(k.user_id) || 'Utilisateur' }));
    }

    let missionsWithNames: any[] = [];
    if (newMissions && newMissions.length > 0) {
      const { data: ents } = await supabase.from('profils').select('id, nom').in('id', newMissions.map(m => m.entreprise_id));
      const entMap = new Map((ents ?? []).map(e => [e.id, e.nom]));
      missionsWithNames = newMissions.map(m => ({ ...m, entreprise_nom: entMap.get(m.entreprise_id) }));
    }

    return {
      profil,
      totalMessages: totalMessages ?? 0,
      messagesLast7d: messagesLast7d ?? 0,
      avgResponseTime,
      topSenders: topSendersWithNames,
      activity,
      kycPending: kycWithNames,
      newMissions: missionsWithNames,
      stats: {
        totalOffresConcluees: recentOffres?.length ?? 0,
        totalEntreprises: new Set(recentOffres?.map(o => o.entreprise_id) ?? []).size,
        totalSecretaires: new Set(recentOffres?.map(o => o.secretaire_id) ?? []).size
      }
    };
  },
  ['admin-dashboard'],
  { revalidate: 60, tags: ['admin-dashboard'] }
);

export function revalidateAdminDashboard() {
  revalidate('admin-dashboard');
}