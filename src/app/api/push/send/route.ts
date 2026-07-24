import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { requireAuth } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:contact@secretariatpro.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string, title: string, body: string, url: string;
  try {
    const bodyReq = await request.json();
    userId = bodyReq.userId;
    title = bodyReq.title;
    body = bodyReq.body;
    url = bodyReq.url || '/dashboard/messages';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!userId || !title) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 });
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const payload = JSON.stringify({ title, body, url });
  const results = [];

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      results.push({ endpoint: sub.endpoint, sent: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('410') || errMsg.includes('404')) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
      results.push({ endpoint: sub.endpoint, sent: false, error: errMsg });
    }
  }

  return NextResponse.json({ success: true, results });
}
