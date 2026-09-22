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

function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseServer = getSupabaseServer();

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    
    // Use anon client to verify the user's session
    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !caller) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Use admin client to check role (bypasses RLS)
    const { data: callerProfile } = await supabaseAdmin
      .from('profils')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
    }

    // First, clean up all related profile data (must be done before auth user deletion due to FK constraints)
    const cleanup = await Promise.all([
      supabaseAdmin.from('profils_secretaires').delete().eq('id', userId),
      supabaseAdmin.from('kyc_verifications').delete().eq('user_id', userId),
      supabaseAdmin.from('two_factor_auth').delete().eq('user_id', userId),
      supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId),
      supabaseAdmin.from('notifications').delete().eq('user_id', userId),
      supabaseAdmin.from('email_confirmations').delete().eq('user_id', userId),
      supabaseAdmin.from('otp_codes').delete().eq('user_id', userId),
      supabaseAdmin.from('auth_events').delete().eq('user_id', userId),
      supabaseAdmin.from('trusted_devices').delete().eq('user_id', userId),
      supabaseAdmin.from('avis').delete().eq('reviewer_id', userId),
      supabaseAdmin.from('profils').delete().eq('id', userId),
    ]);
    const cleanupError = cleanup.find(result => result.error)?.error;
    if (cleanupError) {
      console.error('[delete-user] profile cleanup error:', cleanupError.message);
      return NextResponse.json({ error: 'Impossible de supprimer les données associées: ' + cleanupError.message }, { status: 500 });
    }

    // Then delete the auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[delete-user] auth deletion error:', deleteAuthError.message);
      return NextResponse.json({ error: 'Impossible de supprimer le compte: ' + deleteAuthError.message }, { status: 500 });
    }

    // Log audit trail (best effort)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: caller.id,
        action: 'admin_delete_user',
        details: JSON.stringify({ deleted_user_id: userId }),
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.warn('[delete-user] audit log warning:', auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[delete-user] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
