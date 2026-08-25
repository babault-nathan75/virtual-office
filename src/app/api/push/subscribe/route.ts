import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


const subscribeSchema = z.object({
  userId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(`push-subscribe:${getClientIp(request)}`, 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId, endpoint, p256dh, auth: authKey } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
    }, { onConflict: 'user_id,endpoint' });

  if (error) {
    console.error('[push/subscribe] Error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
