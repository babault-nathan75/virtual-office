// Edge Function : envoie un email via Resend
// Déclenchée par le trigger Postgres `on_notification_insert` via pg_net.http_post
//
// Variables d'environnement à définir dans Supabase → Edge Functions → Manage Secrets :
//   - RESEND_API_KEY      (commence par re_...)
//   - EMAIL_FROM          (ex: "SecrétariatPro <onboarding@resend.dev>")
//   - SITE_URL            (ex: "https://secretariatpro.ci" — pour les liens dans l'email)
//
// Pour autoriser les appels sans JWT (le trigger n'a pas de JWT utilisateur), créer
// le fichier supabase/functions/send-notification-email/.supabase/config.toml avec :
//   [functions.send-notification-email]
//   verify_jwt = false
//
// Ou, plus simplement, désactiver "Enforce JWT" depuis l'UI Supabase Dashboard.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM     = Deno.env.get("EMAIL_FROM")     ?? "SecrétariatPro <onboarding@resend.dev>";
const SITE_URL       = Deno.env.get("SITE_URL")       ?? "http://localhost:3000";

interface Payload {
  to: string;
  nom?: string;
  titre: string;
  message?: string | null;
  lien?: string | null;
  type?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(p: Payload): string {
  const titre   = escapeHtml(p.titre);
  const message = p.message ? escapeHtml(p.message) : "";
  const greet   = p.nom ? `Bonjour ${escapeHtml(p.nom)},` : "Bonjour,";
  const cta     = p.lien
    ? `<div style="margin:32px 0;text-align:center"><a href="${SITE_URL}${escapeHtml(p.lien)}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:9999px;font-family:-apple-system,sans-serif">Voir sur le site →</a></div>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:linear-gradient(135deg,#0f172a,#1e40af);padding:24px;text-align:center;color:#fff">
          <h1 style="margin:0;font-size:18px;letter-spacing:-0.02em">SecrétariatPro</h1>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <p style="margin:0 0 16px;font-size:15px">${greet}</p>
          <h2 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.02em">${titre}</h2>
          ${message ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#334155">${message}</p>` : ""}
          ${cta}
          <p style="margin:24px 0 0;font-size:13px;color:#64748b">Vous recevez ce message car vous êtes inscrit·e sur SecrétariatPro.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
          © ${new Date().getFullYear()} SecrétariatPro — Abidjan, Côte d'Ivoire
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload.to || !payload.titre) {
    return new Response(JSON.stringify({ error: "Missing fields: to, titre" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Envoi via Resend
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [payload.to],
        subject: payload.titre,
        html: buildHtml(payload),
      }),
    });

    const data = await resendRes.json();
    return new Response(JSON.stringify(data), {
      status: resendRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
