import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { escapeHtml } from '@/lib/sanitize';
import { getAuthenticatedUser } from '@/lib/auth';

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

// L'URL publique du site — l'ancienne valeur dérivait de l'URL Supabase
// (`.replace('.supabase.co', '')`) et produisait un lien invalide dans l'email.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://secretariatpro-drab.vercel.app');

const notifySchema = z.object({
  userId: z.string().uuid(),
  statut: z.enum(['approved', 'rejected']),
  motif: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  // Seul un administrateur peut notifier une décision KYC : sans ce contrôle,
  // n'importe qui pourrait envoyer de faux emails « KYC approuvé/rejeté ».
  const caller = await getAuthenticatedUser();
  if (!caller) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profils')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const rateLimitResult = await checkRateLimit(`kyc-notify-user:${caller.id}`, 10, 60000);
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

  const { userId, statut, motif } = parsed.data;

  const { data: profil } = await supabaseAdmin
    .from('profils')
    .select('nom, email')
    .eq('id', userId)
    .maybeSingle();

  if (!profil?.email) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const notifTitle = statut === 'approved' ? 'KYC approuvé' : 'KYC rejeté';
  const notifMessage = statut === 'approved'
    ? 'Votre vérification d\'identité a été approuvée. Votre profil est maintenant visible par les entreprises.'
    : `Votre vérification d\'identité a été rejetée.${motif ? ` Motif : ${motif}` : ''} Veuillez soumettre un nouveau dossier.`;

  // 1) Insert in-app notification
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type: 'kyc',
    title: notifTitle,
    message: notifMessage,
    link: '/dashboard/secretaire',
  });

  // 2) Send email
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const isRejected = statut === 'rejected';
      const bgColor = isRejected ? '#fef2f2' : '#f0fdf4';
      const borderColor = isRejected ? '#fecaca' : '#bbf7d0';
      const accentColor = isRejected ? '#dc2626' : '#16a34a';
      const icon = isRejected ? '❌' : '✅';
      const btnColor = isRejected ? '#dc2626' : '#16a34a';

      await transporter.sendMail({
        from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
        to: profil.email,
        subject: `${notifTitle} - SecrétariatPro`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:${accentColor};padding:32px;text-align:center;">
      <span style="font-size:48px;">${icon}</span>
      <h1 style="color:#fff;font-size:22px;margin:12px 0 0;font-weight:800;">${escapeHtml(notifTitle)}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">Bonjour <strong>${escapeHtml(profil.nom || 'Utilisateur')}</strong>,</p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">${escapeHtml(notifMessage)}</p>
      ${isRejected && motif ? `
      <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:${accentColor};font-size:13px;font-weight:700;margin:0 0 4px;">Motif du refus</p>
        <p style="color:#475569;font-size:14px;margin:0;">${escapeHtml(motif)}</p>
      </div>` : ''}
      <div style="text-align:center;margin:28px 0;">
        <a href="${SITE_URL}/dashboard/secretaire" style="display:inline-block;background:${btnColor};color:#fff;padding:14px 32px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;">
          ${isRejected ? 'Soumettre un nouveau dossier' : 'Accéder à mon tableau de bord'}
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">SecrétariatPro &mdash; Mise en relation entreprises et secrétaires</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      console.error('[kyc-notify-user] Email error:', err);
    }
  }

  return NextResponse.json({ success: true });
}
