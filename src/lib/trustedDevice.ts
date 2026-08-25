import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getAuthSecret } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const DEVICE_COOKIE = 'sp_device';

/** Durée de confiance accordée à un appareil après validation d'un code. */
export const TRUST_DURATION_DAYS = 30;

/**
 * Le cookie survit bien au-delà de la confiance elle-même : il identifie
 * l'appareil, pas l'autorisation. 400 jours est le plafond appliqué par les
 * navigateurs aux cookies posés côté serveur.
 */
const DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Appareils de confiance.
 *
 * Le second facteur n'est plus demandé à chaque connexion mais une fois par
 * appareil et par période de 30 jours. Le compromis est explicite : l'OTP
 * continue de se déclencher sur tout appareil inconnu — c'est-à-dire
 * exactement là où atterrit une attaque par bourrage d'identifiants, qui part
 * par définition d'une machine que l'utilisateur n'a jamais utilisée.
 *
 * En contrepartie, un utilisateur régulier reçoit un code par mois au lieu
 * d'un par jour. Sur un parc de 200 utilisateurs actifs quotidiens, le volume
 * d'envois passe d'environ 6 000 à 600 par mois : la friction baisse et le
 * plafond d'envoi du fournisseur d'email cesse d'être un facteur limitant.
 *
 * --- Pourquoi un cookie plutôt qu'une empreinte de navigateur ---
 *
 * Une empreinte fondée sur l'IP re-demanderait un code en permanence : sur
 * réseau mobile, l'adresse change à chaque déplacement. Une empreinte fondée
 * sur l'agent utilisateur et les polices installées est à la fois fragile
 * (elle casse à chaque mise à jour du navigateur) et intrusive. Un cookie
 * opaque *est* l'appareil, et l'utilisateur peut l'effacer.
 */

/**
 * Identifiant d'appareil stocké côté navigateur.
 *
 * Valeur aléatoire opaque : elle ne dit rien de l'utilisateur et n'est jamais
 * enregistrée telle quelle en base.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{32,}$/.test(existing)) return existing;

  const generated = crypto.randomBytes(32).toString('base64url');
  store.set(DEVICE_COOKIE, generated, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
  return generated;
}

/** Lit l'identifiant d'appareil sans en créer un. */
export async function readDeviceId(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value ?? null;
}

/**
 * Empreinte stockée en base.
 *
 * Poivrée avec le secret applicatif et liée à l'utilisateur : une même
 * machine partagée par deux comptes produit deux empreintes distinctes. Sans
 * ce liage, un appareil de confiance pour Alice dispenserait Bob du second
 * facteur sur le même navigateur.
 *
 * Une fuite de la table ne livre pas non plus de valeur de cookie utilisable.
 */
function hashDevice(deviceId: string, userId: string): string {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(`device:${userId}:${deviceId}`)
    .digest('hex');
}

/**
 * Étiquette lisible pour la page de sécurité.
 *
 * Volontairement grossière : « Chrome sur Android » suffit à reconnaître son
 * propre appareil. Stocker l'agent utilisateur complet reviendrait à
 * constituer un historique de navigation sans utilité pour l'utilisateur.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Appareil inconnu';

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\/|Opera/.test(userAgent) ? 'Opera'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Navigateur';

  const platform =
    /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'appareil inconnu';

  return `${browser} sur ${platform}`;
}

/**
 * L'appareil courant est-il encore dans sa période de confiance ?
 *
 * Les administrateurs en sont exclus : le panneau d'administration donne accès
 * aux données de tous les utilisateurs, et sa population est trop réduite pour
 * que la friction d'un second facteur systématique compte.
 */
export async function isDeviceTrusted(params: {
  userId: string;
  role: string | null | undefined;
}): Promise<boolean> {
  if (params.role === 'admin') return false;

  const deviceId = await readDeviceId();
  if (!deviceId) return false;

  try {
    const { data } = await getSupabaseAdmin()
      .from('trusted_devices')
      .select('id, expires_at')
      .eq('user_id', params.userId)
      .eq('device_hash', hashDevice(deviceId, params.userId))
      .maybeSingle();

    if (!data) return false;
    if (new Date(data.expires_at).getTime() <= Date.now()) return false;

    // `last_used_at` sert uniquement à l'affichage : la confiance n'est PAS
    // prolongée à l'usage. Une expiration glissante ne serait jamais atteinte
    // par un utilisateur quotidien, et le second facteur ne reviendrait
    // jamais — ce n'est pas ce qui a été demandé.
    await getSupabaseAdmin()
      .from('trusted_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return true;
  } catch (error) {
    // Base indisponible : on retombe sur le second facteur. Un incident
    // technique ne doit jamais faire sauter une étape d'authentification.
    console.warn('[trustedDevice] lecture impossible :', error);
    return false;
  }
}

/**
 * Accorde la confiance à l'appareil courant, pour 30 jours à compter de
 * maintenant. Appelée après validation réussie d'un second facteur.
 */
export async function trustCurrentDevice(params: {
  userId: string;
  userAgent: string | null;
}): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const expiresAt = new Date(Date.now() + TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await getSupabaseAdmin().from('trusted_devices').upsert(
      {
        user_id: params.userId,
        device_hash: hashDevice(deviceId, params.userId),
        label: describeDevice(params.userAgent),
        last_used_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'user_id,device_hash' }
    );
  } catch (error) {
    // Échec sans conséquence pour l'utilisateur : sa session est ouverte, il
    // recevra simplement un code à la prochaine connexion.
    console.warn('[trustedDevice] enregistrement impossible :', error);
  }
}

/** Retire la confiance de tous les appareils d'un utilisateur. */
export async function revokeAllDevices(userId: string): Promise<void> {
  await getSupabaseAdmin().from('trusted_devices').delete().eq('user_id', userId);
}
