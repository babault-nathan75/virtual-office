import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMail } from '@/lib/mailer';
import { getSiteUrl } from '@/lib/env';



async function getWeeklyStats(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: messages } = await getSupabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .gte('created_at', weekAgo);

  const { count: unread } = await getSupabaseAdmin()
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
  <p>Bonjour <strong>${userName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>,</p>
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
  <a href="${getSiteUrl()}/dashboard/messages" style="display: block; text-align: center; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Voir mes discussions</a>
  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Email automatique — SecrétariatPro</p>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    // Sans le test explicite sur cronSecret, un CRON_SECRET absent rend
    // l'en-tête « Bearer undefined » valide et ouvre la route à tous.
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: users } = await getSupabaseAdmin()
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

      // Un envoi en échec (adresse invalide, quota SMTP…) ne doit pas
      // interrompre le digest des autres utilisateurs.
      try {
        await sendMail({
          to: user.email,
          subject: `📊 Votre résumé hebdomadaire — ${stats.messages} messages`,
          html: generateDigestHTML(user.nom || 'Utilisateur', stats),
        });
        sent++;
      } catch (mailError) {
        console.error('[digest] Envoi échoué pour un destinataire :', mailError);
      }
    }

    // La purge est rattachée au cron hebdomadaire : sans elle, `otp_codes`
    // conserve indéfiniment les empreintes de tous les codes émis et
    // `auth_events` grossit sans limite.
    let purged = true;
    try {
      const { error } = await getSupabaseAdmin().rpc('purge_auth_artifacts');
      if (error) throw new Error(error.message);
    } catch (purgeError) {
      purged = false;
      console.error("[digest] Purge des artefacts d'authentification :", purgeError);
    }

    return NextResponse.json({ sent, purged });
  } catch (error) {
    console.error('[digest] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
