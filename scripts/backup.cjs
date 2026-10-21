#!/usr/bin/env node
// Incremental backup and restore. Run `node scripts/backup.cjs help` for the commands.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { randomBytes } = require('node:crypto');
const engine = require('./lib/backup-engine.cjs');

const args = process.argv.slice(2);
const command = args[0] || 'help';
const flag = name => { const i = args.indexOf('--' + name); return i > 0 ? args[i + 1] : undefined; };
const has = name => args.includes('--' + name);
const target = flag('target') || 'local';
const schema = flag('schema') || 'public';
const root = flag('dir') || engine.defaultRoot();
const dir = path.join(root, target === 'local' && flag('url') ? 'custom' : target);
const storage = new engine.FileStorage(dir);
const logFile = path.join(root, 'backup.log');

function loadEnv() {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
function netlifyToken() {
  const base = process.platform === 'win32' ? path.join(process.env.APPDATA, 'netlify', 'Config') : path.join(os.homedir(), '.config', 'netlify');
  const config = JSON.parse(fs.readFileSync(path.join(base, 'config.json')));
  const user = config.users[config.userId];
  return user.auth?.token || user.token;
}
const isLocalHost = url => ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

/** Resolves which database to use; production comes from the Netlify login on this machine, never from a file. */
async function connectionUrl() {
  if (flag('url')) {
    if (!isLocalHost(flag('url')) && !has('allow-remote')) throw new Error('--url must point at localhost (or add --allow-remote).');
    return flag('url');
  }
  if (target === 'local') {
    if (!isLocalHost(process.env.DATABASE_URL)) throw new Error('DATABASE_URL in .env is not a local database; use --target production explicitly.');
    return process.env.DATABASE_URL;
  }
  if (target !== 'production') throw new Error('--target must be local or production.');
  const siteId = JSON.parse(fs.readFileSync('.netlify/state.json')).siteId;
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/database`, { headers: { Authorization: `Bearer ${netlifyToken()}` } });
  if (!res.ok) throw new Error('Cannot read the production database connection: HTTP ' + res.status);
  const url = (await res.json()).connection_string;
  if (isLocalHost(url)) throw new Error('Refusing: not a production host.');
  return url;
}
function record(entry) {
  try { fs.mkdirSync(root, { recursive: true }); fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), target, ...entry }) + '\n'); } catch { /* logging must never break a backup */ }
}
// BACKUP_TRACE=1 appends each stage to backup.log: use it to see where a scheduled run stops.
const trace = step => { if (process.env.BACKUP_TRACE) record({ trace: step }); };
const mb = n => (n / 1024).toFixed(1) + ' KB';
const ask = question => new Promise(resolve => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(question, a => { rl.close(); resolve(a); }); });

/** Runs `fn(prisma)` with a database client that is always closed afterwards. */
async function withDb(url, fn) {
  const prisma = engine.openDb(url);
  try { return await fn(prisma); } finally { await prisma.$disconnect(); }
}

async function main() {
  loadEnv(); // BACKUP_ENCRYPTION_KEY and DATABASE_URL come from .env for every command
  trace('start ' + command);
  if (command === 'keygen') {
    console.log('Add this line to your .env (and keep a copy somewhere safe; without it encrypted backups cannot be read):\n');
    console.log('BACKUP_ENCRYPTION_KEY=' + randomBytes(32).toString('base64'));
    return;
  }
  if (command === 'help') {
    console.log(`Incremental database backups (row-level changes, restorable to any backup point)

  node scripts/backup.cjs full        [--target local|production]   complete snapshot (start of a chain)
  node scripts/backup.cjs incremental [--target ...]                only what changed since the last backup
  node scripts/backup.cjs auto        [--target ...]                what a scheduler runs: picks full or incremental,
                                                                    verifies, prunes old chains; exits non-zero on failure
  node scripts/backup.cjs list        [--target ...]                backups and what each contains
  node scripts/backup.cjs verify      [--target ...] [--id ID]      checksums + chain links
  node scripts/backup.cjs restore     --to-url postgres://localhost/...  [--id ID] [--replace]
                                                                    restore into a LOCAL database (see docs/BACKUP.md)
  node scripts/backup.cjs prune       [--keep 4]                    delete whole old chains
  node scripts/backup.cjs keygen                                    new encryption key

Backups go to ${engine.defaultRoot()} (override with BACKUP_DIR or --dir). Set BACKUP_ENCRYPTION_KEY to encrypt them.
The admin page (System administration > Backups) manages the cloud copies kept on Netlify.`);
    return;
  }

  if (command === 'full' || command === 'incremental') {
    const url = await connectionUrl();
    const { manifest, changed } = await withDb(url, prisma => engine.createBackup({ prisma, schema, storage, type: command, force: has('force'), label: flag('label') || '' }));
    record({ command, id: manifest.id, ok: true, changed });
    console.log(`${command} backup ${manifest.id}: ${manifest.stats.tables} tables, ${manifest.stats.rows} rows, ${manifest.stats.upserts} added/changed, ${manifest.stats.deletes} deleted (${mb(manifest.files.data.bytes)}${manifest.encrypted ? ', encrypted' : ', NOT encrypted'})`);
    if (!manifest.encrypted) console.log('Warning: backups contain customer data and password hashes. Run `node scripts/backup.cjs keygen` and set BACKUP_ENCRYPTION_KEY.');
    return;
  }

  if (command === 'auto') {
    const url = await connectionUrl();
    trace('url-resolved');
    const policy = { ...engine.DEFAULT_POLICY, fullEveryDays: Number(flag('full-every-days') || engine.DEFAULT_POLICY.fullEveryDays), keepChains: Number(flag('keep') || engine.DEFAULT_POLICY.keepChains) };
    const decision = engine.nextAutoType(await engine.readManifests(storage), policy);
    const result = await withDb(url, async prisma => {
      try { return await engine.createBackup({ prisma, schema, storage, type: decision.type, label: 'auto', onStep: trace }); }
      catch (e) {
        // a structure change or a key change cannot continue the chain: begin a new one instead of failing silently
        if (decision.type === 'incremental' && /structure changed|Encryption setting/.test(e.message)) return engine.createBackup({ prisma, schema, storage, type: 'full', label: 'auto (new chain: ' + e.message.split('.')[0] + ')', onStep: trace });
        throw e;
      }
    });
    const check = await engine.verifyChain(storage, result.manifest.id);
    if (!check.ok) throw new Error('Backup written but verification failed:\n  ' + check.problems.join('\n  '));
    const removed = await engine.prune(storage, policy.keepChains);
    record({ command, id: result.manifest.id, type: result.manifest.type, why: decision.why, changed: result.changed, removed: removed.length, ok: true });
    console.log(`auto: ${result.manifest.type} backup ${result.manifest.id} (${decision.why}); ${result.changed} change(s); verified; ${removed.length} old file set(s) pruned`);
    return;
  }

  if (command === 'list') {
    const all = await engine.readManifests(storage);
    if (!all.length) { console.log('No backups in ' + dir); return; }
    console.log(dir);
    for (const m of all) console.log(`  ${m.id}  ${m.type.padEnd(11)} ${m.createdAt}  rows ${String(m.stats.rows).padStart(6)}  +${m.stats.upserts} -${m.stats.deletes}  ${mb(m.files.data.bytes).padStart(9)}  ${m.encrypted ? 'encrypted' : 'plain'}${m.label ? '  [' + m.label + ']' : ''}`);
    return;
  }

  if (command === 'verify') {
    const all = await engine.readManifests(storage);
    if (!all.length) throw new Error('No backups in ' + dir);
    const id = flag('id') || all[all.length - 1].id;
    const check = await engine.verifyChain(storage, id);
    if (!check.ok) { console.error('VERIFY FAILED for ' + id + ':\n  ' + check.problems.join('\n  ')); process.exitCode = 1; return; }
    console.log(`OK: ${id} and its ${check.chain.length - 1} parent(s) are intact (checksums, chain links, readable).`);
    return;
  }

  if (command === 'restore') {
    const toUrl = flag('to-url');
    if (!toUrl) throw new Error('Give the database to restore INTO with --to-url. Production restores are intentionally not available from this tool.');
    if (!isLocalHost(toUrl)) throw new Error('Restores here are limited to local databases. The live site is restored from the admin page (System administration > Backups), which previews the change and needs a second administrator.');
    if (!has('yes')) {
      const answer = await ask(`This restores backups from ${dir} into ${new URL(toUrl).pathname.slice(1)} on ${new URL(toUrl).hostname}${has('replace') ? ' and REPLACES its data' : ''}. Type RESTORE to continue: `);
      if (answer.trim() !== 'RESTORE') throw new Error('Not confirmed. Nothing was changed.');
    }
    const result = await withDb(toUrl, prisma => engine.restoreBackup({ prisma, storage, schema, headId: flag('id'), replace: has('replace'), safetyStorage: new engine.FileStorage(path.join(root, 'pre-restore')), log: m => console.log('  ' + m) }));
    record({ command, id: result.head.id, to: new URL(toUrl).pathname.slice(1), ok: result.verified });
    console.log(`Restored ${result.tables} tables / ${result.rows} rows from ${result.head.id}.`);
    if (result.verified) console.log('VERIFIED: every restored row matches the backup.');
    else { console.error('MISMATCHES:\n  ' + result.mismatches.join('\n  ')); process.exitCode = 1; }
    return;
  }

  if (command === 'prune') {
    const removed = await engine.prune(storage, Number(flag('keep') || engine.DEFAULT_POLICY.keepChains));
    console.log(removed.length ? 'Removed: ' + removed.join(', ') : 'Nothing to remove.');
    return;
  }
  throw new Error('Unknown command "' + command + '". Run: node scripts/backup.cjs help');
}

main().catch(e => { record({ command, ok: false, error: String(e.message).slice(0, 500) }); console.error('Backup error: ' + String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[redacted-url]')); process.exitCode = 1; });
