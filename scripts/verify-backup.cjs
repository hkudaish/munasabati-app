// Proves a backup is usable: restores it into a TEMPORARY database on the LOCAL server, counts rows,
// then drops the temporary database. Refuses to run unless DATABASE_URL points at localhost.
//
//   node scripts/verify-backup.cjs [path-to.dump]     (default: newest dump in BACKUP_DIR)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local DB only');

const pgBin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const exe = name => path.join(pgBin, process.platform === 'win32' ? name + '.exe' : name);
const dir = process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups', 'munasabati');
const dump = process.argv[2] || fs.readdirSync(dir).filter(f => f.endsWith('.dump')).sort().map(f => path.join(dir, f)).pop();
if (!dump) throw Error('No .dump file found in ' + dir);

const scratch = 'restore_test_' + Date.now();
const env = { ...process.env, PGHOST: base.hostname, PGPORT: base.port || '5432', PGUSER: decodeURIComponent(base.username), PGPASSWORD: decodeURIComponent(base.password) };

const toc = spawnSync(exe('pg_restore'), ['--list', dump], { encoding: 'utf8' });
if (toc.status !== 0) { console.error('pg_restore --list failed: the file is not a readable dump'); process.exit(1); }
console.log('dump:', dump);
console.log('TOC: tables', (toc.stdout.match(/ TABLE public /g) || []).length, '| data sections', (toc.stdout.match(/ TABLE DATA public /g) || []).length);

const admin = new PrismaClient({ datasourceUrl: base.toString() });
(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${scratch}"`);
  try {
    // A fresh database already owns the public schema, so skip recreating it.
    const listFile = path.join(os.tmpdir(), scratch + '.list');
    fs.writeFileSync(listFile, toc.stdout.split(/\r?\n/).filter(l => !/; \d+ \d+ SCHEMA - public /.test(l)).join('\n'));
    const r = spawnSync(exe('pg_restore'), ['--no-owner', '--no-privileges', '--exit-on-error', '--use-list', listFile, '--dbname', scratch, dump], { env, encoding: 'utf8' });
    fs.rmSync(listFile, { force: true });
    console.log('pg_restore exit:', r.status, (r.stderr || '').split('\n').slice(0, 2).join(' | '));
    const u = new URL(base.toString()); u.pathname = '/' + scratch; u.searchParams.delete('schema');
    const db = new PrismaClient({ datasourceUrl: u.toString() });
    const tables = await db.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
    const counts = [];
    for (const { t } of tables) {
      if (!['User', 'Vendor', 'ServiceItem', 'Occasion', 'Guest', 'MultiVendorOrder', 'CommerceOrder', 'CommerceService', 'CommerceOffer'].includes(t)) continue;
      const c = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`);
      counts.push(`${t}=${c[0].n}`);
    }
    console.log('restored tables:', tables.length);
    console.log('row counts:', counts.join(', '));
    await db.$disconnect();
    if (r.status !== 0) process.exitCode = 1;
  } finally {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    console.log('temporary database dropped');
    await admin.$disconnect();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
