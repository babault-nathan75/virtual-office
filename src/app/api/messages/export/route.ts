import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/sanitize';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const exportSchema = z.object({
  userId: z.string().uuid(),
  otherId: z.string().uuid(),
  format: z.enum(['csv', 'pdf']).optional(),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(`msg-export:${getClientIp(request)}`, 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { userId, otherId, format } = parsed.data;

  if (user.id !== userId && user.id !== otherId) {
    return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at, read_at')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Aucun message trouvé' }, { status: 404 });
  }

  const { data: profiles } = await supabaseAdmin
    .from('profils')
    .select('id, nom')
    .in('id', [userId, otherId]);

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.nom]));
  const senderName = profileMap.get(userId) || 'Vous';
  const otherName = profileMap.get(otherId) || 'Autre';

  if (format === 'csv') {
    const rows = [
      ['Date', 'Expéditeur', 'Message', 'Lu le'],
      ...messages.map(m => [
        new Date(m.created_at).toLocaleString('fr-FR'),
        m.sender_id === userId ? senderName : otherName,
        `"${m.content.replace(/"/g, '""')}"`,
        m.read_at ? new Date(m.read_at).toLocaleString('fr-FR') : 'Non lu',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="discussion-${otherName.replace(/[^a-zA-Z0-9]/g, '')}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Discussion avec ${escapeHtml(otherName)}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; color: #1e293b; }
  h1 { font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  .msg { margin: 12px 0; padding: 12px 16px; border-radius: 12px; max-width: 80%; }
  .mine { background: #2563eb; color: white; margin-left: auto; }
  .theirs { background: #f1f5f9; margin-right: auto; }
  .meta { font-size: 11px; opacity: 0.7; margin-top: 4px; }
  .header { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 24px; }
</style></head><body>
<h1>Discussion avec ${escapeHtml(otherName)}</h1>
<p class="header">Exporté le ${new Date().toLocaleString('fr-FR')} — ${messages.length} message(s)</p>
${messages.map(m => `
<div class="msg ${m.sender_id === userId ? 'mine' : 'theirs'}">
  <div>${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
  <div class="meta">${escapeHtml(m.sender_id === userId ? senderName : otherName)} — ${new Date(m.created_at).toLocaleString('fr-FR')}</div>
</div>`).join('')}
</body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
