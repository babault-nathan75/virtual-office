import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


const readSchema = z.object({
  // `messages.id` est un UUID : le schéma n'acceptait que des entiers, donc
  // tout appel légitime était rejeté en 400.
  messageIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(`msg-read:${getClientIp(request)}`, 30, 60000);
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

  const { data: messages, error: fetchError } = await getSupabaseAdmin()
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

  const { error } = await getSupabaseAdmin()
    .from('messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .in('id', ownedIds)
    .eq('read', false);

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: ownedIds.length });
}
