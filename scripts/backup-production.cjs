// Read-only production backup (pg_dump custom format) written OUTSIDE the repository.
// The connection string is fetched at run time through the Netlify login stored on this machine;
// it is never printed or saved, and the password is scrubbed from error output.
//
//   node scripts/backup-production.cjs
//
// Optional: PG_BIN (folder containing pg_dump), BACKUP_DIR (default ~/Backups/munasabati).
// Afterwards run `node scripts/verify-backup.cjs` to prove the dump restores.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pgBin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const exe = name => path.join(pgBin, process.platform === 'win32' ? name + '.exe' : name);
const outDir = process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups', 'munasabati');

function netlifyToken() {
  const dir = process.platform === 'win32' ? path.join(process.env.APPDATA, 'netlify', 'Config') : path.join(os.homedir(), '.config', 'netlify');
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json')));
  const user = config.users[config.userId];
  return user.auth?.token || user.token;
}

(async () => {
  const siteId = JSON.parse(fs.readFileSync('.netlify/state.json')).siteId;
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/database`, { headers: { Authorization: `Bearer ${netlifyToken()}` } });
  if (!response.ok) throw Error('Cannot read the production database connection: HTTP ' + response.status);
  const url = new URL((await response.json()).connection_string);
  if (['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Refusing: not a production host');
  const password = decodeURIComponent(url.password);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); // UTC yyyymmddhhmm
  const file = path.join(outDir, `munasabati-prod-${stamp}.dump`);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: password, PGSSLMODE: 'require' };
  const r = spawnSync(exe('pg_dump'), ['--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', file], { env, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stderr || '').replaceAll(password, '[redacted]')); process.exit(1); }
  console.log('written:', file, '|', fs.statSync(file).size, 'bytes (UTC timestamp in the name)');
  console.log('This file contains customer data: keep it private and outside the repository.');
})().catch(e => { console.error(String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[redacted-url]')); process.exit(1); });
