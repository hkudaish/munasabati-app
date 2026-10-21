// End-to-end test of the admin backup API: a throwaway schema in the LOCAL database, a separate Next server, a
// temporary backup folder. Nothing outside them is touched.  npm run test:backup-admin
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'backup_admin_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const store = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-admin-'));
const dist = '.next-backup-test-' + process.pid;
const tsconfig = '.backup-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const cronToken = randomBytes(24).toString('hex');
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3109', BACKUP_STORAGE_DIR: store, BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64'), BACKUP_CRON_TOKEN: cronToken, NODE_ENV: 'development' };
delete env.NETLIFY; delete env.NETLIFY_BLOBS_CONTEXT;
const BASE = 'http://127.0.0.1:3109';
const prisma = new PrismaClient({ datasourceUrl: url.toString() });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, logs = '';
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };

async function call(route, method = 'GET', data, cookie, headers = {}) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
  let body = {}; try { body = await r.json(); } catch { /* empty */ }
  return { status: r.status, body, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
const hash = pw => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString('hex')}`; };
const password = randomBytes(18).toString('hex');
async function loginAs(email) { const r = await call('/api/auth/login', 'POST', { identifier: email, password }); assert.equal(r.status, 200, 'login ' + email + ' ' + JSON.stringify(r.body)); return r.cookie; }
const act = (cookie, data) => call('/api/system-admin/backups', 'POST', data, cookie);

(async () => {
  try {
    const push = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(push.status, 0, push.stdout + push.stderr);
    await require('./seed-geography.cjs').seedGeography(prisma);
    const mk = (name, email, phone, role) => prisma.user.create({ data: { name, email, phone, role, passwordHash: hash(password) } });
    const superA = await mk('مشرف عام', 'super@bk.test', '0500000001', 'SUPER_ADMIN');
    const adminB = await mk('مسؤول آخر', 'admin@bk.test', '0500000002', 'ADMIN');
    const client = await mk('عميل', 'client@bk.test', '0500000003', 'CLIENT');
    const victim = await mk('مستخدم سيحذف', 'victim@bk.test', '0500000004', 'CLIENT');

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3109'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(r => setTimeout(r, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ---- who may do what ----
    assert.equal((await call('/api/system-admin/backups')).status, 401);
    const cClient = await loginAs('client@bk.test'), cSuper = await loginAs('super@bk.test'), cAdmin = await loginAs('admin@bk.test');
    assert.equal((await call('/api/system-admin/backups', 'GET', undefined, cClient)).status, 403);
    assert.equal((await call('/api/system-admin/backups', 'GET', undefined, cAdmin)).status, 200);
    assert.equal((await act(cAdmin, { action: 'run', type: 'auto' })).status, 403);
    assert.equal((await act(cAdmin, { action: 'verify', id: 'x' })).status, 403);
    assert.equal((await act(cClient, { action: 'run' })).status, 403);
    ok('only administrators can open the page; only the super administrator can run, verify or preview');

    // ---- running backups, by hand and by the scheduler ----
    const first = await act(cSuper, { action: 'run', type: 'auto' });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.result.type, 'full');
    assert.equal((await call('/api/internal/backup-cron', 'POST')).status, 401);
    assert.equal((await call('/api/internal/backup-cron', 'POST', undefined, undefined, { 'x-backup-token': 'wrong' + cronToken })).status, 401);
    const cron = await call('/api/internal/backup-cron', 'POST', undefined, undefined, { 'x-backup-token': cronToken });
    assert.equal(cron.status, 200, JSON.stringify(cron.body));
    assert.equal(cron.body.result.type, 'incremental');
    assert.equal(cron.body.result.changed, 1, 'only the audit-log row written by the previous run'); // each run records itself in the audit log
    ok('manual backup is full, the scheduler hook needs its secret and then adds an incremental holding only the audit row of the previous run', first.body.result.rows + ' rows');
    const list = (await call('/api/system-admin/backups', 'GET', undefined, cSuper)).body;
    assert.equal(list.backups.length, 2); assert.equal(list.health, 'ok'); assert(list.config.encrypted); assert.equal(list.config.storage, 'local');
    assert(list.history.some(h => h.action === 'BACKUP_RUN' && h.by === 'الجدولة التلقائية'));
    const fullId = list.backups.find(b => b.type === 'full').id;
    assert.equal((await act(cSuper, { action: 'verify', id: fullId })).body.result.ok, true);
    ok('list shows both backups as healthy and encrypted; verify passes; the scheduler is named in the history');

    // ---- the data changes after the backup ----
    await prisma.user.delete({ where: { id: victim.id } });
    await prisma.user.update({ where: { id: client.id }, data: { name: 'اسم تغيّر' } });
    const preview = await act(cSuper, { action: 'preview', id: fullId });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.preview.totals.toAdd, 1); assert.equal(preview.body.preview.totals.toChange, 1); assert.equal(preview.body.preview.totals.toRemove, 0);
    assert.equal(await prisma.user.count({ where: { id: victim.id } }), 0, 'a preview must not restore anything');
    ok('preview says one deleted user would come back and one renamed user would revert, and changes nothing');

    // ---- two-person restore ----
    assert.equal((await act(cSuper, { action: 'request-restore', id: fullId, confirm: 'restore' })).status, 400);
    const req = await act(cSuper, { action: 'request-restore', id: fullId, confirm: 'RESTORE' });
    assert.equal(req.status, 200, JSON.stringify(req.body)); assert.equal(req.body.request.status, 'PENDING');
    assert.equal((await act(cSuper, { action: 'request-restore', id: fullId, confirm: 'RESTORE' })).status, 409, 'one pending request at a time');
    const rid = req.body.request.id;
    assert.equal((await act(cSuper, { action: 'approve-restore', id: rid, confirm: 'RESTORE' })).status, 403, 'nobody approves their own request');
    assert.equal((await act(cClient, { action: 'approve-restore', id: rid, confirm: 'RESTORE' })).status, 403);
    assert.equal((await act(cAdmin, { action: 'approve-restore', id: rid, confirm: 'nope' })).status, 400);
    assert.equal(await prisma.user.count({ where: { id: victim.id } }), 0, 'nothing restored yet');
    ok('a restore needs typed confirmation, cannot be approved by the requester or a customer, and changes nothing until approved');

    const approved = await act(cAdmin, { action: 'approve-restore', id: rid, confirm: 'RESTORE' });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.request.status, 'DONE'); assert.equal(approved.body.request.result.verified, true);
    assert(approved.body.request.result.safetyBackupId, 'a safety backup was taken');
    assert.equal(await prisma.user.count({ where: { id: victim.id } }), 1, 'the deleted user is back');
    assert.equal((await prisma.user.findUnique({ where: { id: client.id } })).name, 'عميل', 'the renamed user reverted');
    ok('the second administrator approves: a safety backup is taken, data is restored and every row verified', approved.body.request.result.rows + ' rows');

    // ---- sessions are revoked, audit trail complete ----
    assert.equal((await call('/api/system-admin/backups', 'GET', undefined, cSuper)).status, 401, 'old sessions are revoked');
    assert.equal((await call('/api/system-admin/backups', 'GET', undefined, cAdmin)).status, 401);
    const cSuper2 = await loginAs('super@bk.test');
    const actions = (await prisma.systemAuditLog.findMany({ where: { action: { startsWith: 'BACKUP_' } } })).map(a => a.action);
    for (const a of ['BACKUP_RUN', 'BACKUP_VERIFY', 'BACKUP_PREVIEW', 'BACKUP_RESTORE_REQUESTED', 'BACKUP_RESTORE_APPROVED', 'BACKUP_RESTORE_DONE']) assert(actions.includes(a), 'missing audit entry ' + a);
    ok('everyone is signed out after a restore and every step is in the audit log');

    // ---- cancel, expiry ----
    const list2 = (await call('/api/system-admin/backups', 'GET', undefined, cSuper2)).body;
    assert.equal(list2.requests[0].status, 'DONE');
    const req2 = await act(cSuper2, { action: 'request-restore', id: fullId, confirm: 'RESTORE' });
    assert.equal(req2.status, 200, JSON.stringify(req2.body));
    const cancelled = await act(cSuper2, { action: 'cancel-restore', id: req2.body.request.id });
    assert.equal(cancelled.body.request.status, 'CANCELLED');
    assert.equal((await act(await loginAs('admin@bk.test'), { action: 'approve-restore', id: req2.body.request.id, confirm: 'RESTORE' })).status, 409);
    const req3 = await act(cSuper2, { action: 'request-restore', id: fullId, confirm: 'RESTORE' });
    const file = path.join(store, 'restore-requests', req3.body.request.id + '.json');
    const record = JSON.parse(fs.readFileSync(file, 'utf8')); record.expiresAt = new Date(Date.now() - 1000).toISOString(); fs.writeFileSync(file, JSON.stringify(record));
    const late = await act(await loginAs('admin@bk.test'), { action: 'approve-restore', id: req3.body.request.id, confirm: 'RESTORE' });
    assert.equal(late.status, 409); assert(/صلاحية/.test(late.body.error));
    ok('cancelled and expired requests cannot be approved');

    // ---- a damaged backup is caught ----
    const dataFile = fs.readdirSync(store).find(f => f.startsWith(fullId) && f.includes('.data.'));
    const bytes = fs.readFileSync(path.join(store, dataFile)); const bad = Buffer.from(bytes); bad[bad.length - 20] ^= 0xff; fs.writeFileSync(path.join(store, dataFile), bad);
    const cSuper3 = await loginAs('super@bk.test');
    assert.equal((await act(cSuper3, { action: 'verify', id: fullId })).body.result.ok, false);
    assert.equal((await act(cSuper3, { action: 'preview', id: fullId })).status, 409);
    fs.writeFileSync(path.join(store, dataFile), bytes);
    ok('a modified backup is reported by verify and refused by preview');
    void superA; void adminB;
  } finally {
    if (server) { server.kill(); await new Promise(r => setTimeout(r, 800)); }
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig, store]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS backup-admin: ${results.length} groups of checks (permissions, scheduler hook, run, verify, preview, two-person restore, sessions, audit, cancel/expiry, tamper)`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-1500)); process.exitCode = 1; });
