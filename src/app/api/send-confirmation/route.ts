import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/sanitize';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

const confirmSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  nom: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(`send-confirmation:${getClientIp(request)}`, 3, 300000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans 5 minutes.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId, email, nom } = parsed.data;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('[send-confirmation] SMTP credentials missing');
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await supabaseAdmin
    .from('email_confirmations')
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt,
    });

  if (tokenError) {
    console.error('[send-confirmation] Token insert error:', tokenError.message, tokenError.code);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  const allowedOrigins = [
    'https://secretariatpro-drab.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  const requestOrigin = request.headers.get('origin') || '';
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  const confirmUrl = `${origin}/api/confirm-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Confirmez votre inscription - SecrétariatPro',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1e293b,#334155);padding:40px 40px 30px;text-align:center;">
<div style="font-size:32px;margin-bottom:8px;">📋</div>
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">SecrétariatPro</h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Bienvenue ${escapeHtml(nom || '')} !</h2>
<p style="color:#475569;line-height:1.7;margin:0 0 24px;font-size:15px;">
Merci pour votre inscription. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 32px;">
<a href="${confirmUrl}" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:16px 48px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
Confirmer mon email
</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
Si le bouton ne fonctionne pas, copiez ce lien :<br>
<a href="${confirmUrl}" style="color:#2563eb;word-break:break-all;">${confirmUrl}</a>
</p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
Cet email a été envoyé par SecrétariatPro. Si vous n'avez pas créé de compte, ignorez cet email.
</p></td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (mailError: unknown) {
    const errMsg = mailError instanceof Error ? mailError.message : String(mailError);
    console.error('[send-confirmation] SMTP error:', errMsg);
    return NextResponse.json({ error: 'Failed to send email', details: errMsg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
