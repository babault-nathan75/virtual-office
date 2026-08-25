#!/usr/bin/env node
/**
 * Vérifie que les clés Turnstile configurées sont réelles et appariées.
 *
 * L'astuce : on appelle `siteverify` avec un jeton volontairement invalide.
 * Cloudflare répond alors par un code d'erreur qui distingue le problème de
 * clé du problème de jeton :
 *
 *   invalid-input-response  → la CLÉ SECRÈTE est bonne (elle a servi à
 *                             authentifier l'appel, seul le jeton a été rejeté)
 *   invalid-input-secret    → la clé secrète est fausse
 *   missing-input-secret    → aucune clé transmise
 *
 * On obtient donc une validation de bout en bout sans navigateur et sans
 * résoudre un vrai défi.
 *
 * Usage :  node scripts/check-turnstile.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA', // toujours accepté, visible
  '2x00000000000000000000AB', // toujours refusé
  '1x00000000000000000000BB', // toujours accepté, invisible
  '2x00000000000000000000BB',
  '3x00000000000000000000FF', // force un défi interactif
]);

const TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

const c = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  blue: '[34m',
};

function loadEnv() {
  // Volontairement sans dépendance : le script doit tourner avant tout
  // `npm install` sur une machine de déploiement.
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
      // `.env.local` est lu en premier et prime, comme chez Next.js.
      if (!(key in env)) env[key] = value;
    }
  }
  return { ...env, ...process.env };
}

function line(symbol, color, message) {
  console.log(`${color}${symbol}${c.reset}  ${message}`);
}

const ok = m => line('✔', c.green, m);
const bad = m => line('✖', c.red, m);
const warn = m => line('!', c.yellow, m);
const info = m => line('·', c.dim, m);

async function main() {
  console.log(`\n${c.bold}Vérification des clés Cloudflare Turnstile${c.reset}\n`);

  const env = loadEnv();
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim() ?? '';

  let failed = false;

  // --- Clé publique -------------------------------------------------------
  if (!siteKey) {
    warn('NEXT_PUBLIC_TURNSTILE_SITE_KEY est vide.');
    info('  Les clés de TEST de Cloudflare seront utilisées : le widget');
    info('  s\'affiche et valide toujours. Acceptable en local, sans effet');
    info('  protecteur en production.');
    failed = true;
  } else if (TEST_SITE_KEYS.has(siteKey)) {
    warn(`Clé publique de TEST détectée (${siteKey}).`);
    info('  Le widget acceptera tout le monde. À remplacer avant la mise en ligne.');
    failed = true;
  } else if (!/^0x[A-Za-z0-9_-]{10,}$/.test(siteKey)) {
    bad(`Clé publique au format inattendu : ${siteKey}`);
    info('  Une clé réelle commence par « 0x ». Vérifiez que vous avez copié la');
    info('  « Site Key » et non la « Secret Key ».');
    failed = true;
  } else {
    ok(`Clé publique présente (${siteKey.slice(0, 8)}…).`);
  }

  // --- Clé secrète --------------------------------------------------------
  if (!secretKey) {
    warn('TURNSTILE_SECRET_KEY est vide.');
    failed = true;
  } else if (TEST_SECRET_KEYS.has(secretKey)) {
    warn('Clé secrète de TEST détectée.');
    failed = true;
  } else if (secretKey.startsWith('0x4AAAAAAA') && secretKey === siteKey) {
    bad('La clé secrète est identique à la clé publique.');
    info('  Ce sont deux valeurs différentes dans le tableau de bord.');
    failed = true;
  } else {
    ok('Clé secrète présente.');
  }

  if (!secretKey || TEST_SECRET_KEYS.has(secretKey)) {
    console.log(
      `\n${c.yellow}Configuration incomplète.${c.reset} Créez le widget sur ` +
        `${c.blue}https://dash.cloudflare.com/?to=/:account/turnstile${c.reset}\n`
    );
    process.exit(1);
  }

  // --- Appel réel à siteverify -------------------------------------------
  info('Appel de siteverify avec un jeton volontairement invalide…');

  let data;
  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: 'jeton-volontairement-invalide',
        }),
      }
    );
    data = await response.json();
  } catch (error) {
    bad(`Cloudflare injoignable : ${error.message}`);
    process.exit(1);
  }

  const codes = data['error-codes'] ?? [];

  if (codes.includes('invalid-input-response')) {
    ok('Clé secrète acceptée par Cloudflare, jeton rejeté comme attendu.');
    ok('La vérification anti-robot est opérationnelle de bout en bout.');
  } else if (codes.includes('invalid-input-secret')) {
    bad('Clé secrète refusée par Cloudflare.');
    info('  Recopiez la « Secret Key » du widget, sans espace ni retour à la ligne.');
    failed = true;
  } else if (codes.includes('missing-input-secret')) {
    bad('Aucune clé secrète transmise.');
    failed = true;
  } else if (data.success === true) {
    // Ne peut arriver qu'avec la clé secrète de test « toujours accepté ».
    bad('Cloudflare a accepté un jeton invalide : clé secrète de test encore active.');
    failed = true;
  } else {
    warn(`Réponse inattendue : ${JSON.stringify(data)}`);
    failed = true;
  }

  // --- Rappels ------------------------------------------------------------
  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      const host = new URL(siteUrl).hostname;
      console.log('');
      info(`Domaine de production attendu sur le widget : ${c.bold}${host}${c.reset}`);
      info('  Un hôte absent de la liste du widget fait échouer la vérification');
      info('  en production avec le code « invalid-input-response ».');
    } catch {
      /* URL malformée : signalée ailleurs */
    }
  }

  console.log('');
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  bad(error.stack ?? String(error));
  process.exit(1);
});
