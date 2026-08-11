import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const setupSchema = z.object({
  userId: z.string().uuid(),
  method: z.enum(['totp', 'email']),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit('2fa-setup', 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId, method } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { data: existing } = await supabaseAdmin
    .from('two_factor_auth')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.enabled) {
    return NextResponse.json({ error: '2FA already enabled' }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'SecretariatPro',
    label: userId,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;

  if (method === 'totp') {
    const uri = totp.toString();
    const qrData = await QRCode.toDataURL(uri);

    await supabaseAdmin.from('two_factor_auth').upsert({
      user_id: userId,
      secret,
      method: 'totp',
      enabled: false,
    });

    return NextResponse.json({ qrData, method: 'totp' });
  }

  const code = String(crypto.randomInt(100000, 999999));

  await supabaseAdmin.from('two_factor_auth').upsert({
    user_id: userId,
    secret: `${secret}:${code}`,
    method: 'email',
    enabled: false,
  });

  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });

  await transporter.sendMail({
    from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
    to: request.headers.get('x-user-email') || '',
    subject: 'Votre code de vérification - SecrétariatPro',
    html: `<div style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2 style="color:#1e293b;">Code de vérification</h2>
      <p style="color:#475569;">Voici votre code pour activer la 2FA :</p>
      <div style="font-size:48px;font-weight:bold;letter-spacing:12px;color:#2563eb;margin:30px 0;">${code}</div>
      <p style="color:#94a3b8;font-size:13px;">Ce code expire dans 10 minutes.</p>
    </div>`,
  });

  return NextResponse.json({ method: 'email', message: 'Code envoyé par email' });
}
