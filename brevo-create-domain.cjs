const fs = require('fs');
const kv = {};
for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) kv[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  const h = { 'api-key': kv.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' };
  const r = await fetch('https://api.brevo.com/v3/senders/domains', {
    method: 'POST', headers: h,
    body: JSON.stringify({ name: 'secretariatpro.com' }),
  });
  console.log('POST status=' + r.status);
  console.log((await r.text()).slice(0, 4000));
})();
