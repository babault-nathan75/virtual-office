import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Vérifier que l'appelant est admin
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

    // Supprimer les données liées
    await supabase.from('profils_secretaires').delete().eq('id', userId);
    await supabase.from('kyc_verifications').delete().eq('user_id', userId);
    await supabase.from('two_factor_auth').delete().eq('user_id', userId);
    await supabase.from('profils').delete().eq('id', userId);

    // Supprimer le compte auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('[delete-user] auth deletion error:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[delete-user] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
