import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function getWeeklyStats(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: messages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .gte('created_at', weekAgo);

  const { count: unread } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);

  return { messages: messages || 0, unread: unread || 0 };
}

function generateDigestHTML(userName: string, stats: { messages: number; unread: number }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #2563eb; font-size: 22px;">📊 Résumé hebdomadaire</h1>
    <p style="color: #64748b; font-size: 12px;">SecrétariatPro</p>
  </div>
  <p>Bonjour <strong>${userName}</strong>,</p>
  <p>Voici le résumé de votre activité cette semaine :</p>
  <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <div style="display: flex; justify-content: space-around; text-align: center;">
      <div>
        <p style="font-size: 28px; font-weight: 900; color: #2563eb; margin: 0;">${stats.messages}</p>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Messages</p>
      </div>
      <div>
        <p style="font-size: 28px; font-weight: 900; color: #f59e0b; margin: 0;">${stats.unread}</p>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Non lus</p>
      </div>
    </div>
  </div>
  <a href="https://secretariatpro-drab.vercel.app/dashboard/messages" style="display: block; text-align: center; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Voir mes discussions</a>
  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Email automatique — SecrétariatPro</p>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: users } = await supabase
      .from('profils')
      .select('id, nom, email')
      .eq('email_digest', true);

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sent = 0;
    for (const user of users) {
      if (!user.email) continue;
      const stats = await getWeeklyStats(user.id);
      if (stats.messages === 0) continue;

      await transporter.sendMail({
        from: `"SecrétariatPro" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `📊 Votre résumé hebdomadaire — ${stats.messages} messages`,
        html: generateDigestHTML(user.nom, stats),
      });
      sent++;
    }

    return NextResponse.json({ sent });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
