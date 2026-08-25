import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:contact@secretariatpro.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const pushSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  url: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(`push-send:${getClientIp(request)}`, 10, 60000);
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

  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { userId, title, body: pushBody, url } = parsed.data;

  // L'utilisateur authentifié était récupéré puis ignoré : n'importe quel
  // compte pouvait donc pousser une notification arbitraire (titre, texte et
  // URL libres) vers n'importe quel autre compte. L'envoi est désormais limité
  // à soi-même, aux administrateurs, et aux correspondants déjà en contact.
  if (userId !== user.id) {
    const { data: callerProfile } = await getSupabaseAdmin()
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      const { count } = await getSupabaseAdmin()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),` +
          `and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
        );

      if (!count) {
        return NextResponse.json({ error: 'Destinataire non autorisé' }, { status: 403 });
      }
    }
  }

  // L'URL est contrainte à un chemin interne : une URL absolue permettrait
  // d'ouvrir un site tiers depuis une notification signée par l'application.
  const safeUrl = url && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard/messages';

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push non configuré' }, { status: 503 });
  }

  const { data: subs } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const payload = JSON.stringify({ title, body: pushBody, url: safeUrl });
  const results = [];

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      results.push({ sent: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('410') || errMsg.includes('404')) {
        await getSupabaseAdmin()
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
      results.push({ sent: false });
    }
  }

  return NextResponse.json({ success: true, results });
}
