import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rateLimitResult = await checkRateLimit('ephemeral-cleanup', 3, 300000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const { error } = await getSupabaseAdmin()
    .rpc('delete_expired_ephemeral_messages');

  if (error) {
    console.error('[ephemeral] Error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
