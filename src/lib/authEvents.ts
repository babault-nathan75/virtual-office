import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeEmail } from '@/lib/otp';

export type AuthEvent =
  | 'login_password_ok'
  | 'login_password_failed'
  | 'login_otp_ok'
  | 'login_otp_failed'
  | 'login_trusted_device'
  | 'device_revoked'
  | 'signup_started'
  | 'signup_verified'
  | 'captcha_failed'
  | 'rate_limited'
  | 'locked_out';

/** Nombre d'échecs consécutifs au-delà duquel l'adresse est verrouillée. */
export const LOCKOUT_THRESHOLD = 8;
/** Fenêtre d'observation et durée du verrouillage. */
export const LOCKOUT_WINDOW_MINUTES = 15;

/**
 * Journalise un évènement d'authentification.
 *
 * Volontairement « best effort » : une panne du journal ne doit jamais
 * empêcher une connexion légitime ni faire remonter une 500 à l'utilisateur.
 */
export async function logAuthEvent(params: {
  event: AuthEvent;
  email?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from('auth_events').insert({
      event: params.event,
      email: params.email ? normalizeEmail(params.email) : null,
      user_id: params.userId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent?.slice(0, 400) ?? null,
    });
  } catch {
    console.warn('[authEvents] écriture impossible :', params.event);
  }
}

/**
 * Verrouillage progressif par adresse email.
 *
 * La limite par IP seule ne suffit pas : un attaquant disposant d'un parc de
 * proxies la contourne trivialement, alors que la cible — un compte précis —
 * reste la même. On compte donc aussi les échecs par adresse.
 */
export async function isLockedOut(email: string): Promise<{ locked: boolean; failures: number }> {
  try {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await getSupabaseAdmin()
      .from('auth_events')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalizeEmail(email))
      .in('event', ['login_password_failed', 'login_otp_failed'])
      .gte('created_at', since);

    const failures = count ?? 0;
    return { locked: failures >= LOCKOUT_THRESHOLD, failures };
  } catch {
    // Journal indisponible : on ne verrouille pas (le rate limit par IP et
    // Turnstile restent en place), plutôt que de bloquer tout le monde.
    return { locked: false, failures: 0 };
  }
}
