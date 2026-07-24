import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/sanitize';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function POST(request: Request) {
  let recipientEmail: string, recipientName: string, senderName: string, messageCount: number, lastMessage: string;
  try {
    const body = await request.json();
    recipientEmail = body.recipientEmail;
    recipientName = body.recipientName;
    senderName = body.senderName;
    messageCount = body.messageCount;
    lastMessage = body.lastMessage;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!recipientEmail || !senderName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[send-message-notification] SMTP credentials missing');
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
  }

  try {
    await transporter.sendMail({
      from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `Messages non lus de ${escapeHtml(senderName)} - SecrétariatPro`,
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
<a href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')}/dashboard/messages" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:16px 48px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
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
    return NextResponse.json({ error: 'Failed to send email', details: errMsg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
