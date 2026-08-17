'use client';

export type PushResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'not-configured' | 'denied' | 'error' };

/**
 * État courant de l'abonnement aux notifications push pour ce navigateur.
 * Permet à l'interface d'afficher le bon libellé sans provoquer de demande
 * de permission.
 */
export async function getPushState(): Promise<
  'unsupported' | 'not-configured' | 'denied' | 'subscribed' | 'available'
> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    return existing ? 'subscribed' : 'available';
  } catch {
    return 'available';
  }
}

/**
 * Abonne le navigateur aux notifications push.
 *
 * À n'appeler qu'en réponse à une action explicite de l'utilisateur : la
 * version précédente déclenchait `Notification.requestPermission()` au
 * chargement, ce que les navigateurs bloquent ou pénalisent, et échouait
 * ensuite en silence.
 */
export async function registerPush(userId: string): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, reason: 'not-configured' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    // `ready` attend que le service worker enregistré par PWAInit soit actif ;
    // un `register()` concurrent ici créerait une seconde inscription.
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));

    const json = subscription.toJSON();
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });

    if (!response.ok) return { ok: false, reason: 'error' };
    return { ok: true };
  } catch (error) {
    console.error('[push] Abonnement échoué :', error);
    return { ok: false, reason: 'error' };
  }
}

/** Désabonne ce navigateur (le bouton doit pouvoir être désactivé). */
export async function unregisterPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
