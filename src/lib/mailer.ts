import nodemailer, { type Transporter } from 'nodemailer';
import { env, getSiteUrl } from '@/lib/env';
import { escapeHtml } from '@/lib/sanitize';

/**
 * Transport SMTP unique.
 *
 * Quatre routes créaient chacune leur `createTransport` — dont deux au moment
 * de l'import du module, ce qui faisait échouer le build dès que SMTP_USER
 * n'était pas défini. Ici, le transport est créé au premier envoi et réutilisé
 * ensuite (le pool évite de rouvrir une connexion TLS par email).
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

/**
 * Fournisseur d'envoi.
 *
 * Gmail plafonne à environ 500 destinataires par jour. Avec un code à usage
 * unique demandé à chaque connexion, ce plafond est atteint vers 150 à 200
 * utilisateurs actifs quotidiens — et une fois atteint, ce sont les connexions
 * elles-mêmes qui cessent de fonctionner, pas seulement les notifications.
 *
 * La bascule est donc préparée ici plutôt que repoussée : renseigner
 * `RESEND_API_KEY` suffit à changer de fournisseur, sans toucher au code ni
 * ajouter de dépendance (l'API Resend est un simple appel HTTP). Le SMTP reste
 * le mode par défaut tant que la clé est absente.
 */
export type MailProvider = 'resend' | 'smtp' | 'none';

export function getMailProvider(): MailProvider {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return 'none';
}

export function isMailConfigured(): boolean {
  return getMailProvider() !== 'none';
}

/**
 * Adresse d'expédition.
 *
 * Resend impose une adresse sur un domaine vérifié : réutiliser l'adresse
 * Gmail y ferait échouer tous les envois. `MAIL_FROM` permet de la déclarer
 * indépendamment du compte SMTP.
 */
function fromAddress(): string {
  const explicit = process.env.MAIL_FROM;
  if (explicit) {
    return explicit.includes('<') ? explicit : `"SecrétariatPro" <${explicit}>`;
  }
  return `"SecrétariatPro" <${env.smtpUser}>`;
}

type SendOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({ to, subject, html, text }: SendOptions): Promise<void> {
  const provider = getMailProvider();
  if (provider === 'none') {
    throw new Error(
      "Aucun fournisseur d'email configuré (RESEND_API_KEY, ou SMTP_USER + SMTP_PASS)."
    );
  }

  // Une alternative texte réduit nettement le score anti-spam d'un email
  // purement HTML, et reste lisible sur les clients qui la préfèrent.
  const plain = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text: plain }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend a refusé l'envoi (${response.status}) : ${detail.slice(0, 300)}`);
    }
    return;
  }

  await getTransporter().sendMail({ from: fromAddress(), to, subject, html, text: plain });
}

/**
 * Gabarit commun à tous les emails transactionnels.
 *
 * Tableaux et styles en ligne : c'est le seul rendu fiable sur Outlook et
 * Gmail, qui ignorent les feuilles de style externes et une grande partie du
 * CSS moderne.
 */
export function renderEmailLayout(options: {
  title: string;
  body: string;
  preheader?: string;
}): string {
  const { title, body, preheader = '' } = options;
  const site = getSiteUrl();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
<tr><td style="background:linear-gradient(135deg,#1e293b,#334155);padding:32px 40px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Secrétariat<span style="color:#60a5fa;">Pro</span></h1>
</td></tr>
<tr><td style="padding:40px;">
${body}
</td></tr>
<tr><td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;text-align:center;">
Email envoyé automatiquement par <a href="${site}" style="color:#64748b;">SecrétariatPro</a>.<br>
Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Email contenant un code à usage unique.
 *
 * Le code est rendu en gros et espacé pour rester lisible et recopiable depuis
 * un téléphone, et l'intitulé de l'action est explicite : un utilisateur qui
 * reçoit un code qu'il n'a pas demandé doit comprendre immédiatement de quoi
 * il s'agit.
 */
export function renderOtpEmail(options: {
  code: string;
  purposeLabel: string;
  expiresInMinutes: number;
  nom?: string;
}): string {
  const { code, purposeLabel, expiresInMinutes, nom } = options;
  const greeting = nom ? `Bonjour ${escapeHtml(nom)},` : 'Bonjour,';

  return renderEmailLayout({
    title: `Votre code : ${code}`,
    preheader: `Votre code de vérification est ${code} (valable ${expiresInMinutes} minutes).`,
    body: `
<p style="color:#0f172a;font-size:16px;margin:0 0 8px;font-weight:600;">${greeting}</p>
<p style="color:#475569;line-height:1.7;margin:0 0 28px;font-size:15px;">
Voici votre code de vérification pour <strong>${escapeHtml(purposeLabel)}</strong>.
</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:0 0 28px;">
<div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:20px 32px;">
<span style="font-size:38px;font-weight:800;letter-spacing:10px;color:#1d4ed8;font-family:'Courier New',monospace;">${escapeHtml(code)}</span>
</div>
</td></tr></table>
<p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 8px;">
Ce code expire dans <strong>${expiresInMinutes} minutes</strong> et ne peut servir qu'une seule fois.
</p>
<p style="color:#94a3b8;font-size:13px;line-height:1.7;margin:0;">
Ne le communiquez à personne : aucun membre de l'équipe SecrétariatPro ne vous le demandera.
</p>`,
  });
}
