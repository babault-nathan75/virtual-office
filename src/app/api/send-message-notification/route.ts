import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/sanitize';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { getAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMail } from '@/lib/mailer';


const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://secretariatpro-drab.vercel.app');


// Le client ne fournit qu'un destinataire ; l'adresse email, le nom de
// l'expéditeur et le contenu sont résolus côté serveur à partir de la base.
// Sans cela, la route est un relais d'emails ouvert (phishing / spam).
const notifySchema = z.object({
  recipientId: z.string().uuid(),
});

export async function POST(request: Request) {
  const sender = await getAuthenticatedUser();
  if (!sender) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rateLimitResult = await checkRateLimit(`send-msg-notif:${sender.id}`, 10, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { recipientId } = parsed.data;

  if (recipientId === sender.id) {
    return NextResponse.json({ error: 'Destinataire invalide' }, { status: 400 });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[send-message-notification] SMTP credentials missing');
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
  }

  const [{ data: recipient }, { data: senderProfile }] = await Promise.all([
    getSupabaseAdmin().from('profils').select('nom, email').eq('id', recipientId).maybeSingle(),
    getSupabaseAdmin().from('profils').select('nom').eq('id', sender.id).maybeSingle(),
  ]);

  if (!recipient?.email) {
    return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 404 });
  }

  // On ne notifie que s'il existe réellement des messages non lus de cet
  // expéditeur vers ce destinataire.
  const { data: unread } = await getSupabaseAdmin()
    .from('messages')
    .select('content, created_at')
    .eq('sender_id', sender.id)
    .eq('receiver_id', recipientId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(1000);

  const messageCount = unread?.length ?? 0;
  if (messageCount === 0) {
    return NextResponse.json({ success: false, reason: 'Aucun message non lu' });
  }

  const recipientName = recipient.nom || '';
  const senderName = senderProfile?.nom || 'Un utilisateur';
  const lastMessage = unread?.[0]?.content ?? '';

  try {
    await sendMail({
      to: recipient.email,
      // Le sujet est du texte brut : pas d'échappement HTML ici, sinon les
      // apostrophes s'affichent en « &#x27; » dans la boîte de réception.
      subject: `Messages non lus de ${senderName} - SecrétariatPro`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1e293b,#334155);padding:40px 40px 30px;text-align:center;">
<div style="font-size:32px;margin-bottom:8px;">💬</div>
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">SecrétariatPro</h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Bonjour ${escapeHtml(recipientName || '')},</h2>
<p style="color:#475569;line-height:1.7;margin:0 0 24px;font-size:15px;">
Vous avez <strong>${messageCount} message${messageCount > 1 ? 's' : ''} non lu${messageCount > 1 ? 's' : ''}</strong> de <strong>${escapeHtml(senderName)}</strong> qui vous attend${messageCount > 1 ? 'ent' : ''}.
</p>
<div style="background:#f8fafc;border-left:4px solid #2563eb;padding:16px 20px;border-radius:8px;margin:0 0 24px;">
<p style="color:#475569;font-size:14px;margin:0;font-style:italic;">"${escapeHtml(lastMessage.length > 100 ? lastMessage.slice(0, 100) + '...' : lastMessage)}"</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 32px;">
<a href="${SITE_URL}/dashboard/messages" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:16px 48px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
Répondre maintenant
</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
Ce message a été envoyé automatiquement par SecrétariatPro. Vous recevez cet email car vous avez des messages non lus depuis plus de 10 minutes.
</p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
SecrétariatPro - Votre secrétariat en ligne
</p></td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (mailError: unknown) {
    const errMsg = mailError instanceof Error ? mailError.message : String(mailError);
    console.error('[send-message-notification] SMTP error:', errMsg);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
