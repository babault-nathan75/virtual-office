/**
 * Validation des adresses d'abonnement Web Push.
 *
 * L'`endpoint` d'un abonnement est fourni par le navigateur… donc, en
 * pratique, par n'importe quel client qui appelle /api/push/subscribe. Le
 * serveur y envoie ensuite une requête POST (`web-push`) : sans contrôle,
 * c'est un SSRF — un compte pouvait enregistrer `http://169.254.169.254/…` ou
 * `http://localhost:5432` et faire frapper le réseau interne par le serveur à
 * chaque notification qui lui était adressée.
 *
 * Seuls les services push des navigateurs réels sont acceptés, en HTTPS, sur
 * le port par défaut.
 */
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge (Chromium), Opera, Samsung Internet
  'android.googleapis.com',
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari
] as const;

/** Sous-domaines autorisés (Windows Notification Service, Apple). */
const ALLOWED_PUSH_SUFFIXES = ['.notify.windows.com', '.push.apple.com'] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.port !== '') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if ((ALLOWED_PUSH_HOSTS as readonly string[]).includes(host)) return true;
  return ALLOWED_PUSH_SUFFIXES.some(suffix => host.endsWith(suffix));
}
