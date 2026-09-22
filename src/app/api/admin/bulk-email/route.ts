import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendMail, renderEmailLayout } from '@/lib/mailer';

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

const bulkEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
  filter: z.object({
    role: z.literal('secretaire').optional(),
    incompleteOnly: z.boolean().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = await checkRateLimit(`admin-bulk-email:${ip}`, 3, 3600000); // 3 per hour
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Trop de requêtes. Limite : 3 emails groupés par heure.' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
    }

    const parsed = bulkEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    const { subject, html, text, filter } = parsed.data;

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseServer = getSupabaseServer();

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !caller) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profils')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
    }

    // Build query for secretaries
    let query = supabaseAdmin
      .from('profils')
      .select('id, email, nom')
      .eq('role', 'secretaire');

    // If incompleteOnly filter is set, find secretaries with incomplete profiles
    if (filter?.incompleteOnly) {
      // Get secretaries with incomplete profiles
      const { data: secretaryProfiles } = await supabaseAdmin
        .from('profils_secretaires')
        .select('id')
        .or('bio.is.null,ville.is.null,disponibilite.is.null,specialite.is.null,competences.is.null,outils.is.null,soft_skills.is.null,niveau_etudes.is.null,langues.is.null,annees_experience.is.null');

      const incompleteIds = (secretaryProfiles ?? []).map(p => p.id);
      if (incompleteIds.length > 0) {
        query = query.in('id', incompleteIds);
      } else {
        return NextResponse.json({ sent: 0, message: 'Tous les profils sont complets' });
      }
    }

    const { data: secretaries, error } = await query;
    if (error) {
      console.error('[bulk-email] query error:', error.message);
      return NextResponse.json({ error: 'Erreur lors de la récupération des destinataires' }, { status: 500 });
    }

    if (!secretaries || secretaries.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Aucun destinataire trouvé' });
    }

    // Send emails in batches to avoid rate limits
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < secretaries.length; i += BATCH_SIZE) {
      const batch = secretaries.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (sec) => {
          try {
            const personalizedHtml = html.replace(/\{\{nom\}\}/g, sec.nom || 'Secrétaire');
            const personalizedText = text?.replace(/\{\{nom\}\}/g, sec.nom || 'Secrétaire');
            
            await sendMail({
              to: sec.email,
              subject,
              html: renderEmailLayout({
                title: subject,
                body: personalizedHtml,
              }),
              text: personalizedText,
            });
            sent++;
          } catch (err) {
            failed++;
            errors.push(`${sec.email}: ${err instanceof Error ? err.message : String(err)}`);
          }
        })
      );
      
      // Small delay between batches
      if (i + BATCH_SIZE < secretaries.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: caller.id,
      action: 'admin_bulk_email',
      details: JSON.stringify({ 
        subject, 
        recipientCount: secretaries.length,
        sent,
        failed,
        filter 
      }),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ 
      sent, 
      failed, 
      total: secretaries.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[bulk-email] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}