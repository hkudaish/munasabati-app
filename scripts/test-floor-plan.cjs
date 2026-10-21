// API test for the saved hall layout: a throwaway schema in the LOCAL database and a separate Next server.
// npm run test:floor-plan
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'floor_plan_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const dist = '.next-fp-test-' + process.pid, tsconfig = '.fp-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3111', NODE_ENV: 'development' };
const BASE = 'http://127.0.0.1:3111';
const prisma = new PrismaClient({ datasourceUrl: url.toString() });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, logs = '';
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };
const password = randomBytes(18).toString('hex');
const hash = pw => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString('hex')}`; };
async function call(route, method = 'GET', data, cookie) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let body = {}; try { body = await r.json(); } catch { /* empty */ }
  return { status: r.status, body, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
const login = async email => { const r = await call('/api/auth/login', 'POST', { identifier: email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.cookie; };

const table = (id, o = {}) => ({ id, name: 'طاولة ' + id, shape: 'round', size: 'medium', section: 'women', x: 300, y: 300, rot: 0, ...o });
const chair = (id, tableId, o = {}) => ({ id, tableId, x: 310, y: 310, guestId: null, ...o });
const layoutOf = (tables, chairs) => ({ v: 1, tables, chairs });

(async () => {
  try {
    const push = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(push.status, 0, push.stdout + push.stderr);
    await require('./seed-geography.cjs').seedGeography(prisma);
    await prisma.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true, aliases: [] } });
    const mk = (name, email, phone) => prisma.user.create({ data: { name, email, phone, role: 'CLIENT', passwordHash: hash(password) } });
    const owner = await mk('صاحب المناسبة', 'owner@fp.test', '0500000001'), other = await mk('مستخدم آخر', 'other@fp.test', '0500000002');
    const occasion = await prisma.occasion.create({ data: { userId: owner.id, title: 'حفل', occasionTypeId: 'wedding', occasionTypeNameAr: 'زواج', cityId: 'riyadh', date: '2027-01-01' } });
    const route = `/api/occasions/${occasion.id}/floor-plan`;

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3111'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(r => setTimeout(r, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));
    const cOwner = await login('owner@fp.test'), cOther = await login('other@fp.test');

    // ---- ownership ----
    assert.equal((await call(route)).status, 401);
    assert.equal((await call(route, 'GET', undefined, cOther)).status, 404);
    assert.equal((await call(route, 'PUT', { layout: layoutOf([], []), version: 0 }, cOther)).status, 404);
    const first = await call(route, 'GET', undefined, cOwner);
    assert.equal(first.status, 200); assert.equal(first.body.version, 0); assert.deepEqual(first.body.layout, { v: 1, tables: [], chairs: [] });
    ok('only the owner can read or save a layout; a new occasion has an empty hall');

    // ---- saving and versions ----
    const layout1 = layoutOf([table('t1'), table('t2', { shape: 'banquet', size: 'large', x: 600, y: 200, rot: 90, section: 'vip' })], [chair('c1', 't1', { guestId: 'guest-1' }), chair('c2', 't1'), chair('c3', null, { x: 50, y: 50 })]);
    const s1 = await call(route, 'PUT', { layout: layout1, version: 0 }, cOwner);
    assert.equal(s1.status, 200, JSON.stringify(s1.body)); assert.equal(s1.body.saved, true); assert.equal(s1.body.version, 1);
    const read = await call(route, 'GET', undefined, cOwner);
    assert.deepEqual(read.body.layout, layout1); assert.equal(read.body.version, 1);
    const stale = await call(route, 'PUT', { layout: layoutOf([table('zz')], []), version: 0 }, cOwner);
    assert.equal(stale.body.saved, false); assert.equal(stale.body.conflict, true); assert.equal(stale.body.version, 1); assert.deepEqual(stale.body.layout, layout1);
    assert.deepEqual((await call(route, 'GET', undefined, cOwner)).body.layout, layout1, 'a stale save must not overwrite anything');
    const layout2 = { ...layout1, tables: layout1.tables.map(t => (t.id === 't1' ? { ...t, name: 'طاولة العائلة', x: 420 } : t)) };
    const s2 = await call(route, 'PUT', { layout: layout2, version: 1 }, cOwner);
    assert.equal(s2.body.saved, true); assert.equal(s2.body.version, 2);
    assert.equal((await call(route, 'PUT', { layout: layout2, version: 1 }, cOwner)).body.conflict, true);
    ok('saves are versioned: a stale tab gets the newer layout back and overwrites nothing');

    // ---- validation ----
    const bad = async (name, layout, version = 2) => { const r = await call(route, 'PUT', { layout, version }, cOwner); assert.equal(r.status, 400, name + ' -> ' + r.status + ' ' + JSON.stringify(r.body)); };
    await bad('unknown shape', layoutOf([table('t1', { shape: 'triangle' })], []));
    await bad('unknown size', layoutOf([table('t1', { size: 'huge' })], []));
    await bad('unknown section', layoutOf([table('t1', { section: 'kids' })], []));
    await bad('rotation 45', layoutOf([table('t1', { rot: 45 })], []));
    await bad('empty name', layoutOf([table('t1', { name: '   ' })], []));
    await bad('duplicate ids', layoutOf([table('t1'), table('t1')], []));
    await bad('bad id characters', layoutOf([table('t 1!')], []));
    await bad('chair on a missing table', layoutOf([table('t1')], [chair('c1', 'nope')]));
    await bad('same guest on two chairs', layoutOf([table('t1')], [chair('c1', 't1', { guestId: 'g' }), chair('c2', 't1', { guestId: 'g' })]));
    await bad('31 chairs on one table', layoutOf([table('t1')], Array.from({ length: 31 }, (_, i) => chair('c' + i, 't1'))));
    await bad('151 tables', layoutOf(Array.from({ length: 151 }, (_, i) => table('t' + i)), []));
    await bad('not a layout', { nope: true });
    await bad('wrong format version', { v: 2, tables: [], chairs: [] });
    await bad('NaN position', layoutOf([table('t1', { x: 'left' })], []));
    for (const version of [-1, 'x', 1.5, null]) assert.equal((await call(route, 'PUT', { layout: layout2, version }, cOwner)).status, 400);
    assert.equal((await call(route, 'GET', undefined, cOwner)).body.version, 2, 'rejected saves change nothing');
    const wild = await call(route, 'PUT', { layout: layoutOf([table('t1', { x: 5000, y: -40 })], [chair('c1', 't1', { x: 99999, y: 99999 })]), version: 2 }, cOwner);
    assert.equal(wild.status, 200);
    const clamped = (await call(route, 'GET', undefined, cOwner)).body.layout;
    assert.equal(clamped.tables[0].x, 1000); assert.equal(clamped.tables[0].y, 0); assert.equal(clamped.chairs[0].x, 1000); assert.equal(clamped.chairs[0].y, 640);
    ok('malformed layouts are rejected with 400 and change nothing; positions outside the hall are clamped');

    // ---- cascade ----
    assert.equal(await prisma.occasionFloorPlan.count({ where: { occasionId: occasion.id } }), 1);
    await prisma.occasion.delete({ where: { id: occasion.id } });
    assert.equal(await prisma.occasionFloorPlan.count({ where: { occasionId: occasion.id } }), 0);
    ok('deleting an occasion deletes its layout');
    void other;
  } finally {
    if (server) { server.kill(); await new Promise(r => setTimeout(r, 800)); }
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS floor-plan API: ${results.length} groups of checks (ownership, versions, validation, clamping, cascade)`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-1500)); process.exitCode = 1; });
