/**
 * Filtre anti-redirection ouverte, partagé par tous les points de l'application
 * qui redirigent vers une destination reçue de l'extérieur (`?suivant=`,
 * URL d'une notification push…).
 *
 * Il en existait deux copies, toutes deux contournables : elles refusaient
 * `//evil.com` et `/\evil.com`, mais acceptaient `/\t/evil.com`. Or l'analyseur
 * d'URL des navigateurs SUPPRIME les tabulations et retours à la ligne avant
 * de résoudre : `/\t/evil.com` devient `//evil.com`, soit `https://evil.com/`.
 *
 * La règle retenue est donc stricte : un chemin absolu interne, sans caractère
 * de contrôle, sans antislash, et dont la résolution reste sur l'origine.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  if (value.length > 2048) return null;
  if (!value.startsWith('/')) return null;
  // Caractères de contrôle (dont \t, \n, \r) : retirés par le navigateur,
  // ils permettent de reconstituer « // » après coup.
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  if (value.includes('\\')) return null;
  if (value.startsWith('//')) return null;

  // Dernier filet : la résolution doit rester sur l'origine de référence.
  try {
    const base = 'https://origine.invalid';
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return null;
  } catch {
    return null;
  }

  return value;
}
