import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyTurnstile, turnstileFailureMessage } from '@/lib/turnstile';
import { issueOtp, normalizeEmail, purposeLabel, OTP_TTL_MINUTES } from '@/lib/otp';
import { sendMail, renderOtpEmail, isMailConfigured } from '@/lib/mailer';
import { logAuthEvent } from '@/lib/authEvents';
import { serverInscriptionSchema } from '@/lib/validations';
import { checkCompromisedPassword } from '@/lib/passwordCheck';

export const runtime = 'nodejs';

const bodySchema = serverInscriptionSchema.extend({
  turnstileToken: z.string().min(1, 'Vérification anti-robot manquante.'),
  /**
   * Champ leurre : invisible et non renseignable par un humain. Les robots
   * qui remplissent aveuglément tous les champs d'un formulaire se signalent
   * eux-mêmes, sans coût ni friction pour l'utilisateur.
   */
  website: z.string().max(0).optional(),
});

/**
 * Création de compte, entièrement côté serveur.
 *
 * L'inscription passait auparavant par `supabase.auth.signUp()` dans le
 * navigateur, puis une connexion automatique, puis une déconnexion. Trois
 * conséquences : aucune vérification anti-robot n'était possible avant la
 * création du compte, la politique de mot de passe n'était appliquée que dans
 * le navigateur (donc contournable en appelant Supabase directement), et une
 * session existait brièvement pour un compte non vérifié.
 *
 * Ici le compte est créé par la service role avec `email_confirm: false` : il
 * ne peut pas servir à se connecter tant que le code reçu par email n'a pas
 * été validé.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  const rate = await checkRateLimit(`register:${ip}`, 5, 10 * 60_000);
  if (!rate.allowed) {
    await logAuthEvent({ event: 'rate_limited', ipAddress: ip, userAgent });
    return NextResponse.json(
      { error: "Trop de tentatives d'inscription. Réessayez dans quelques minutes." },
      { status: 429, headers: { 'Retry-After': '600' } }
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

  const { nom, telephone, password, role, turnstileToken, website } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  if (website) {
    // Piège rempli : on répond comme un succès pour ne rien apprendre au robot,
    // sans rien créer.
    await logAuthEvent({ event: 'captcha_failed', email, ipAddress: ip, userAgent });
    return NextResponse.json({ ok: true, email, next: 'verify' });
  }

  const captcha = await verifyTurnstile(turnstileToken, { remoteIp: ip, action: 'signup' });
  if (!captcha.ok) {
    await logAuthEvent({ event: 'captcha_failed', email, ipAddress: ip, userAgent });
    return NextResponse.json({ error: turnstileFailureMessage(captcha) }, { status: 400 });
  }

  // Contrôle des mots de passe compromis côté serveur : côté client seul, il
  // suffisait d'appeler l'API Supabase directement pour l'ignorer.
  if (await checkCompromisedPassword(password)) {
    return NextResponse.json(
      {
        error:
          'Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.',
        field: 'password',
      },
      { status: 400 }
    );
  }

  if (!isMailConfigured()) {
    console.error('[register] SMTP non configuré : impossible d\'envoyer le code.');
    return NextResponse.json(
      { error: 'Service d\'email indisponible. Contactez le support.' },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: existingProfile } = await supabase
    .from('profils')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: 'Un compte existe déjà avec cette adresse email.', field: 'email' },
      { status: 409 }
    );
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { nom, role, telephone },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? '';
    if (/already/i.test(message) || /registered/i.test(message)) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cette adresse email.', field: 'email' },
        { status: 409 }
      );
    }
    console.error('[register] createUser :', message);
    return NextResponse.json({ error: 'Création du compte impossible.' }, { status: 500 });
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase.from('profils').insert({
    id: userId,
    email,
    nom,
    role,
    telephone,
  });

  if (profileError && profileError.code !== '23505') {
    // Le compte auth existe mais pas son profil : on annule pour ne pas
    // laisser un utilisateur à moitié créé, impossible à réinscrire.
    console.error('[register] profil :', profileError.message);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Création du profil impossible.' }, { status: 500 });
  }

  const issued = await issueOtp({ email, purpose: 'signup', userId, ipAddress: ip });
  if (!issued.ok) {
    return NextResponse.json(
      { error: `Un code vient déjà d'être envoyé. Patientez ${issued.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    await sendMail({
      to: email,
      subject: `${issued.code} — votre code de vérification SecrétariatPro`,
      html: renderOtpEmail({
        code: issued.code,
        purposeLabel: purposeLabel('signup'),
        expiresInMinutes: OTP_TTL_MINUTES,
        nom,
      }),
    });
  } catch (mailError) {
    console.error('[register] envoi email :', mailError);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "L'envoi du code a échoué. Vérifiez votre adresse email et réessayez." },
      { status: 502 }
    );
  }

  await logAuthEvent({ event: 'signup_started', email, userId, ipAddress: ip, userAgent });

  return NextResponse.json({ ok: true, email, next: 'verify' });
}
