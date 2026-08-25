/**
 * Vérification d'un mot de passe contre les fuites connues (haveibeenpwned).
 *
 * Isolée de `validations.ts` volontairement : ce module fait un appel réseau,
 * alors que `validations.ts` est importé par des composants client et doit
 * rester purement synchrone et sans effet de bord. Mélanger les deux imposait
 * un schéma Zod asynchrone à tous les appelants, y compris ceux qui valident
 * en `safeParse` — lequel lève sur un schéma asynchrone.
 */

/** Longueur du préfixe envoyé à l'API (k-anonymity : 5 caractères hex). */
const PREFIX_LENGTH = 5;
const REQUEST_TIMEOUT_MS = 4000;

async function sha1Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Retourne `true` si le mot de passe figure dans une fuite connue.
 *
 * Le mot de passe ne quitte jamais le processus : seuls les 5 premiers
 * caractères de son empreinte SHA-1 sont transmis, et la comparaison du
 * suffixe se fait localement.
 *
 * En cas d'indisponibilité de l'API, on laisse passer. Le compromis est
 * assumé : bloquer toutes les inscriptions parce qu'un service tiers est en
 * panne coûte plus que de laisser passer temporairement un mot de passe faible,
 * qui reste soumis aux exigences de longueur et de complexité.
 */
export async function checkCompromisedPassword(password: string): Promise<boolean> {
  if (!password) return false;

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, PREFIX_LENGTH);
    const suffix = hash.slice(PREFIX_LENGTH);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const body = await response.text();
    // Le corps contient des lignes « SUFFIXE:OCCURRENCES ». Comparer la ligne
    // entière avec `startsWith(suffix)` sans le séparateur produirait des faux
    // positifs sur un suffixe préfixe d'un autre.
    return body
      .split('\n')
      .some(line => line.slice(0, suffix.length).toUpperCase() === suffix && line[suffix.length] === ':');
  } catch {
    return false;
  }
}
