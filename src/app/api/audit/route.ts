import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


const auditSchema = z.object({
  action: z.string().min(1).max(100),
  details: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(`audit:${user.id}`, 10, 60000);
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = auditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { action, details } = parsed.data;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  const { error } = await getSupabaseAdmin().from('audit_logs').insert({
    user_id: user.id,
    action,
    details: details || '',
    ip_address: ip,
    user_agent: request.headers.get('user-agent') || '',
  });

  if (error) {
    console.error('[audit] Error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
