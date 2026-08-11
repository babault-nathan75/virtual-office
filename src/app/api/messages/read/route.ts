import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const readSchema = z.object({
  messageIds: z.array(z.number().int().positive()).min(1).max(100),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit('msg-read', 30, 60000);
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

  const parsed = readSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { messageIds } = parsed.data;

  const { data: messages, error: fetchError } = await supabaseAdmin
    .from('messages')
    .select('id, receiver_id')
    .in('id', messageIds)
    .eq('read', false);

  if (fetchError) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Aucun message trouvé' }, { status: 404 });
  }

  const ownedMessages = messages.filter(m => m.receiver_id === user.id);
  if (ownedMessages.length === 0) {
    return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
  }

  const ownedIds = ownedMessages.map(m => m.id);

  const { error } = await supabaseAdmin
    .from('messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .in('id', ownedIds)
    .eq('read', false);

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: ownedIds.length });
}
