import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyTurnstile, turnstileFailureMessage } from '@/lib/turnstile';
import { issueOtp, normalizeEmail, purposeLabel, OTP_TTL_MINUTES } from '@/lib/otp';
import { sendMail, renderOtpEmail, isMailConfigured } from '@/lib/mailer';
import { logAuthEvent, isLockedOut, LOCKOUT_WINDOW_MINUTES } from '@/lib/authEvents';
import { setChallengeCookie } from '@/lib/authChallenge';
import { isDeviceTrusted } from '@/lib/trustedDevice';
import { issueSessionFor } from '@/lib/sessionIssuer';
import { roleHomePath } from '@/lib/roles';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().email('Adresse email invalide.').max(254),
  // Aucune contrainte de complexité ici : elle appartient à l'inscription.
  // L'imposer à la connexion empêche purement et simplement les comptes créés
  // sous une politique antérieure de se connecter.
  password: z.string().min(1, 'Mot de passe requis.').max(200),
  turnstileToken: z.string().min(1, 'Vérification anti-robot manquante.'),
  website: z.string().max(0).optional(),
});

/** Réponse identique quel que soit le motif, pour ne pas révéler l'existence d'un compte. */
const GENERIC_FAILURE = 'Email ou mot de passe incorrect.';

/**
 * Première étape de la connexion : vérification du mot de passe, puis envoi
 * d'un code à usage unique. Aucune session n'est ouverte ici.
 *
 * Le mot de passe est validé avec un client Supabase éphémère, sans persistance
 * ni cookie : on obtient la réponse « identifiants corrects » sans accorder
 * quoi que ce soit au navigateur. La session n'est créée qu'à l'étape
 * /api/auth/verify, après validation du code.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  const rate = await checkRateLimit(`login:${ip}`, 10, 5 * 60_000);
  if (!rate.allowed) {
    await logAuthEvent({ event: 'rate_limited', ipAddress: ip, userAgent });
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': '300' } }
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 }
    );
  }

  const { password, turnstileToken, website } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  if (website) {
    await logAuthEvent({ event: 'captcha_failed', email, ipAddress: ip, userAgent });
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  const captcha = await verifyTurnstile(turnstileToken, { remoteIp: ip, action: 'login' });
  if (!captcha.ok) {
    await logAuthEvent({ event: 'captcha_failed', email, ipAddress: ip, userAgent });
    return NextResponse.json({ error: turnstileFailureMessage(captcha) }, { status: 400 });
  }

  const lockout = await isLockedOut(email);
  if (lockout.locked) {
    await logAuthEvent({ event: 'locked_out', email, ipAddress: ip, userAgent });
    return NextResponse.json(
      {
        error: `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${LOCKOUT_WINDOW_MINUTES} minutes.`,
      },
      { status: 429, headers: { 'Retry-After': String(LOCKOUT_WINDOW_MINUTES * 60) } }
    );
  }

  // Client jetable : `persistSession: false` garantit qu'aucun jeton n'est
  // stocké ni renvoyé au navigateur à cette étape.
  const ephemeral = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInError } = await ephemeral.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signIn.user) {
    await logAuthEvent({ event: 'login_password_failed', email, ipAddress: ip, userAgent });

    const message = signInError?.message ?? '';
    if (/email not confirmed/i.test(message)) {
      // Compte créé mais jamais vérifié : on renvoie vers l'étape OTP
      // d'inscription plutôt que de laisser l'utilisateur dans une impasse.
      return NextResponse.json(
        {
          error: "Votre adresse email n'a pas encore été vérifiée.",
          next: 'verify',
          purpose: 'signup',
          email,
        },
        { status: 403 }
      );
    }
    if (/too many requests/i.test(message)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  // Le jeton obtenu ne doit pas survivre à cette requête.
  await ephemeral.auth.signOut({ scope: 'local' });

  const userId = signIn.user.id;
  await logAuthEvent({ event: 'login_password_ok', email, userId, ipAddress: ip, userAgent });

  const admin = getSupabaseAdmin();

  const { data: profil } = await admin
    .from('profils')
    .select('nom, role')
    .eq('id', userId)
    .maybeSingle();

  /*
   * Appareil déjà validé il y a moins de 30 jours : la session est ouverte
   * sans second facteur.
   *
   * L'OTP reste exigé sur tout appareil inconnu, et à l'inscription. C'est là
   * que se joue la protection : une attaque par bourrage d'identifiants part
   * par définition d'une machine que l'utilisateur n'a jamais utilisée, donc
   * dépourvue du cookie d'appareil.
   */
  if (await isDeviceTrusted({ userId, role: profil?.role })) {
    const session = await issueSessionFor(email);
    if (!session.ok) {
      return NextResponse.json({ error: session.error }, { status: 500 });
    }

    await logAuthEvent({ event: 'login_trusted_device', email, userId, ipAddress: ip, userAgent });

    const role = profil?.role ?? 'entreprise';
    return NextResponse.json({
      ok: true,
      next: 'done',
      role,
      redirectTo: roleHomePath(role),
    });
  }

  // Un utilisateur ayant activé une application d'authentification fournit son
  // second facteur depuis celle-ci : lui envoyer en plus un code par email
  // affaiblirait le dispositif (deux canaux valides au lieu d'un) et
  // multiplierait les envois.
  const { data: tfa } = await admin
    .from('two_factor_auth')
    .select('enabled, method')
    .eq('user_id', userId)
    .maybeSingle();

  const method: 'email' | 'totp' = tfa?.enabled && tfa.method === 'totp' ? 'totp' : 'email';

  if (method === 'email') {
    if (!isMailConfigured()) {
      console.error('[login] SMTP non configuré : code impossible à envoyer.');
      return NextResponse.json(
        { error: "Service d'email indisponible. Contactez le support." },
        { status: 503 }
      );
    }

    const issued = await issueOtp({ email, purpose: 'login', userId, ipAddress: ip });

    // Si `issued.ok` est faux, c'est le délai anti-renvoi : un code valide vient
    // d'être émis, inutile d'en produire un second — on poursuit vers l'étape
    // de saisie.
    if (issued.ok) {
      try {
        await sendMail({
          to: email,
          subject: `${issued.code} — votre code de connexion SecrétariatPro`,
          html: renderOtpEmail({
            code: issued.code,
            purposeLabel: purposeLabel('login'),
            expiresInMinutes: OTP_TTL_MINUTES,
            nom: profil?.nom ?? undefined,
          }),
        });
      } catch (mailError) {
        console.error('[login] envoi email :', mailError);
        return NextResponse.json(
          { error: "L'envoi du code a échoué. Réessayez dans un instant." },
          { status: 502 }
        );
      }
    }
  }

  await setChallengeCookie({ uid: userId, email, purpose: 'login', method });

  return NextResponse.json({
    ok: true,
    next: 'verify',
    purpose: 'login',
    method,
    email,
    expiresInMinutes: OTP_TTL_MINUTES,
  });
}
