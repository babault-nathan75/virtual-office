import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const otherId = searchParams.get('otherId');
  const q = searchParams.get('q');

  if (!userId || !otherId || !q) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  if (user.id !== userId && user.id !== otherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, content, created_at')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
    .ilike('content', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ results: messages ?? [] });
}
