import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

const NTFY_TOPIC = process.env.NTFY_TOPIC || 'secretariatpro-kyc';
const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Seul le titulaire du dossier peut déclencher la notification des admins.
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(`kyc-notify-admins:${user.id}`, 5, 60000);
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
    }

    let body: { userId?: string; prenom?: string; nom?: string; type?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
    }

    const { userId, prenom, nom, type } = body;

    if (!userId || !prenom || !nom) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Vérifier qu'il existe bien un KYC en attente pour cet utilisateur
    const supabase = getSupabaseAdmin();
    const { data: kyc } = await supabase
      .from('kyc_verifications')
      .select('statut')
      .eq('user_id', userId)
      .eq('statut', 'pending')
      .maybeSingle();

    if (!kyc) {
      return NextResponse.json({ error: 'Aucun KYC en attente pour cet utilisateur' }, { status: 404 });
    }

    const typeLabel = type === 'entreprise' ? 'Entreprise' : 'Secrétaire';

    const message = `📋 Nouveau KYC à valider\n\n${prenom} ${nom}\nType : ${typeLabel}\n\nConnectez-vous pour valider ou rejeter ce dossier.`;

    const response = await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': 'Nouveau KYC à valider',
        'Tags': 'warning',
        'Priority': 'high',
      },
      body: message,
    });

    if (!response.ok) {
      console.error('[ntfy] Error:', response.status);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ntfy] error:', error);
    return NextResponse.json({ ok: true });
  }
}