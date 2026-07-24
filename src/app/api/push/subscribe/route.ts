import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  let userId: string, endpoint: string, p256dh: string, authKey: string;
  try {
    const body = await request.json();
    userId = body.userId;
    endpoint = body.endpoint;
    p256dh = body.p256dh;
    authKey = body.auth;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!userId || !endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  if (user && user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
    }, { onConflict: 'user_id,endpoint' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
