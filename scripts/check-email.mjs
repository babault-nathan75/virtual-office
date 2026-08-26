#!/usr/bin/env node
/**
 * Vérifie la configuration d'envoi d'emails, et la délivrabilité qui en dépend.
 *
 * Changer de fournisseur ne suffit pas à sortir des indésirables. Ce qui
 * détermine le classement, c'est l'alignement DMARC : l'adresse affichée dans
 * « De : » doit appartenir à un domaine dont VOUS contrôlez le DNS, et que le
 * fournisseur signe en DKIM. Un email envoyé via Brevo mais affiché comme
 * venant d'une adresse @gmail.com échoue cet alignement — et sera classé plus
 * durement qu'avant, pas moins.
 *
 * Usage :
 *   node scripts/check-email.mjs
 *   node scripts/check-email.mjs --send destinataire@exemple.com
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveTxt, resolveMx } from 'node:dns/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const c = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  blue: '[34m',
};

/** Domaines de messagerie grand public : jamais utilisables comme expéditeur applicatif. */
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com',
  'hotmail.fr', 'outlook.com', 'outlook.fr', 'live.fr', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'orange.fr', 'wanadoo.fr', 'free.fr',
]);

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    let raw;
    try {
      raw = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in env)) env[key] = value;
    }
  }
  return { ...env, ...process.env };
}

const line = (symbol, color, message) => console.log(`${color}${symbol}${c.reset}  ${message}`);
const ok = m => line('✔', c.green, m);
const bad = m => line('✖', c.red, m);
const warn = m => line('!', c.yellow, m);
const info = m => line('·', c.dim, m);

function parseFrom(value) {
  if (!value) return null;
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || 'SecrétariatPro', email: match[2].trim() };
  return { name: 'SecrétariatPro', email: value.trim() };
}

/**
 * Résolution DNS tolérante aux résolveurs défaillants.
 *
 * Distinguer « pas d'enregistrement » de « je n'ai pas pu demander » est
 * essentiel : confondre les deux ferait annoncer un SPF manquant sur un
 * domaine correctement configuré, et enverrait chercher un problème
 * inexistant. Un résolveur d'entreprise ou de box qui refuse les requêtes TXT
 * est un cas courant.
 *
 * En cas d'échec du résolveur système, on retente via DNS-over-HTTPS, ce qui
 * contourne aussi les résolveurs qui filtrent ces types d'enregistrement.
 */
async function lookupTxt(name) {
  try {
    return { status: 'ok', records: (await resolveTxt(name)).map(chunks => chunks.join('')) };
  } catch (error) {
    // ENODATA / ENOTFOUND : le domaine répond, mais n'a pas cet enregistrement.
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return { status: 'ok', records: [] };
    }
  }

  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } }
    );
    if (!response.ok) return { status: 'unavailable', records: [] };
    const data = await response.json();
    const records = (data.Answer ?? [])
      .filter(answer => answer.type === 16)
      .map(answer => String(answer.data).replace(/^"|"$/g, '').replace(/" "/g, ''));
    return { status: 'ok', records };
  } catch {
    return { status: 'unavailable', records: [] };
  }
}

async function lookupMx(name) {
  try {
    return { status: 'ok', records: await resolveMx(name) };
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return { status: 'ok', records: [] };
    }
    return { status: 'unavailable', records: [] };
  }
}

async function main() {
  console.log(`\n${c.bold}Vérification de la configuration d'envoi d'emails${c.reset}\n`);

  const env = loadEnv();
  let failed = false;

  // --- Fournisseur --------------------------------------------------------
  const provider = env.BREVO_API_KEY
    ? 'brevo'
    : env.RESEND_API_KEY
      ? 'resend'
      : env.SMTP_USER && env.SMTP_PASS
        ? 'smtp'
        : 'none';

  if (provider === 'none') {
    bad("Aucun fournisseur configuré (BREVO_API_KEY, RESEND_API_KEY, ou SMTP_USER + SMTP_PASS).");
    process.exit(1);
  }

  const host = env.SMTP_HOST || 'smtp.gmail.com';
  ok(`Fournisseur : ${c.bold}${provider}${c.reset}${provider === 'smtp' ? ` (${host}:${env.SMTP_PORT || 587})` : ''}`);

  if (provider === 'smtp' && /brevo|sendinblue/i.test(host)) {
    console.log('');
    warn('SMTP Brevo depuis un hébergement sans serveur : attention aux IP autorisées.');
    info("  Brevo peut restreindre l'usage des clés SMTP à une liste d'adresses IP.");
    info('  Les fonctions Vercel sortent par des IP dynamiques et non documentées :');
    info("  la liste ne peut pas être tenue à jour, et l'envoi cassera sans prévenir.");
    info(`  ${c.bold}Remède${c.reset}${c.dim} : utilisez BREVO_API_KEY (API HTTP, sans restriction d'IP),`);
    info("  ou videz la liste des IP autorisées dans Brevo.");
  }

  if (provider === 'smtp' && /gmail/i.test(host)) {
    console.log('');
    warn('SMTP Gmail : plafond d’environ 500 envois par jour.');
    info("  Avec un code à chaque connexion, atteint vers 150 à 200 utilisateurs actifs.");
  }

  // --- Adresse d'expédition ----------------------------------------------
  console.log('');
  const from = parseFrom(env.MAIL_FROM);

  if (!from) {
    const user = env.SMTP_USER?.trim() ?? '';
    if (/@(smtp-brevo\.com|sendinblue\.com|mailjet\.com)$/i.test(user) || user === 'apikey') {
      bad('MAIL_FROM est absent, et SMTP_USER est un identifiant technique.');
      info(`  « ${user} » authentifie le relais, ce n'est pas une adresse d'expédition.`);
      info('  Brevo refusera l’envoi. Renseignez MAIL_FROM.');
      failed = true;
    } else if (provider !== 'smtp') {
      bad(`MAIL_FROM est requis avec le fournisseur ${provider}.`);
      failed = true;
    } else {
      warn(`MAIL_FROM absent : l'expéditeur sera ${user}.`);
    }
  } else {
    ok(`Expéditeur : ${from.name} <${from.email}>`);
  }

  const fromEmail = from?.email ?? env.SMTP_USER ?? '';
  const domain = fromEmail.split('@')[1]?.toLowerCase();

  if (!domain) {
    bad("Impossible de déterminer le domaine d'expédition.");
    process.exit(1);
  }

  // --- Alignement DMARC ---------------------------------------------------
  console.log('');
  console.log(`${c.bold}Délivrabilité du domaine ${domain}${c.reset}`);
  console.log('');

  if (FREE_MAIL_DOMAINS.has(domain)) {
    bad(`« ${domain} » est un domaine de messagerie grand public.`);
    info("  Vous ne contrôlez pas son DNS : ni SPF ni DKIM ne peuvent être alignés.");
    info('  Gmail et Yahoo publient une politique DMARC stricte sur leurs propres');
    info('  domaines : un email « de » cette adresse mais envoyé par un tiers est');
    info(`  ${c.bold}rejeté ou classé indésirable${c.reset}${c.dim} — plus durement qu'avec un envoi direct.`);
    console.log('');
    info(`  ${c.bold}Ce point seul décide du classement en spam.${c.reset}`);
    info('  Il faut un domaine à vous (ex. secretariatpro.ci), authentifié dans Brevo.');
    failed = true;
  } else if (/\.vercel\.app$/.test(domain)) {
    bad(`« ${domain} » appartient à Vercel : vous ne pouvez pas y ajouter d'enregistrement DNS.`);
    info("  Aucune authentification d'expéditeur n'y est possible.");
    failed = true;
  } else {
    ok(`« ${domain} » est un domaine propre : l'authentification y est possible.`);

    const mx = await lookupMx(domain);
    if (mx.status === 'unavailable') {
      warn('MX non vérifiable : résolution DNS indisponible depuis ce poste.');
    } else if (mx.records.length === 0) {
      warn('Aucun enregistrement MX : le domaine ne peut pas recevoir de réponse.');
      info("  Prévoyez au moins une redirection pour l'adresse de réponse.");
    } else {
      ok(`MX présent (${mx.records.length} enregistrement${mx.records.length > 1 ? 's' : ''}).`);
    }

    const spfLookup = await lookupTxt(domain);
    const spf = spfLookup.records.filter(r => r.toLowerCase().startsWith('v=spf1'));

    if (spfLookup.status === 'unavailable') {
      warn('SPF non vérifiable : résolution DNS indisponible depuis ce poste.');
      info('  Relancez depuis un réseau dont le résolveur répond aux requêtes TXT.');
    } else if (spf.length === 0) {
      bad('Aucun enregistrement SPF.');
      info('  Ajoutez celui indiqué par Brevo dans « Expéditeurs, domaine, IP ».');
      failed = true;
    } else if (spf.length > 1) {
      bad(`${spf.length} enregistrements SPF : un seul est autorisé, les autres invalident tout.`);
      failed = true;
    } else {
      const includesBrevo = /sendinblue|brevo/i.test(spf[0]);
      if (provider.startsWith('brevo') || /brevo|sendinblue/i.test(host)) {
        if (includesBrevo) ok('SPF présent et incluant Brevo.');
        else {
          bad('SPF présent mais sans « include:spf.brevo.com ».');
          info(`  Trouvé : ${spf[0].slice(0, 120)}`);
          failed = true;
        }
      } else {
        ok('SPF présent.');
      }
    }

    // Brevo signe avec le sélecteur « mail ».
    const dkimLookup = await lookupTxt(`mail._domainkey.${domain}`);
    const dkim = dkimLookup.records;
    if (dkimLookup.status === 'unavailable') {
      warn('DKIM non vérifiable : résolution DNS indisponible depuis ce poste.');
    } else if (dkim.length === 0) {
      warn('Aucun DKIM trouvé sur le sélecteur « mail » (celui de Brevo).');
      info("  Si vous utilisez un autre fournisseur, le sélecteur diffère et ce test");
      info('  ne s’applique pas. Sinon, ajoutez l’enregistrement fourni par Brevo.');
    } else {
      ok('DKIM présent sur le sélecteur « mail ».');
    }

    const dmarcLookup = await lookupTxt(`_dmarc.${domain}`);
    const dmarc = dmarcLookup.records.filter(r => r.toLowerCase().startsWith('v=dmarc1'));
    if (dmarcLookup.status === 'unavailable') {
      warn('DMARC non vérifiable : résolution DNS indisponible depuis ce poste.');
    } else if (dmarc.length === 0) {
      warn('Aucune politique DMARC.');
      info('  Commencez par une politique d’observation, sans risque de rejet :');
      info(`  ${c.bold}_dmarc.${domain}  TXT  "v=DMARC1; p=none; rua=mailto:postmaster@${domain}"${c.reset}`);
    } else {
      ok(`DMARC présent : ${dmarc[0].slice(0, 80)}`);
    }
  }

  // --- Envoi de test ------------------------------------------------------
  const sendIndex = process.argv.indexOf('--send');
  if (sendIndex !== -1) {
    const recipient = process.argv[sendIndex + 1];
    console.log('');
    if (!recipient || !recipient.includes('@')) {
      bad('Usage : node scripts/check-email.mjs --send destinataire@exemple.com');
      process.exit(1);
    }
    if (provider !== 'brevo') {
      warn("L'envoi de test n'est câblé que pour l'API Brevo.");
      info('  Pour le SMTP, lancez l’application et déclenchez une connexion réelle.');
    } else {
      info(`Envoi d'un message de test à ${recipient}…`);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: from?.name ?? 'SecrétariatPro', email: fromEmail },
          to: [{ email: recipient }],
          subject: 'Test de configuration — SecrétariatPro',
          htmlContent:
            '<p>Si vous lisez ce message, la configuration d’envoi fonctionne.</p>' +
            '<p>Vérifiez dans quel dossier il est arrivé, et consultez l’en-tête ' +
            '<code>Authentication-Results</code> : SPF, DKIM et DMARC doivent tous ' +
            'indiquer <code>pass</code>.</p>',
          textContent:
            "Si vous lisez ce message, la configuration d'envoi fonctionne. " +
            "Vérifiez l'en-tête Authentication-Results : SPF, DKIM et DMARC doivent indiquer pass.",
        }),
      });

      if (response.ok) {
        ok('Message accepté par Brevo.');
        info('  Ouvrez-le, puis affichez la source du message pour lire');
        info('  l’en-tête « Authentication-Results ».');
      } else {
        bad(`Brevo a refusé l'envoi (${response.status}) : ${(await response.text()).slice(0, 300)}`);
        failed = true;
      }
    }
  }

  console.log('');
  if (failed) {
    console.log(
      `${c.yellow}Configuration incomplète : les emails risquent d'être classés indésirables.${c.reset}\n`
    );
  } else {
    console.log(`${c.green}Configuration cohérente.${c.reset}\n`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  bad(error.stack ?? String(error));
  process.exit(1);
});
