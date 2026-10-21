// Integration test for the incremental backup system. Uses two throwaway schemas in the LOCAL database and a
// temporary folder; nothing outside them is touched.  npm run test:backup
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const engine = require('./lib/backup-engine.cjs');

const tag = randomBytes(5).toString('hex');
const srcSchema = 'backup_src_' + tag, dstSchema = 'backup_dst_' + tag;
const urlFor = schema => { const u = new URL(base.toString()); u.searchParams.set('schema', schema); return u.toString(); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
const storage = new engine.FileStorage(dir);
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };

/** Minimal in-memory stand-in for a Netlify Blobs store (same methods the engine uses). */
function fakeBlobStore() {
  const data = new Map();
  return {
    data,
    async list({ prefix } = {}) { return { blobs: [...data.keys()].filter(k => !prefix || k.startsWith(prefix)).map(key => ({ key })) }; },
    async get(key, { type } = {}) { if (!data.has(key)) return null; const v = data.get(key); return type === 'json' ? JSON.parse(Buffer.from(v).toString()) : type === 'arrayBuffer' ? new Uint8Array(v).buffer : v; },
    async set(key, value, { onlyIfNew } = {}) { if (onlyIfNew && data.has(key)) return { modified: false }; data.set(key, Buffer.from(value)); return { modified: true }; },
    async delete(key) { data.delete(key); },
  };
}

(async () => {
  let src, dst, srcDb, dstDb; const admin = new PrismaClient({ datasourceUrl: base.toString() });
  const stateOf = async (prisma, schema) => { const s = await engine.takeSnapshot(prisma, schema); return Object.fromEntries(s.order.map(t => [t, Object.fromEntries(s.hashes[t])])); };
  try {
    // ---- two empty databases with the real structure ----
    for (const schema of [srcSchema, dstSchema]) {
      const push = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env, DATABASE_URL: urlFor(schema) }, encoding: 'utf8' });
      assert.equal(push.status, 0, push.stdout + push.stderr);
    }
    src = new PrismaClient({ datasourceUrl: urlFor(srcSchema) });
    dst = new PrismaClient({ datasourceUrl: urlFor(dstSchema) });
    srcDb = engine.openDb(urlFor(srcSchema)); dstDb = engine.openDb(urlFor(dstSchema));
    await require('./seed-geography.cjs').seedGeography(src);
    await src.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true, aliases: [] } });
    await src.serviceCategory.create({ data: { id: 'test', nameAr: 'اختبار', nameEn: 'Test', iconName: 'test', descriptionAr: 'اختبار', color: '#ffffff' } });
    const users = [];
    for (let i = 0; i < 3; i++) users.push(await src.user.create({ data: { name: 'مستخدم ' + i, phone: '05000000' + i + '0', email: `u${i}@backup.test`, role: i === 2 ? 'VENDOR' : 'CLIENT', passwordHash: 'scrypt:aa:bb' } }));
    const vendor = await src.vendor.create({ data: { userId: users[2].id, businessName: 'مورد النسخ', businessNameEn: 'Backup Vendor', categoryId: 'test', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: 'الأصل', cancellationPolicyAr: '', contactPhone: '0500000020', whatsappNumber: '0500000020', status: 'ACTIVE' } });
    const item = await src.serviceItem.create({ data: { vendorId: vendor.id, categoryId: 'test', cityId: 'riyadh', titleAr: 'خدمة ستحذف', descriptionAr: 'x', price: 1000, images: [], featuresAr: [] } });
    await src.authSession.create({ data: { userId: users[0].id, tokenHash: 'h-' + tag, expiresAt: new Date(Date.now() + 86400000) } });

    // ---- 1. full backup ----
    const full = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'full' });
    assert.equal(full.manifest.type, 'full'); assert(full.manifest.encrypted);
    assert(full.manifest.files.data.name.endsWith('.enc'));
    assert.equal(full.manifest.tables.AuthSession, undefined, 'sessions must not be backed up');
    assert(full.manifest.tables.User.rows === 3 && full.manifest.tables.Vendor.rows === 1);
    assert(!fs.readFileSync(path.join(dir, full.manifest.files.data.name)).includes(Buffer.from('backup.test')), 'ciphertext must not contain plaintext');
    ok('full backup is consistent, encrypted and leaves out sessions', full.manifest.stats.rows + ' rows');
    const stateAtFull = await stateOf(srcDb, srcSchema);

    // ---- 2. incremental captures exactly the changes ----
    const newUser = await src.user.create({ data: { name: 'جديد', phone: '0500000099', email: 'new@backup.test', role: 'CLIENT', passwordHash: 'scrypt:cc:dd' } });
    await src.vendor.update({ where: { id: vendor.id }, data: { bioAr: 'تم التعديل' } });
    await src.serviceItem.delete({ where: { id: item.id } });
    const inc1 = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'incremental' });
    assert.equal(inc1.manifest.parent, full.manifest.id);
    assert.equal(inc1.manifest.stats.upserts, 2, 'one new user + one changed vendor');
    assert.equal(inc1.manifest.stats.deletes, 1, 'one deleted service');
    assert(inc1.manifest.files.data.bytes < full.manifest.files.data.bytes, 'incremental is smaller than the full backup');
    ok('incremental holds exactly the new, changed and deleted rows', `+${inc1.manifest.stats.upserts} -${inc1.manifest.stats.deletes}, ${inc1.manifest.files.data.bytes} bytes vs ${full.manifest.files.data.bytes}`);
    const stateAfterInc1 = await stateOf(srcDb, srcSchema);

    // ---- 3. nothing changed -> empty incremental ----
    const inc2 = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'incremental' });
    assert.equal(inc2.changed, 0);
    ok('an incremental with no changes is empty');

    // ---- 4. more changes ----
    await src.user.update({ where: { id: newUser.id }, data: { name: 'جديد معدل' } });
    await src.user.delete({ where: { id: users[1].id } });
    const inc3 = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'incremental' });
    assert.equal(inc3.manifest.stats.upserts, 1); assert.equal(inc3.manifest.stats.deletes, 1);
    ok('later incremental records only the newest changes', `+${inc3.manifest.stats.upserts} -${inc3.manifest.stats.deletes}`);
    const stateAfterInc3 = await stateOf(srcDb, srcSchema);

    // ---- 5. verification and restore (latest) ----
    assert.equal((await engine.verifyChain(storage, inc3.manifest.id)).ok, true);
    ok('chain verification passes (checksums, links, readable)');
    const restored = await engine.restoreBackup({ prisma: dstDb, schema: dstSchema, storage, replace: false });
    assert.equal(restored.verified, true, restored.mismatches.join('; '));
    assert.deepEqual(await stateOf(dstDb, dstSchema), stateAfterInc3);
    ok('restore of the newest backup reproduces the database exactly', restored.rows + ' rows, every row hash matches');

    // ---- 6. preview changes nothing and tells the truth ----
    const liveBefore = await stateOf(srcDb, srcSchema);
    const preview = await engine.previewRestore({ prisma: srcDb, schema: srcSchema, storage, headId: full.manifest.id });
    assert.equal(preview.compatible, true);
    assert.deepEqual(preview.totals, { toAdd: 2, toRemove: 1, toChange: 1, unchanged: preview.totals.unchanged }, 'u1 + deleted service come back, the new user goes, the vendor reverts');
    const byTable = Object.fromEntries(preview.tables.map(t => [t.table, t]));
    assert.equal(byTable.User.toAdd, 1); assert.equal(byTable.User.toRemove, 1); assert.equal(byTable.Vendor.toChange, 1); assert.equal(byTable.ServiceItem.toAdd, 1);
    assert.deepEqual(await stateOf(srcDb, srcSchema), liveBefore);
    assert.deepEqual(liveBefore, await stateOf(srcDb, srcSchema));
    const sameAsLive = await engine.previewRestore({ prisma: srcDb, schema: srcSchema, storage, headId: inc3.manifest.id });
    assert.deepEqual([sameAsLive.totals.toAdd, sameAsLive.totals.toRemove, sameAsLive.totals.toChange], [0, 0, 0]);
    ok('preview lists exactly what a restore would add, remove and revert, and changes nothing', JSON.stringify({ add: preview.totals.toAdd, remove: preview.totals.toRemove, revert: preview.totals.toChange }));
    void stateAtFull;

    // ---- 7. point in time, non-empty targets, sessions ----
    await assert.rejects(engine.restoreBackup({ prisma: dstDb, schema: dstSchema, storage, headId: inc1.manifest.id }), /already holds .* rows/);
    ok('restore into a non-empty database is refused without --replace');
    await dst.authSession.create({ data: { userId: (await dst.user.findFirst({ where: { email: 'u0@backup.test' } })).id, tokenHash: 'dst-' + tag, expiresAt: new Date(Date.now() + 86400000) } });
    await dst.systemAuditLog.create({ data: { actorId: 'tester', action: 'AFTER_BACKUP_EVENT', targetId: 'x' } }); // written after the backup
    const safety = storage.sub('pre-restore');
    const pit = await engine.restoreBackup({ prisma: dstDb, schema: dstSchema, storage, headId: inc1.manifest.id, replace: true, safetyStorage: safety });
    assert.equal(pit.verified, true);
    const noAudit = st => { const c = { ...st }; delete c.SystemAuditLog; return c; }; // the audit trail is preserved on purpose
    assert.deepEqual(noAudit(await stateOf(dstDb, dstSchema)), noAudit(stateAfterInc1));
    assert((await engine.readManifests(safety)).length === 1, 'a safety backup of the replaced data was taken');
    assert.equal(await dst.authSession.count(), 0, 'all sessions are revoked by a restore');
    assert.equal(await dst.systemAuditLog.count({ where: { action: 'AFTER_BACKUP_EVENT' } }), 1, 'the audit trail survives a restore');
    ok('point-in-time restore returns the database to an earlier backup', 'safety copy kept, sessions revoked, audit trail kept');
    assert.equal(await dst.user.count({ where: { id: users[1].id } }), 1, 'the user deleted later exists again at that point in time');

    // ---- 8. tampering and wrong key ----
    const victim = path.join(dir, inc1.manifest.files.data.name);
    const original = fs.readFileSync(victim);
    const bad = Buffer.from(original); bad[bad.length - 20] ^= 0xff; fs.writeFileSync(victim, bad);
    const tampered = await engine.verifyChain(storage, inc3.manifest.id);
    assert.equal(tampered.ok, false); assert(tampered.problems.some(p => /modified/.test(p)));
    await assert.rejects(engine.restoreBackup({ prisma: dstDb, schema: dstSchema, storage, replace: true }), /damaged/);
    await assert.rejects(engine.previewRestore({ prisma: srcDb, schema: srcSchema, storage }), /damaged/);
    fs.writeFileSync(victim, original);
    assert.equal((await engine.verifyChain(storage, inc3.manifest.id)).ok, true);
    ok('a modified backup file is detected and never previewed or restored');
    const realKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    assert.equal((await engine.verifyChain(storage, inc3.manifest.id)).ok, false);
    delete process.env.BACKUP_ENCRYPTION_KEY;
    assert.equal((await engine.verifyChain(storage, inc3.manifest.id)).ok, false);
    process.env.BACKUP_ENCRYPTION_KEY = realKey;
    ok('wrong or missing encryption key is rejected');

    // ---- 9. structure change forces a new chain ----
    await src.$executeRawUnsafe(`ALTER TABLE "${srcSchema}"."Coupon" ADD COLUMN "backupTestColumn" TEXT`);
    await assert.rejects(engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'incremental' }), /structure changed/);
    ok('a changed database structure refuses to continue the old chain');
    await src.$executeRawUnsafe(`ALTER TABLE "${srcSchema}"."Coupon" DROP COLUMN "backupTestColumn"`);

    // ---- 10. policy ----
    const DAY = 86400000, manifests = await engine.readManifests(storage);
    assert.equal(engine.nextAutoType([]).type, 'full');
    assert.equal(engine.nextAutoType(manifests, engine.DEFAULT_POLICY, Date.now()).type, 'incremental');
    assert.equal(engine.nextAutoType(manifests, engine.DEFAULT_POLICY, Date.now() + 8 * DAY).type, 'full');
    assert.equal(engine.nextAutoType(manifests, { ...engine.DEFAULT_POLICY, maxIncrementals: 3 }, Date.now()).type, 'full');
    ok('automatic policy: first run full, then incremental, new full when old or long');

    // ---- 11. pruning removes whole chains only ----
    const second = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'full' });
    const third = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'full' });
    const removed = await engine.prune(storage, 2);
    assert.deepEqual(removed.sort(), [full.manifest.id, inc1.manifest.id, inc2.manifest.id, inc3.manifest.id].sort());
    assert((await engine.readManifests(storage)).length === 2 && (await engine.verifyChain(storage, third.manifest.id)).ok && (await engine.verifyChain(storage, second.manifest.id)).ok);
    assert(!fs.existsSync(path.join(dir, full.manifest.files.data.name)), 'old data files are deleted too');
    ok('retention deletes the oldest chain completely and keeps the others valid', removed.length + ' file sets removed');

    // ---- 12. concurrent runs ----
    fs.writeFileSync(path.join(dir, '.lock'), '1');
    await assert.rejects(engine.createBackup({ prisma: srcDb, schema: srcSchema, storage, type: 'incremental' }), /Another backup is running/);
    fs.unlinkSync(path.join(dir, '.lock'));
    ok('two backups cannot run at the same time');

    // ---- 13. cloud storage (Netlify Blobs interface) ----
    const store = fakeBlobStore();
    const cloud = new engine.BlobStorage(store);
    const cFull = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage: cloud, type: 'full', label: 'cloud' });
    await src.user.update({ where: { id: newUser.id }, data: { name: 'سحابة' } });
    const cInc = await engine.createBackup({ prisma: srcDb, schema: srcSchema, storage: cloud, type: 'incremental' });
    assert.equal(cInc.changed, 1);
    assert.equal((await engine.verifyChain(cloud, cInc.manifest.id)).ok, true);
    const release = await cloud.acquireLock();
    await assert.rejects(cloud.acquireLock(), /Another backup is running/);
    await release();
    const cloudSafety = cloud.sub('pre-restore');
    await cloudSafety.write('x.txt', Buffer.from('1'));
    assert((await cloud.list()).every(n => !n.includes('/')), 'namespaced files stay out of the main listing');
    const cRestore = await engine.restoreBackup({ prisma: dstDb, schema: dstSchema, storage: cloud, replace: true, safetyStorage: cloudSafety });
    assert.equal(cRestore.verified, true);
    assert.deepEqual(noAudit(await stateOf(dstDb, dstSchema)), noAudit(await stateOf(srcDb, srcSchema)));
    ok('cloud storage: backup, verify, lock, namespaces and restore work through the Blobs interface', [...store.data.keys()].length + ' objects');

    // ---- 14. command line smoke test (list, auto, verify) ----
    const cliRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-cli-'));
    const cli = (...a) => spawnSync(process.execPath, ['scripts/backup.cjs', ...a, '--dir', cliRoot, '--url', urlFor(srcSchema), '--schema', srcSchema], { env: process.env, encoding: 'utf8' });
    const a1 = cli('auto'); assert.equal(a1.status, 0, a1.stderr); assert(/full backup/.test(a1.stdout));
    const a2 = cli('auto'); assert.equal(a2.status, 0, a2.stderr); assert(/incremental backup/.test(a2.stdout));
    const v = cli('verify'); assert.equal(v.status, 0, v.stderr);
    assert(/auto/.test(fs.readFileSync(path.join(cliRoot, 'backup.log'), 'utf8')));
    fs.rmSync(cliRoot, { recursive: true, force: true });
    ok('command line: auto runs full then incremental, verifies itself and writes a log');
  } finally {
    for (const c of [src, dst, srcDb, dstDb]) if (c) await c.$disconnect();
    for (const schema of [srcSchema, dstSchema]) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\nPASS backup: ${results.length} checks (full, incremental, empty delta, restore, preview, point in time, sessions, tamper, wrong key, structure change, policy, pruning, locking, cloud storage, CLI)`);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exitCode = 1; });
