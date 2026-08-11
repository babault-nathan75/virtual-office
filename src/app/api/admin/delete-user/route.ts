import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const deleteSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = await checkRateLimit(`admin-delete:${ip}`, 5, 60000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
    }

    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    const { userId } = parsed.data;

    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from('profils')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
    }

    await supabase.from('profils_secretaires').delete().eq('id', userId);
    await supabase.from('kyc_verifications').delete().eq('user_id', userId);
    await supabase.from('two_factor_auth').delete().eq('user_id', userId);
    await supabase.from('profils').delete().eq('id', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('[delete-user] auth deletion error:', error.message);
    }

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      action: 'admin_delete_user',
      details: JSON.stringify({ deleted_user_id: userId }),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[delete-user] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
