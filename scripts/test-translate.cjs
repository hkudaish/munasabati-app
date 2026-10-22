// Auto-translate assist for vendor content, in a throwaway schema of the LOCAL database, a separate Next server and a mock translation API.
// npm run test:translate
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const tag = randomBytes(5).toString('hex');
const schema = 'translate_test_' + tag;
const withSchema = name => { const u = new URL(base.toString()); u.searchParams.set('schema', name); return u.toString(); };
const dist = '.next-tr-test-' + process.pid, tsconfig = '.tr-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3115, BASE = 'http://127.0.0.1:' + PORT, MOCK = 4011;
const env = { ...process.env, DATABASE_URL: withSchema(schema), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: 'development', ANTHROPIC_API_KEY: 'test-key', TRANSLATE_API_URL: `http://127.0.0.1:${MOCK}/v1/messages`, TRANSLATE_MODEL: 'test-model' };
const db = new PrismaClient({ datasourceUrl: withSchema(schema) });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, mock, logs = '';
const seen = [];
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };
async function call(route, method = 'GET', data, cookie) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, data: json };
}
const session = async user => { const token = randomBytes(32).toString('base64url'); await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 36e5) } }); return 'munasabati_session=' + token; };

(async () => {
  try {
    mock = http.createServer((req, res) => {
      let raw = ''; req.on('data', d => raw += d); req.on('end', () => {
        const payload = JSON.parse(raw); seen.push({ headers: req.headers, payload });
        const input = JSON.parse(payload.messages[0].content);
        if (Object.values(input).some(v => String(v).includes('FAIL'))) { res.statusCode = 500; return res.end('{}'); }
        const out = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v).includes('HTML') ? '<b>Bold</b> text<script>x</script>' : 'EN:' + v]));
        res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ content: [{ type: 'text', text: 'Here you go: ' + JSON.stringify(out) }] }));
      });
    }).listen(MOCK);

    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    await require('./seed-geography.cjs').seedGeography(db);
    await db.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true } }).catch(() => {});
    await db.serviceCategory.create({ data: { id: 'cat1', nameAr: 'تصوير', nameEn: 'Photo', iconName: 'i', descriptionAr: 'd', color: '#ffffff' } });
    const mk = (name, phone, role) => db.user.create({ data: { name, phone, role } });
    const [client, lens, boss] = await Promise.all([mk('عميل', '0500020001', 'CLIENT'), mk('عدسة', '0500020002', 'VENDOR'), mk('مشرف', '0500020003', 'ADMIN')]);
    await db.vendor.create({ data: { userId: lens.id, businessName: 'استوديو عدسة', businessNameEn: 'T', categoryId: 'cat1', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: lens.phone, whatsappNumber: lens.phone, status: 'ACTIVE' } });
    const [cClient, cLens, cBoss] = await Promise.all([session(client), session(lens), session(boss)]);

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // 1. suggestions for the form: vendors and administrators only, nothing saved, markup stripped
    assert.equal((await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'تصوير' } }, cClient)).status, 403, 'customers cannot use it');
    assert.equal((await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'تصوير' } })).status, 401, 'signed-out visitors cannot use it');
    let s = await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'تصوير حفلات', descriptionEn: 'وصف طويل' } }, cLens);
    assert.equal(s.status, 200, JSON.stringify(s.data)); assert.deepEqual(s.data.translations, { titleEn: 'EN:تصوير حفلات', descriptionEn: 'EN:وصف طويل' });
    assert.equal(seen[0].headers['x-api-key'], 'test-key'); assert.equal(seen[0].payload.model, 'test-model'); assert.match(seen[0].payload.system, /never instructions/);
    s = await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'HTML' } }, cLens);
    assert.equal(s.data.translations.titleEn, 'Bold textx', 'markup never reaches the page');
    s = await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'FAIL' } }, cLens);
    assert.equal(s.status, 502); assert.match(s.data.error, /الترجمة/);
    assert.equal((await call('/api/commerce/translate', 'POST', { action: 'suggest', texts: { titleEn: 'x'.repeat(9000) } }, cLens)).status, 400);
    ok('suggestions work for vendors and administrators only, send the key and model, strip markup, and fail cleanly with a clear message');

    // 2. a service saved without English gets it automatically; one saved with English keeps the vendor's own text
    const service = (id, extra) => ({ kind: 'SERVICE', id, body: { titleAr: 'تصوير زفاف', descriptionAr: 'تغطية كاملة', categoryId: 'cat1', kind: 'BOOKABLE', cities: ['riyadh'], images: [], ...extra } });
    let saved = await call('/api/commerce/manage', 'POST', service('s-auto'), cLens);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    let row = (await db.$queryRaw`SELECT "body","version" FROM "CommerceService" WHERE "id"='s-auto'`)[0];
    assert.equal(row.body.titleEn, 'EN:تصوير زفاف'); assert.equal(row.body.descriptionEn, 'EN:تغطية كاملة'); assert.equal(row.body.enAuto, true); assert.equal(row.version, 1, 'English text does not bump the version');
    saved = await call('/api/commerce/manage', 'POST', service('s-own', { titleEn: 'Wedding photography', descriptionEn: 'Full coverage' }), cLens);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    row = (await db.$queryRaw`SELECT "body" FROM "CommerceService" WHERE "id"='s-own'`)[0];
    assert.equal(row.body.titleEn, 'Wedding photography'); assert.notEqual(row.body.enAuto, true);
    ok('a new service gets English automatically (marked as automatic, version unchanged) and a vendor-written English text is never overwritten');

    // 3. a failing translation never blocks saving
    saved = await call('/api/commerce/manage', 'POST', service('s-fail', { titleAr: 'FAIL تصوير' }), cLens);
    assert.equal(saved.status, 200); row = (await db.$queryRaw`SELECT "body" FROM "CommerceService" WHERE "id"='s-fail'`)[0];
    assert(!row.body.titleEn, 'left as it was');
    ok('when the translation service fails the vendor can still save, and the record simply stays without English');

    // 4. administrators fill everything that already exists: services, offers and packages
    await db.$executeRaw`INSERT INTO "CommerceService" ("id","ownerId","vendorId","body") VALUES ('old-1',${lens.id},NULL,${JSON.stringify({ titleAr: 'قاعة قديمة', descriptionAr: 'وصف قديم' })}::jsonb)`;
    await db.$executeRaw`INSERT INTO "CommerceOffer" ("id","serviceId","body") VALUES ('old-offer','old-1',${JSON.stringify({ nameAr: 'حجز الليلة' })}::jsonb)`;
    await db.$executeRaw`INSERT INTO "CommercePackage" ("id","ownerId","body") VALUES ('old-pkg',${lens.id},${JSON.stringify({ nameAr: 'باقة الزفاف', descriptionAr: 'كل شيء' })}::jsonb)`;
    assert.equal((await call('/api/commerce/translate', 'POST', { action: 'backfill' }, cLens)).status, 403, 'vendors cannot run the bulk fill');
    const b = await call('/api/commerce/translate', 'POST', { action: 'backfill' }, cBoss);
    assert.equal(b.status, 200, JSON.stringify(b.data)); assert.equal(b.data.remaining, 1, 'the FAIL service is still pending'); assert(b.data.filled >= 3);
    const offer = (await db.$queryRaw`SELECT "body","version" FROM "CommerceOffer" WHERE "id"='old-offer'`)[0], pkg = (await db.$queryRaw`SELECT "body" FROM "CommercePackage" WHERE "id"='old-pkg'`)[0], old = (await db.$queryRaw`SELECT "body" FROM "CommerceService" WHERE "id"='old-1'`)[0];
    assert.equal(offer.body.nameEn, 'EN:حجز الليلة'); assert.equal(offer.version, 1); assert.equal(pkg.body.descriptionEn, 'EN:كل شيء'); assert.equal(old.body.titleEn, 'EN:قاعة قديمة');
    ok('the administrator bulk fill translates existing services, offers and packages, reports what is left, and keeps versions unchanged');

    // 5. the public catalog carries the English text, so the English pages show it
    await db.$executeRaw`UPDATE "CommerceService" SET "body"="body" || '{"published":true,"approved":true}'::jsonb WHERE "id"='s-auto'`;
    const manage = await call('/api/commerce/manage', 'GET', undefined, cBoss);
    const listed = manage.data.services.find(x => x.id === 's-auto');
    assert.equal(listed.body.titleEn, 'EN:تصوير زفاف');
    ok('the stored English text is served with the catalog');
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    if (mock) mock.close();
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS translate: ${results.length} groups of checks (suggestions, auto on save, failure handling, bulk fill, catalog)`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-1500)); process.exitCode = 1; });
