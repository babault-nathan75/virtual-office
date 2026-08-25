import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { issueOtp, normalizeEmail, purposeLabel, OTP_TTL_MINUTES } from '@/lib/otp';
import { sendMail, renderOtpEmail, isMailConfigured } from '@/lib/mailer';
import { readChallengeCookie } from '@/lib/authChallenge';
import { verifyTurnstile, turnstileFailureMessage } from '@/lib/turnstile';

export const runtime = 'nodejs';

const bodySchema = z.object({
  purpose: z.enum(['signup', 'login']),
  email: z.string().email().max(254).optional(),
  turnstileToken: z.string().optional(),
});

/**
 * Renvoi d'un code à usage unique.
 *
 * Route sensible : c'est un moyen d'envoyer un email à une adresse arbitraire
 * aux frais du service. Elle est donc doublement bridée — quota par IP, et
 * délai anti-renvoi par (email, purpose) appliqué dans `issueOtp`.
 *
 * La réponse ne distingue jamais « adresse inconnue » de « code renvoyé » :
 * sinon la route devient un oracle permettant d'énumérer les comptes.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);

  const rate = await checkRateLimit(`auth-resend:${ip}`, 5, 15 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes de renvoi. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const { purpose, turnstileToken } = parsed.data;

  let email: string;
  let userId: string | null = null;

  if (purpose === 'login') {
    const challenge = await readChallengeCookie();
    if (!challenge) {
      return NextResponse.json(
        { error: 'Session de connexion expirée. Recommencez la connexion.', next: 'login' },
        { status: 440 }
      );
    }
    email = challenge.email;
    userId = challenge.uid;
  } else {
    if (!parsed.data.email) {
      return NextResponse.json({ error: 'Adresse email manquante.' }, { status: 400 });
    }
    email = normalizeEmail(parsed.data.email);

    // Sans cookie de défi, la route est ouverte : on exige alors un jeton
    // anti-robot pour qu'elle ne serve pas de relais d'envoi en masse.
    const captcha = await verifyTurnstile(turnstileToken, { remoteIp: ip });
    if (!captcha.ok) {
      return NextResponse.json({ error: turnstileFailureMessage(captcha) }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();
  const { data: profil } = await supabase
    .from('profils')
    .select('id, nom')
    .eq('email', email)
    .maybeSingle();

  if (!profil) {
    // Réponse volontairement identique au cas nominal.
    return NextResponse.json({ ok: true, cooldownSeconds: 45 });
  }
  userId = userId ?? profil.id;

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "Service d'email indisponible. Contactez le support." },
      { status: 503 }
    );
  }

  const issued = await issueOtp({ email, purpose, userId, ipAddress: ip });

  if (!issued.ok) {
    return NextResponse.json(
      {
        error: `Patientez encore ${issued.retryAfterSeconds} seconde${issued.retryAfterSeconds > 1 ? 's' : ''} avant un nouvel envoi.`,
        cooldownSeconds: issued.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  try {
    await sendMail({
      to: email,
      subject: `${issued.code} — votre code SecrétariatPro`,
      html: renderOtpEmail({
        code: issued.code,
        purposeLabel: purposeLabel(purpose),
        expiresInMinutes: OTP_TTL_MINUTES,
        nom: profil.nom ?? undefined,
      }),
    });
  } catch (mailError) {
    console.error('[auth/resend] envoi email :', mailError);
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, cooldownSeconds: 45 });
}
