import DOMPurify from 'dompurify';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return escapeHtml(html);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Neutralise les caractères spéciaux d'un motif LIKE/ILIKE.
 *
 * Sans cela, une saisie contenant « % » ou « _ » se comporte comme un joker,
 * et une virgule ou une parenthèse casse l'analyse du filtre PostgREST.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_,().*]/g, '');
}

export function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
