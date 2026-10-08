/**
 * Tests de la chaîne d'envoi d'email (`sendMail`).
 *
 * Le repli de voie est le cœur du contrat : une défaillance de l'API Brevo
 * doit être rattrapée par le relais SMTP sans perdre la cause première, et
 * l'absence totale de fournisseur doit rester explicite. Chaque cas ci-dessous
 * verrouille une de ces garanties.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMailMock = vi.fn().mockResolvedValue({});

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

function jsonResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

async function importMailer() {
  // Le module est mis en cache par Vitest : le transport et les variables
  // d'environnement sont relus à chaque envoi, l'état reste donc isolé
  // grâce à `beforeEach`.
  return import('@/lib/mailer');
}

beforeEach(() => {
  vi.restoreAllMocks();
  sendMailMock.mockReset().mockResolvedValue({});
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv('MAIL_FROM', 'SecrétariatPro <no-reply@secretariatpro.com>');
  vi.stubEnv('SMTP_HOST', 'smtp-relay.brevo.com');
  vi.stubEnv('SMTP_PORT', '587');
  vi.stubEnv('SMTP_USER', 'b315a6001@smtp-brevo.com');
  vi.stubEnv('SMTP_PASS', 'cle-smtp');
  vi.stubEnv('BREVO_API_KEY', 'cle-api-brevo');
  vi.stubEnv('RESEND_API_KEY', undefined);
});

describe('sendMail', () => {
  it('envoie via l’API Brevo et ne sollicite pas le relais SMTP en cas de succès', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, '{}'));
    vi.stubGlobal('fetch', fetchMock);

    const { sendMail } = await importMailer();
    await sendMail({ to: 'dest@example.com', subject: 'Bonjour', html: '<p>Bonjour</p>' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ method: 'POST' })
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('replie vers le relais SMTP quand Brevo refuse avec 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(401, '{"message":"unauthorised ip","code":"unauthorized"}')
    ));

    const { sendMail } = await importMailer();
    await sendMail({ to: 'dest@example.com', subject: 'Code', html: '<p>123456</p>' });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({
      to: 'dest@example.com',
      from: '"SecrétariatPro" <no-reply@secretariatpro.com>',
    });
  });

  it('joint les causes API et SMTP quand toutes les voies échouent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(401, '{"message":"unauthorised ip"}')
    ));
    sendMailMock.mockRejectedValue(new Error('535 authentification refusée'));

    const { sendMail } = await importMailer();
    const attempt = sendMail({ to: 'dest@example.com', subject: 'Code', html: '<p>123456</p>' });

    await expect(attempt).rejects.toThrow(/Brevo a refusé l'envoi \(401\)/);
    await expect(attempt).rejects.toThrow(/535 authentification refusée/);
  });

  it('remonte une erreur claire quand aucun fournisseur n’est configuré', async () => {
    vi.stubEnv('BREVO_API_KEY', undefined);
    vi.stubEnv('SMTP_USER', undefined);
    vi.stubEnv('SMTP_PASS', undefined);

    const { sendMail, isMailConfigured } = await importMailer();
    expect(isMailConfigured()).toBe(false);
    await expect(
      sendMail({ to: 'dest@example.com', subject: 'Sujet', html: '<p>p</p>' })
    ).rejects.toThrow(/Aucun fournisseur d'email configuré/);
  });
});
