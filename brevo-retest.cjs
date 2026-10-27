const fs = require('fs');
const kv = {};
for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) kv[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const nodemailer = require('nodemailer');
const out = [];
(async () => {
  try {
    const r = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': kv.BREVO_API_KEY, accept: 'application/json' } });
    const b = await r.json().catch(() => ({}));
    out.push('API /account: status=' + r.status + (r.ok ? ' email=' + (b.email || '?') : ' ' + JSON.stringify(b).slice(0, 300)));
  } catch (e) { out.push('API: EXC ' + e.message); }
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/senders', { headers: { 'api-key': kv.BREVO_API_KEY, accept: 'application/json' } });
    const b = await r.json().catch(() => ({}));
    out.push('API /senders: status=' + r.status + ' ' + JSON.stringify(b).slice(0, 500));
  } catch (e) { out.push('API senders: EXC ' + e.message); }
  try {
    const tr = nodemailer.createTransport({ host: kv.SMTP_HOST, port: 587, secure: false, auth: { user: kv.SMTP_USER, pass: kv.SMTP_PASS } });
    await tr.verify();
    out.push('SMTP verify: OK');
  } catch (e) { out.push('SMTP verify: ECHEC ' + e.message); }
  console.log(out.join('\n'));
})();
