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

function smtpPort(): number {
  return Number(process.env.SMTP_PORT || 587);
}

function smtpHost(): string {
  return process.env.SMTP_HOST || 'smtp.gmail.com';
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost(),
      port: smtpPort(),
      secure: smtpPort() === 465,
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
 * Ordre de priorité : Brevo > SMTP > none. Une défaillance de la
 * voie d'API est rattrapée par le relais SMTP dans `sendMail` ; ici on ne
 * décide que de la voie principale.
 */

export type MailProvider = 'brevo' | 'smtp' | 'none';

export function getMailProvider(): MailProvider {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return 'none';
}

export function isMailConfigured(): boolean {
  return getMailProvider() !== 'none';
}

/**
 * Identifiants de connexion qui ne sont PAS des adresses d'expédition.
 *
 * Brevo, Mailjet ou SendGrid authentifient le relais SMTP avec un identifiant
 * technique (`b315a6001@smtp-brevo.com`, `apikey`…). Envoyer « de la part de »
 * cet identifiant est refusé par le fournisseur, et serait de toute façon
 * illisible pour le destinataire. L'adresse d'expédition doit être déclarée
 * séparément, dans `MAIL_FROM`.
 */
const RELAY_LOGIN_PATTERN = /@(smtp-brevo\.com|sendinblue\.com|mailjet\.com)$|^apikey$/i;

export type FromAddress = { name: string; email: string };

/**
 * Adresse d'expédition, sous forme structurée.
 *
 * Échoue explicitement plutôt que d'envoyer depuis une adresse invalide : une
 * erreur claire au premier envoi vaut mieux qu'un rejet opaque du fournisseur,
 * ou pire, des emails partis depuis une adresse que personne ne reconnaît et
 * que les filtres classent en indésirable.
 */
export function getFromAddress(): FromAddress {
  const explicit = process.env.MAIL_FROM?.trim();

  if (explicit) {
    const match = explicit.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (match) {
      return { name: match[1].trim() || 'SecrétariatPro', email: match[2].trim() };
    }
    return { name: 'SecrétariatPro', email: explicit };
  }

  const user = process.env.SMTP_USER?.trim();

  if (!user || RELAY_LOGIN_PATTERN.test(user)) {
    throw new Error(
      "MAIL_FROM est requis : l'identifiant de connexion SMTP n'est pas une adresse " +
        "d'expédition valide. Renseignez une adresse vérifiée chez votre fournisseur, " +
        'par exemple MAIL_FROM="SecrétariatPro <no-reply@votre-domaine.com>".'
    );
  }

  return { name: 'SecrétariatPro', email: user };
}

/** Même adresse, au format d'en-tête RFC 5322. */
export function formatFromHeader(from: FromAddress = getFromAddress()): string {
  return `"${from.name.replace(/"/g, '')}" <${from.email}>`;
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

type MailPayload = { to: string; subject: string; html: string; text: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Envoi via l'API HTTP Brevo.
 *
 * Renvoie `null` en cas de succès, sinon le message d'erreur à joindre au
 * rapport final. Les erreurs réseau sont attrapées ici pour que l'appelant
 * puisse tenter le relais SMTP sans perdre la cause première.
 */
async function sendViaBrevo(from: FromAddress, payload: MailPayload): Promise<string | null> {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      }),
    });
    if (response.ok) return null;
    const detail = await response.text().catch(() => '');
    return `Brevo a refusé l'envoi (${response.status}) : ${detail.slice(0, 300)}`;
  } catch (error) {
    return `appel de l'API Brevo impossible : ${errorMessage(error)}`;
  }
}

/**
 * Envoi d'email avec repli automatique.
 *
 * Ordre de priorité : Brevo > SMTP (`getMailProvider`). Quand la voie
 * d'API échoue — clé révoquée, adresse IP non autorisée par le fournisseur,
 * panne transitoire — on retente via le relais SMTP s'il est configuré. Si
 * toutes les voies échouent, l'exception joint chaque cause : « connection
 * refused » seul ne dirait pas que Brevo a d'abord refusé la clé.
 */
export async function sendMail({ to, subject, html, text }: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const provider = getMailProvider();
  if (provider === 'none') {
    throw new Error(
      "Aucun fournisseur d'email configuré (BREVO_API_KEY ou SMTP_USER + SMTP_PASS)."
    );
  }

  const from = getFromAddress();

  // Une alternative texte réduit nettement le score anti-spam d'un email
  // purement HTML, et reste lisible sur les clients qui la préfèrent.
  const plain = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const payload: MailPayload = { to, subject, html, text: plain };

  const failures: string[] = [];

  if (provider === 'brevo') {
    const failure = await sendViaBrevo(from, payload);
    if (!failure) return;
    failures.push(failure);
  }

  // Relais SMTP : voie directe (`provider === 'smtp'`) ou repli des API
  // ci-dessus. La garde sur les deux variables évite qu' `env.smtpUser`
  // lève « variable manquante » et masque la cause réelle de l'échec.
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await getTransporter().sendMail({
        from: formatFromHeader(from),
        to,
        subject,
        html,
        text: plain,
      });
      return;
    } catch (error) {
      failures.push(`relais SMTP : ${errorMessage(error)}`);
    }
  }

  throw new Error(`Envoi impossible à ${to} — ${failures.join(' ; ')}`);
}