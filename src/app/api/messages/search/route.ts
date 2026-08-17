import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const searchSchema = z.object({
  userId: z.string().uuid(),
  otherId: z.string().uuid(),
  q: z.string().min(1).max(200),
});

function escapeLike(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

export async function GET(request: Request) {
  const rateLimitResult = await checkRateLimit(`msg-search:${getClientIp(request)}`, 20, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = searchSchema.safeParse({
    userId: searchParams.get('userId'),
    otherId: searchParams.get('otherId'),
    q: searchParams.get('q'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { userId, otherId, q } = parsed.data;

  if (user.id !== userId && user.id !== otherId) {
    return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
  }

  const safeQ = escapeLike(q);

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, content, created_at')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
    .ilike('content', `%${safeQ}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ results: messages ?? [] });
}
