/**
 * Locale et formats du produit.
 *
 * Vingt appels écrivaient `'fr-FR'` en dur, tandis que les données structurées
 * déclaraient `addressCountry: 'FR'`. Or tout le reste du produit désigne la
 * Côte d'Ivoire : langues baoulé, dioula, bété et sénoufo dans les compétences,
 * logiciels Sage et Saari, indicatif +225 dans les formulaires, montants en
 * francs CFA. La contradiction n'était pas seulement cosmétique — un pays
 * erroné dans schema.org dessert le référencement local, celui qui compte pour
 * une mise en relation de proximité.
 *
 * Tout passe désormais par ces constantes : changer de marché se fait ici.
 */

/** Locale BCP-47 utilisée pour tous les formats affichés. */
export const LOCALE = 'fr-CI';

/** Code pays ISO 3166-1 alpha-2, pour schema.org et les métadonnées. */
export const COUNTRY_CODE = 'CI';

export const COUNTRY_NAME = "Côte d'Ivoire";

/** Locale au format OpenGraph (souligné, pas tiret). */
export const OG_LOCALE = 'fr_CI';

/** Devise ISO 4217 : franc CFA d'Afrique de l'Ouest. */
export const CURRENCY = 'XOF';

/**
 * Fuseau par défaut pour les dates rendues côté serveur.
 *
 * Sans lui, un email généré sur un serveur en UTC affiche une heure décalée
 * par rapport à celle que l'utilisateur a vue dans l'application.
 */
export const TIME_ZONE = 'Africa/Abidjan';

/**
 * Les formateurs `Intl` sont coûteux à construire et systématiquement
 * réutilisés : on les mémoïse plutôt que d'en créer un par rendu de ligne
 * dans les listes de messages et de missions.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions, withTimeZone: boolean): Intl.DateTimeFormat {
  const key = JSON.stringify([options, withTimeZone]);
  let instance = cache.get(key);
  if (!instance) {
    instance = new Intl.DateTimeFormat(LOCALE, {
      ...options,
      // Côté navigateur, on respecte le fuseau de l'appareil ; côté serveur,
      // on ancre sur celui du marché.
      ...(withTimeZone && typeof window === 'undefined' ? { timeZone: TIME_ZONE } : {}),
    });
    cache.set(key, instance);
  }
  return instance;
}

type DateInput = string | number | Date;

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date courte : 25/08/2026. */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatter({ day: '2-digit', month: '2-digit', year: 'numeric' }, true).format(date);
}

/** Date en toutes lettres : 25 août 2026. */
export function formatDateLong(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatter({ day: 'numeric', month: 'long', year: 'numeric' }, true).format(date);
}

/** Date abrégée : 25 août 2026 → 25 août 2026 (mois court). */
export function formatDateShort(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatter({ day: 'numeric', month: 'short', year: 'numeric' }, true).format(date);
}

/** Date et heure : 25/08/2026 14:32. */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatter(
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    true
  ).format(date);
}

/** Heure seule : 14:32. */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatter({ hour: '2-digit', minute: '2-digit' }, true).format(date);
}

/**
 * Montant en francs CFA : 25 000 F CFA.
 *
 * Le XOF n'a pas de subdivision en circulation : afficher des décimales
 * suggérerait une précision qui n'existe pas.
 */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Comparaison de chaînes insensible à la casse et aux accents. */
export function normalizeForSearch(value: string): string {
  return value
    .toLocaleLowerCase(LOCALE)
    .normalize('NFD')
    // Retire les diacritiques combinants isolés par la normalisation NFD :
    // « Séraphin » et « Seraphin » deviennent alors la même chaîne.
    .replace(/[\u0300-\u036f]/g, '');
}
