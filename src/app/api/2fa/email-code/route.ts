import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const emailCodeSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit('2fa-email-code', 3);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans 5 minutes.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = emailCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { data: tfa } = await supabaseAdmin
    .from('two_factor_auth')
    .select('method, secret, enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tfa?.enabled) {
    return NextResponse.json({ error: '2FA not enabled' }, { status: 400 });
  }

  const { data: profil } = await supabaseAdmin
    .from('profils')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!profil?.email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 400 });
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expires = Date.now() + 10 * 60 * 1000;

  await supabaseAdmin
    .from('two_factor_auth')
    .update({ secret: `${tfa.secret}:${code}:${expires}` })
    .eq('user_id', userId);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });

  await transporter.sendMail({
    from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
    to: profil.email,
    subject: 'Votre code de connexion - SecrétariatPro',
    html: `<div style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2 style="color:#1e293b;">Code de connexion</h2>
      <p style="color:#475569;">Voici votre code pour vous connecter :</p>
      <div style="font-size:48px;font-weight:bold;letter-spacing:12px;color:#2563eb;margin:30px 0;">${code}</div>
      <p style="color:#94a3b8;font-size:13px;">Ce code expire dans 10 minutes.</p>
    </div>`,
  });

  return NextResponse.json({ success: true });
}
