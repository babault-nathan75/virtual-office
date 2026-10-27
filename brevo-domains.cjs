const fs = require('fs');
const kv = {};
for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) kv[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  const h = { 'api-key': kv.BREVO_API_KEY, accept: 'application/json' };
  for (const path of ['/v3/senders/domains', '/v3/senders']) {
    try {
      const r = await fetch('https://api.brevo.com' + path, { headers: h });
      const t = await r.text();
      console.log('=== ' + path + ' status=' + r.status);
      console.log(t.slice(0, 3000));
    } catch (e) { console.log(path + ' EXC ' + e.message); }
  }
})();
