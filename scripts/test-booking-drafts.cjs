// Booking drafts, immutable snapshots, saved-for-later, price history and acknowledgement, outbox, reminders and notification jobs,
// admin dashboards: a throwaway schema in the LOCAL database, a separate Next server and a mock email provider.
// npm run test:booking-drafts
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'draft_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const dist = '.next-bd-test-' + process.pid, tsconfig = '.bd-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3116, BASE = 'http://127.0.0.1:' + PORT, MAIL = 4012, CRON = 'test-cron-token-' + randomBytes(4).toString('hex');
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: 'development', BACKUP_CRON_TOKEN: CRON, NOTIFY_EMAIL_API_KEY: 'k', NOTIFY_EMAIL_FROM: 'noreply@test.local', NOTIFY_EMAIL_URL: `http://127.0.0.1:${MAIL}/emails` };
const db = new PrismaClient({ datasourceUrl: url.toString() });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, mail, logs = '';
const mailbox = []; let mailMode = 'ok';
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };
async function raw(route, method = 'GET', data, cookie) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, data: json, headers: r.headers };
}
const call = raw;
const must = r => (assert.equal(r.status, 200, JSON.stringify(r.data)), r.data);
const session = async user => { const token = randomBytes(32).toString('base64url'); await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } }); return 'munasabati_session=' + token; };
const day = n => new Date(Date.now() + (40 + n) * 86400000).toISOString().slice(0, 10);
const cron = async (token = CRON) => raw('/api/internal/notifications-cron', 'POST', undefined, undefined).then(() => fetch(BASE + '/api/internal/notifications-cron', { method: 'POST', headers: { 'x-backup-token': token } }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) })));
const sql = (strings, ...values) => db.$queryRaw(strings, ...values);
const sqlx = (strings, ...values) => db.$executeRaw(strings, ...values);

(async () => {
  try {
    mail = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { if (mailMode === 'fail') { res.statusCode = 500; return res.end('{}'); } mailbox.push(JSON.parse(b)); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'mail-' + mailbox.length })); }); }).listen(MAIL);

    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    // the migration adds what db push cannot: check constraints, composite foreign keys and the append-only triggers (it must be safe to run twice)
    for (let i = 0; i < 2; i++) { r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', 'prisma/sql/20261023-booking-drafts.sql'], { env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr); }
    await require('./seed-geography.cjs').seedGeography(db);
    const region = (id, en, ar) => db.geoRegion.upsert({ where: { id }, create: { id, countryCode: 'SA', nameAr: ar, nameEn: en }, update: {} });
    await region('r-riyadh', 'Riyadh Region', 'منطقة الرياض'); await region('r-makkah', 'Makkah Region', 'منطقة مكة');
    const cityRow = (id, ar, en, regionId) => ({ id, nameAr: ar, nameEn: en, regionAr: ar, regionId, countryCode: 'SA', isAvailable: true, defaultAvailable: true });
    for (const c of [cityRow('riyadh', 'الرياض', 'Riyadh', 'r-riyadh'), cityRow('jeddah', 'جدة', 'Jeddah', 'r-makkah')]) await db.saudiCity.upsert({ where: { id: c.id }, create: c, update: { regionId: c.regionId, countryCode: 'SA', isAvailable: true, defaultAvailable: true } });
    await db.geoCountry.update({ where: { code: 'SA' }, data: { enabled: true } });

    const mk = (name, phone, role, extra = {}) => db.user.create({ data: { name, phone, role, ...extra } });
    const noura = await mk('نورة', '0500300001', 'CLIENT', { email: 'noura@test.local' }), faisal = await mk('فيصل', '0500300002', 'CLIENT'), sara = await mk('سارة', '0500300003', 'CLIENT', { email: 'sara@test.local' });
    const vendorUser = await mk('مورد', '0500300004', 'VENDOR'), boss = await mk('إداري', '0500300005', 'ADMIN'), root = await mk('مدير النظام', '0500300006', 'SUPER_ADMIN');
    await db.vendor.create({ data: { userId: vendorUser.id, businessName: 'مورد الاختبار', businessNameEn: 'T', categoryId: 'entertainment', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: vendorUser.phone, whatsappNumber: vendorUser.phone, status: 'ACTIVE', verified: true } });
    const [cNoura, cFaisal, cSara, cBoss, cRoot] = await Promise.all([session(noura), session(faisal), session(sara), session(boss), session(root)]);

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ---- the catalogue: two bookable services (Riyadh only / Riyadh + Jeddah), each with one fixed-price offer ----
    const serviceBody = { titleAr: 'تصوير حفلات', descriptionAr: 'وصف', kind: 'BOOKABLE', categoryId: 'entertainment', subcategoryId: null, artistId: null, cities: ['riyadh'], managerIds: [vendorUser.id], resourceIds: [], published: true, approved: true, images: [], videoUrls: [] };
    const svcA = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'svc-a', body: serviceBody }, cRoot)).entity;
    const svcB = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'svc-b', body: { ...serviceBody, titleAr: 'كوشة', cities: ['riyadh', 'jeddah'] } }, cRoot)).entity;
    const policyBody = amount => ({ baseAmount: amount, bookingMode: 'DIRECT', durationMinutes: 60, minDurationMinutes: 30, maxDurationMinutes: 600, depositBps: 0, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 10000, beforeHours: 0 }], calendar: { minNoticeHours: 0, bufferMinutes: 0 } });
    const offerA = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'offer-a', serviceId: svcA.id, body: { nameAr: 'عرض أ', model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 15, policy: policyBody(10000) } }, cRoot)).entity;
    const offerB = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'offer-b', serviceId: svcB.id, body: { nameAr: 'عرض ب', model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 15, policy: policyBody(20000) } }, cRoot)).entity;
    const reprice = async (offer, amount) => must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: offer.id, serviceId: offer.serviceId, version: offer.version, body: { ...offer.body, policy: policyBody(amount) } }, cRoot)).entity;
    const getCart = async cookie => must(await call('/api/commerce/cart', 'GET', undefined, cookie));
    const buy = async (cart, cookie) => call('/api/commerce/orders', 'POST', { cartVersion: cart.cart.version, quoteHash: cart.quote.hash, idempotencyKey: randomBytes(16).toString('hex'), acceptTerms: true }, cookie);

    // ================================================================= 1. database guarantees
    const draftOwnerless = await sqlx`INSERT INTO "BookingDraft" ("id","serviceId") VALUES ('bad-1','svc-a')`.then(() => 'inserted', e => String(e.message));
    assert.match(draftOwnerless, /BookingDraft_one_owner|check/i, 'a draft must have exactly one owner');
    await assert.rejects(() => sqlx`INSERT INTO "BookingDraft" ("id","serviceId","userId","guestTokenHash") VALUES ('bad-2','svc-a',${noura.id},'x')`, /BookingDraft_one_owner|check/i);
    const d1 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh' } }, cNoura));
    assert.equal(d1.version, 1); assert.equal(d1.resumed, false);
    await assert.rejects(() => sqlx`UPDATE "BookingSnapshot" SET "hash"='tampered' WHERE "draftId"=${d1.id}`, /immutable/i);
    await assert.rejects(() => sqlx`DELETE FROM "BookingSnapshot" WHERE "draftId"=${d1.id}`, /immutable/i);
    const other = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-b', config: { offerId: 'offer-b' }, reuse: false }, cFaisal));
    await assert.rejects(() => sqlx`UPDATE "BookingDraft" SET "latestSnapshotId"=(SELECT "id" FROM "BookingSnapshot" WHERE "draftId"=${other.id} LIMIT 1) WHERE "id"=${d1.id}`, /BookingDraft_latest_same_draft|foreign key/i);
    await assert.rejects(() => sqlx`INSERT INTO "BookingSnapshot" ("id","draftId","versionNumber","data","hash","previousSnapshotId") VALUES ('x1',${d1.id},9,'{}'::jsonb,'h',(SELECT "id" FROM "BookingSnapshot" WHERE "draftId"=${other.id} LIMIT 1))`, /BookingSnapshot_previous_same_draft|foreign key/i);
    await assert.rejects(() => sqlx`INSERT INTO "BookingSnapshot" ("id","draftId","versionNumber","data","hash") VALUES ('x2',${d1.id},1,'{}'::jsonb,'h')`, /23505|already exists/i);
    await assert.rejects(() => sqlx`INSERT INTO "CartPriceSnapshot" ("id","userId","lineId","totalHalala","breakdown") VALUES ('p1',${noura.id},'l',1,'{}'::jsonb)`.then(() => sqlx`UPDATE "CartPriceSnapshot" SET "totalHalala"=2 WHERE "id"='p1'`), /immutable/i);
    ok('the database enforces one owner per draft, append-only snapshots and price history, same-draft snapshot links and unique version numbers; the migration runs twice safely');

    // ================================================================= 2. save, conflicts, history, restore, dependencies
    assert.equal(must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a' }, cNoura)).id, d1.id, 'the unfinished draft is resumed, not duplicated');
    let s = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 1, changes: { date: day(0), time: '10:00', notes: 'حفل في الحديقة', durationMinutes: 60 } }, cNoura));
    assert.equal(s.version, 2); assert.equal(s.saved, true); assert.equal(s.validationStatus, 'VALID'); assert(s.quote.totals.total > 0);
    assert.deepEqual(s.affectedFields.sort(), ['availability', 'price']);
    const stale = await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 1, changes: { notes: 'قديم' } }, cNoura);
    assert.equal(stale.status, 409); assert.equal(stale.data.conflict, true); assert.equal(stale.data.currentVersion, 2); assert.equal(stale.data.current.config.notes, 'حفل في الحديقة', 'the newer state is returned, nothing is overwritten');
    const same = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 2, changes: { notes: 'حفل في الحديقة' } }, cNoura));
    assert.equal(same.version, 2); assert.equal(same.unchanged, true, 'saving the same thing creates no new version');
    s = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 2, changes: { options: [{ id: 'x', quantity: 1 }], guestCount: 40 } }, cNoura));
    assert.equal(s.version, 3);
    s = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 3, changes: { offerId: 'offer-a', cityId: 'riyadh' } }, cNoura));
    assert.equal(s.unchanged, true);
    // an unrelated field never clears anything; changing the OFFER clears only what was bound to the old offer
    s = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 3, changes: { cityId: 'jeddah' } }, cNoura));
    assert.equal(s.version, 4); assert.deepEqual(s.affectedFields.sort(), ['availability', 'price', 'vendorSelection']); assert.deepEqual(s.clearedFields, []);
    assert.notEqual(s.validationStatus, 'VALID', 'service A is not offered in Jeddah'); assert.equal(s.requiresCustomerReview, true);
    let current = must(await call(`/api/booking-drafts/${d1.id}`, 'GET', undefined, cNoura));
    assert.equal(current.config.notes, 'حفل في الحديقة'); assert.equal(current.config.guestCount, 40); assert.deepEqual(current.config.options, [{ id: 'x', quantity: 1 }]);
    s = must(await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: 4, changes: { cityId: 'riyadh', offerId: 'offer-b' } }, cNoura));
    assert.deepEqual(s.clearedFields, ['options'], 'the options chosen for the old offer are cleared with it, nothing else is');
    current = must(await call(`/api/booking-drafts/${d1.id}`, 'GET', undefined, cNoura));
    assert.equal(current.config.options, undefined); assert.equal(current.config.notes, 'حفل في الحديقة'); assert.equal(current.config.guestCount, 40);
    const hist = must(await call(`/api/booking-drafts/${d1.id}/history`, 'GET', undefined, cNoura));
    assert.deepEqual(hist.versions.map(v => v.versionNumber), [5, 4, 3, 2, 1]);
    const restored = must(await call(`/api/booking-drafts/${d1.id}/restore`, 'POST', { versionNumber: 2, expectedVersion: hist.currentVersion }, cNoura));
    assert.equal(restored.version, hist.currentVersion + 1, 'restoring adds a new version, history is not rewritten');
    current = must(await call(`/api/booking-drafts/${d1.id}`, 'GET', undefined, cNoura));
    assert.equal(current.config.cityId, 'riyadh'); assert.equal(current.config.guestCount, undefined); assert.equal(current.config.notes, 'حفل في الحديقة');
    assert.equal((await call(`/api/booking-drafts/${d1.id}`, 'GET', undefined, cFaisal)).status, 404, "another customer's draft is not visible");
    assert.equal((await call(`/api/booking-drafts/${d1.id}`, 'PATCH', { expectedVersion: current.version, changes: { notes: 'x' } }, cFaisal)).status, 404);
    ok('autosave creates ordered versions, stale saves get a conflict with the newer state, history and restore work, only dependents are re-checked, other customers cannot see a draft');

    // ================================================================= 3. concurrency
    const dc = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-b', config: { offerId: 'offer-b', cityId: 'riyadh' }, reuse: false }, cNoura));
    const race = await Promise.all([1, 2, 3, 4, 5, 6].map(i => call(`/api/booking-drafts/${dc.id}`, 'PATCH', { expectedVersion: 1, changes: { notes: 'محاولة ' + i } }, cNoura)));
    assert.equal(race.filter(x => x.status === 200).length, 1, 'exactly one of six simultaneous saves wins: ' + race.map(x => x.status));
    assert.equal(race.filter(x => x.status === 409).length, 5);
    const versions = await sql`SELECT "versionNumber" FROM "BookingSnapshot" WHERE "draftId"=${dc.id} ORDER BY 1`;
    assert.deepEqual(versions.map(v => v.versionNumber), [1, 2]);
    ok('six simultaneous saves of the same version: one wins, five get a conflict, versions stay consecutive');

    // ================================================================= 4. guests: a token in a cookie, merged on sign-in
    const g = await raw('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh' } });
    assert.equal(g.status, 200); const setCookie = g.headers.get('set-cookie') ?? ''; assert.match(setCookie, /bd_guest=/); assert.match(setCookie, /HttpOnly/i);
    const guestCookie = setCookie.split(';')[0];
    assert.equal(must(await call('/api/booking-drafts', 'GET', undefined, guestCookie)).drafts.length, 1);
    assert.equal((await call(`/api/booking-drafts/${g.data.id}/add-to-cart`, 'POST', undefined, guestCookie)).status, 401, 'adding to the cart needs an account');
    assert.equal(must(await call('/api/booking-drafts', 'GET', undefined, cSara + '; ' + guestCookie)).drafts.length, 1, "after sign-in the guest's draft is in the customer's account");
    assert.equal((await sql`SELECT "userId","guestTokenHash" FROM "BookingDraft" WHERE "id"=${g.data.id}`)[0].userId, sara.id);
    assert.equal(must(await call('/api/booking-drafts', 'GET', undefined, cSara)).drafts.length, 1);
    assert.equal(must(await call('/api/booking-drafts', 'GET', undefined, guestCookie)).drafts.length, 0, 'the guest token no longer opens it');
    assert.equal((await call(`/api/booking-drafts/${g.data.id}`, 'GET', undefined, guestCookie)).status, 404);
    ok('guest drafts use an httpOnly token, cannot reach the cart, and move to the account when the visitor signs in');

    // ================================================================= 5. add to cart, edit a cart item through its draft
    const dv = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(1), time: '11:00', durationMinutes: 60 }, reuse: false }, cFaisal));
    must(await call(`/api/booking-drafts/${dv.id}`, 'PATCH', { expectedVersion: 1, changes: { notes: 'ملاحظة' } }, cFaisal));
    const added = must(await call(`/api/booking-drafts/${dv.id}/add-to-cart`, 'POST', undefined, cFaisal));
    assert.equal(added.lineId, dv.id);
    let cart = await getCart(cFaisal);
    const line = cart.cart.body.lines.find(l => l.id === dv.id);
    assert.equal(line.draftId, dv.id); assert.equal(line.snapshotId, (await sql`SELECT "latestSnapshotId" FROM "BookingDraft" WHERE "id"=${dv.id}`)[0].latestSnapshotId, 'the cart item is bound to the saved snapshot');
    assert.equal((await sql`SELECT "status" FROM "BookingDraft" WHERE "id"=${dv.id}`)[0].status, 'IN_CART');
    const before = cart.cart.version;
    const edit = must(await call(`/api/booking-drafts/${dv.id}`, 'PATCH', { expectedVersion: 2, changes: { time: '12:00' } }, cFaisal));
    assert.equal(edit.cartUpdated, true); cart = await getCart(cFaisal);
    assert.equal(cart.cart.body.lines.find(l => l.id === dv.id).time, '12:00'); assert(cart.cart.version > before);
    const bad = must(await call(`/api/booking-drafts/${dv.id}`, 'PATCH', { expectedVersion: 3, changes: { cityId: 'jeddah' } }, cFaisal));
    assert.equal(bad.cartUpdated, false); assert.equal((await getCart(cFaisal)).cart.body.lines.find(l => l.id === dv.id).cityId, 'riyadh', 'an edit that cannot be bought never reaches the cart');
    must(await call(`/api/booking-drafts/${dv.id}`, 'PATCH', { expectedVersion: 4, changes: { cityId: 'riyadh' } }, cFaisal));
    ok('add-to-cart binds the cart item to the saved snapshot; editing the draft updates the cart item only when the result can be bought');

    // ================================================================= 6. saved for later; checkout buys only the active items and keeps the rest
    const dw = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-b', config: { offerId: 'offer-b', cityId: 'riyadh', date: day(2), time: '15:00', durationMinutes: 60 }, reuse: false }, cFaisal));
    must(await call(`/api/booking-drafts/${dw.id}/add-to-cart`, 'POST', undefined, cFaisal));
    cart = await getCart(cFaisal); assert.equal(cart.cart.body.lines.length, 2);
    const total2 = cart.quote.totals.total;
    must(await call(`/api/cart/items/${dw.id}/save-for-later`, 'POST', { version: cart.cart.version }, cFaisal));
    cart = await getCart(cFaisal);
    assert(cart.quote.totals.total < total2, 'a saved item is not priced into the cart'); assert.equal(cart.saved.length, 1); assert(cart.saved[0].quote.totals.total > 0, 'but its own price is shown');
    assert.equal((await call(`/api/cart/items/${dw.id}/save-for-later`, 'POST', { version: 1 }, cFaisal)).status, 409, 'a stale cart version is refused');
    const order = must(await buy(cart, cFaisal));
    cart = await getCart(cFaisal);
    assert.equal(cart.cart.body.lines.length, 1); assert.equal(cart.cart.body.lines[0].id, dw.id, 'the saved item stays after checkout');
    assert.equal((await sql`SELECT "status" FROM "BookingDraft" WHERE "id"=${dv.id}`)[0].status, 'PURCHASED'); assert.equal((await sql`SELECT "status" FROM "BookingDraft" WHERE "id"=${dw.id}`)[0].status, 'IN_CART');
    must(await call(`/api/cart/items/${dw.id}/restore`, 'POST', { version: cart.cart.version }, cFaisal));
    assert.equal((await getCart(cFaisal)).quote.lines.length >= 1, true); void order;
    ok('saved-for-later items keep their choices and are not bought or priced; the purchased draft closes and the saved one survives checkout');

    // ================================================================= 7. price history, increases need acknowledgement, decreases just apply
    const dp = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(3), time: '09:00', durationMinutes: 60 }, reuse: false }, cNoura));
    must(await call(`/api/booking-drafts/${dp.id}/add-to-cart`, 'POST', undefined, cNoura));
    let c = await getCart(cNoura); assert.equal(c.priceChanges.length, 0);
    const base0 = (await sql`SELECT "totalHalala" FROM "CartPriceSnapshot" WHERE "userId"=${noura.id} AND "lineId"=${dp.id}`);
    assert.equal(base0.length, 1, 'the first sight is only a baseline');
    const offerA2 = await reprice(await db.$queryRaw`SELECT * FROM "CommerceOffer" WHERE "id"='offer-a'`.then(x => x[0]), 15000);
    c = await getCart(cNoura);
    assert.equal(c.priceChanges.length, 1); assert.equal(c.priceChanges[0].direction, 'INCREASE'); assert(c.priceChanges[0].differenceHalala > 0);
    const refused = await buy(c, cNoura);
    assert.equal(refused.status, 409); assert.equal(refused.data.priceChangeRequired, true, 'a higher price is never charged without acknowledgement');
    const hist2 = must(await call(`/api/cart/items/${dp.id}/price-history`, 'GET', undefined, cNoura));
    assert.equal(hist2.snapshots.length, 2); assert.equal(hist2.changes.length, 1);
    assert.equal((await call(`/api/cart/items/${dp.id}/acknowledge-price`, 'POST', undefined, cFaisal)).data.acknowledged, 0, "another customer cannot acknowledge someone else's change");
    assert.equal(must(await call(`/api/cart/items/${dp.id}/acknowledge-price`, 'POST', undefined, cNoura)).acknowledged, 1);
    c = await getCart(cNoura); assert.equal(c.priceChanges.length, 0);
    // a decrease needs no acknowledgement
    await reprice(offerA2, 9000); c = await getCart(cNoura);
    assert.equal(c.priceChanges.length, 0); const changes = await sql`SELECT "direction","acknowledgedAt" FROM "CartPriceChange" WHERE "userId"=${noura.id} ORDER BY "detectedAt"`;
    assert.deepEqual(changes.map(x => x.direction), ['INCREASE', 'DECREASE']); assert(changes[1].acknowledgedAt);
    const o = must(await buy(c, cNoura)); assert(o.orders ?? o.order ?? o.id ?? o.number, 'checkout works at the current, lower price');
    ok('price history is append-only; an increase blocks checkout until acknowledged (only by its owner); a decrease applies at once; the order is created at the current price');

    // ================================================================= 8. notifications: outbox -> jobs -> inbox, grouped, deduplicated, rechecked
    assert.equal((await raw('/api/internal/notifications-cron', 'POST')).status, 401, 'no secret, no run');
    assert.equal((await cron('wrong-token')).status, 401);
    const e1 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(4), time: '09:00', durationMinutes: 60 }, reuse: false }, cSara));
    const e2 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-b', config: { offerId: 'offer-b', cityId: 'riyadh', date: day(4), time: '12:00', durationMinutes: 60 }, reuse: false }, cSara));
    must(await call(`/api/booking-drafts/${e1.id}/add-to-cart`, 'POST', undefined, cSara)); must(await call(`/api/booking-drafts/${e2.id}/add-to-cart`, 'POST', undefined, cSara));
    await call('/api/admin/notification-settings', 'PATCH', { settings: { price: { groupWindowMinutes: 0 } } }, cBoss);   // no grouping window: send as soon as the job exists
    const aNow = await db.$queryRaw`SELECT * FROM "CommerceOffer" WHERE "id"='offer-a'`.then(x => x[0]), bNow = await db.$queryRaw`SELECT * FROM "CommerceOffer" WHERE "id"='offer-b'`.then(x => x[0]);
    const aUp = await reprice(aNow, 12000), bUp = await reprice(bNow, 26000);
    let run = await cron(); assert.equal(run.status, 200, JSON.stringify(run.data));
    let jobs = await sql`SELECT * FROM "NotificationJob" WHERE "userId"=${sara.id} AND "template"='price_increase'`;
    assert.equal(jobs.length, 2, 'inbox + (opted-in? no) -> inbox only; two changes without a window are two messages: ' + JSON.stringify(jobs.map(j => j.channel)));
    jobs = await sql`SELECT * FROM "NotificationJob" WHERE "userId"=${sara.id}`; assert(jobs.every(j => j.channel === 'inbox'), 'email needs opt-in');
    assert(jobs.every(j => j.status === 'SENT')); const inbox = await sql`SELECT "body" FROM "ServiceInbox" WHERE "userId"=${sara.id} AND "body"->>'referenceType'='CART'`;
    assert.equal(inbox.length, 2); assert.match(inbox[0].body.titleAr, /ارتفع/);
    run = await cron(); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "ServiceInbox" WHERE "userId"=${sara.id} AND "body"->>'referenceType'='CART'`)[0].n, 2, 'a second run sends nothing again');
    // grouping window: two increases inside one window become ONE message listing both
    await call('/api/admin/notification-settings', 'PATCH', { settings: { price: { groupWindowMinutes: 30 } } }, cBoss); const windowSince = new Date();
    const f1 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(5), time: '09:00', durationMinutes: 60 }, reuse: false }, cNoura));
    const f2 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-b', config: { offerId: 'offer-b', cityId: 'riyadh', date: day(5), time: '12:00', durationMinutes: 60 }, reuse: false }, cNoura));
    must(await call(`/api/booking-drafts/${f1.id}/add-to-cart`, 'POST', undefined, cNoura)); must(await call(`/api/booking-drafts/${f2.id}/add-to-cart`, 'POST', undefined, cNoura));
    const aUp2 = await reprice(aUp, 14000); await reprice(bUp, 30000);
    await cron(); const grouped = await sql`SELECT * FROM "NotificationJob" WHERE "userId"=${noura.id} AND "template"='price_increase' ORDER BY "createdAt" DESC LIMIT 1`;
    assert.equal(grouped.length, 1); assert.equal(grouped[0].payload.changes.length, 2, 'both changes in one window share one message'); assert.equal(grouped[0].status, 'PENDING', 'held until the window ends');
    const jobCount = async () => (await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob"`)[0].n, inboxCount = async () => (await sql`SELECT COUNT(*)::int AS n FROM "ServiceInbox"`)[0].n;
    const jc = await jobCount(); await sqlx`UPDATE "DomainOutbox" SET "status"='PENDING',"nextAttemptAt"=CURRENT_TIMESTAMP WHERE "occurredAt" >= ${windowSince}`; await cron();
    assert.equal(await jobCount(), jc, 'replaying every event adds no duplicate job'); assert.equal((await sql`SELECT jsonb_array_length("payload"->'changes')::int AS n FROM "NotificationJob" WHERE "id"=${grouped[0].id}`)[0].n, 2, 'and does not repeat a change inside the grouped message'); void inboxCount;
    // sending rechecks: the customer acknowledged in the meantime, so the message would be stale
    await call(`/api/cart/items/${f1.id}/acknowledge-price`, 'POST', undefined, cNoura); await call(`/api/cart/items/${f2.id}/acknowledge-price`, 'POST', undefined, cNoura);
    await sqlx`UPDATE "NotificationJob" SET "scheduledAt"=CURRENT_TIMESTAMP - interval '1 minute' WHERE "id"=${grouped[0].id}`;
    await cron(); const rechecked = (await sql`SELECT "status","lastError" FROM "NotificationJob" WHERE "id"=${grouped[0].id}`)[0];
    assert.equal(rechecked.status, 'SKIPPED'); assert.equal(rechecked.lastError, 'nothing_to_report');
    ok('price changes become outbox events, then jobs: grouped inside the window, never duplicated, rechecked at send time, email only with opt-in');

    // ================================================================= 9. abandoned-cart reminders: stages, recheck, language, consent, retries
    // "time passes": the cart's last activity moves into the past, and the keys of reminders already queued for it move with it (the activity itself did not change)
    const setIdle = async (userId, hours) => {
      const before = new Date((await sql`SELECT "lastActivityAt" FROM "CommerceCart" WHERE "userId"=${userId}`)[0].lastActivityAt).getTime(), after = Date.now() - hours * 3600000;
      await sqlx`UPDATE "CommerceCart" SET "lastActivityAt"=${new Date(after)} WHERE "userId"=${userId}`;
      await sqlx`UPDATE "NotificationJob" SET "dedupKey"=replace("dedupKey",${':' + before + ':'},${':' + Math.round(after) + ':'}),"payload"=jsonb_set("payload",'{activityAt}',to_jsonb(${Math.round(after)}::bigint)) WHERE "userId"=${userId} AND "template"='cart_reminder' AND ("payload"->>'activityAt')::bigint=${before}`;
    };
    const g1 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(6), time: '09:00', durationMinutes: 60 }, reuse: false }, cFaisal));
    await sqlx`UPDATE "CommerceCart" SET "locale"='en' WHERE "userId"=${faisal.id}`;
    const cartF = await getCart(cFaisal); const keepLines = cartF.cart.body.lines;
    must(await call('/api/booking-drafts/' + g1.id + '/add-to-cart', 'POST', undefined, cFaisal));
    await sqlx`UPDATE "CommerceCart" SET "locale"='en' WHERE "userId"=${faisal.id}`;
    await setIdle(faisal.id, 2); await cron();
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${faisal.id} AND "template"='cart_reminder'`)[0].n, 0, 'too early: no reminder');
    await setIdle(faisal.id, 25); await cron();
    let rem = await sql`SELECT * FROM "NotificationJob" WHERE "userId"=${faisal.id} AND "template"='cart_reminder' ORDER BY "createdAt"`;
    assert.equal(rem.length, 1); assert.equal(rem[0].status, 'SENT'); assert.equal(rem[0].payload.stage, 0);
    const msg = (await sql`SELECT "body" FROM "ServiceInbox" WHERE "userId"=${faisal.id} AND "event"='CART:cart_reminder'`)[0].body;
    assert.match(msg.titleAr, /still waiting/i, 'written in the language the customer used (English)');
    await cron(); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${faisal.id} AND "template"='cart_reminder'`)[0].n, 1, 'the same stage is sent once');
    await setIdle(faisal.id, 73); await cron(); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${faisal.id} AND "template"='cart_reminder' AND "status"='SENT'`)[0].n, 2, 'second stage after 72 hours');
    await setIdle(faisal.id, 200); await cron(); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${faisal.id} AND "template"='cart_reminder'`)[0].n, 2, 'no third stage unless the administrator configures one');
    // returning customers and emptied carts are rechecked at send time
    const oldJob = randomUUID();
    await sqlx`INSERT INTO "NotificationJob" ("id","userId","template","channel","dedupKey","payload") VALUES (${oldJob},${faisal.id},'cart_reminder','inbox','manual-1','{"stage":0,"activityAt":1}'::jsonb)`;
    await cron(); assert.equal((await sql`SELECT "status","lastError" FROM "NotificationJob" WHERE "id"=${oldJob}`)[0].lastError, 'customer_returned');
    await sqlx`DELETE FROM "NotificationJob" WHERE "userId"=${noura.id}`;
    // consent + email: opt in, a mock provider, a failure and a recovery
    await call('/api/notifications/preferences', 'PUT', { email: true }, cNoura);
    assert.deepEqual(must(await call('/api/notifications/preferences', 'GET', undefined, cNoura)), { inbox: true, email: true, hasEmail: true });
    assert.equal((await call('/api/notifications/preferences', 'PUT', { email: true }, cFaisal)).status, 400, 'no email address on file');
    const n1 = must(await call('/api/booking-drafts', 'POST', { serviceId: 'svc-a', config: { offerId: 'offer-a', cityId: 'riyadh', date: day(7), time: '09:00', durationMinutes: 60 }, reuse: false }, cNoura));
    must(await call(`/api/booking-drafts/${n1.id}/add-to-cart`, 'POST', undefined, cNoura)); await setIdle(noura.id, 25);
    mailMode = 'fail'; await cron();
    let nj = await sql`SELECT * FROM "NotificationJob" WHERE "userId"=${noura.id} AND "template"='cart_reminder' AND "channel"='email'`;
    assert.equal(nj.length, 1); assert.equal(nj[0].status, 'PENDING'); assert.equal(nj[0].retryCount, 1); assert.match(nj[0].lastError, /provider_500/);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationAttempt" WHERE "jobId"=${nj[0].id} AND "status"='FAILED'`)[0].n, 1);
    assert((await getCart(cNoura)).cart.body.lines.some(l => l.id === n1.id), 'a delivery failure never touches the cart');
    mailMode = 'ok'; await sqlx`UPDATE "NotificationJob" SET "scheduledAt"=CURRENT_TIMESTAMP - interval '1 minute' WHERE "id"=${nj[0].id}`; await cron();
    nj = await sql`SELECT * FROM "NotificationJob" WHERE "id"=${nj[0].id}`; assert.equal(nj[0].status, 'SENT'); assert.equal(mailbox.length >= 1, true); assert.equal(mailbox.at(-1).to[0], 'noura@test.local');
    await sqlx`UPDATE "NotificationJob" SET "status"='PENDING',"retryCount"=4,"scheduledAt"=CURRENT_TIMESTAMP - interval '1 minute',"dedupKey"="dedupKey"||'-x' WHERE "id"=${nj[0].id}`;
    mailMode = 'fail'; await cron(); assert.equal((await sql`SELECT "status" FROM "NotificationJob" WHERE "id"=${nj[0].id}`)[0].status, 'DEAD', 'after the last retry the job is parked, not retried forever'); mailMode = 'ok';
    ok('reminders follow the configured stages once each, are written in the customer language, are rechecked when sent, honour consent, and email failures retry then park without touching the cart');

    // ================================================================= 10. administration
    for (const [method, route, payload] of [['GET', '/api/admin/booking-analytics'], ['GET', '/api/admin/abandoned-carts'], ['GET', '/api/admin/price-change-events'], ['GET', '/api/admin/notification-settings'], ['GET', '/api/admin/notification-jobs'], ['PATCH', '/api/admin/notification-settings', { settings: {} }]]) {
      assert.equal((await call(route, method, payload, cNoura)).status, 403, route + ' is for administrators'); assert.equal((await call(route, method, payload)).status, 401);
    }
    const an = must(await call('/api/admin/booking-analytics', 'GET', undefined, cBoss));
    assert(an.carts.pending + an.carts.abandoned >= 3); assert(an.priceChanges.increases.count >= 4); assert(an.priceChanges.decreases.count >= 1); assert(an.reminders.sent >= 3); assert(an.drafts.PURCHASED >= 1);
    assert.match(an.note, /never included in revenue/); assert(an.checkout.ordersCreated >= 2); assert.equal(an.carts.abandonAfterHours, 24);
    assert(an.carts.pendingValueHalala + an.carts.abandonedValueHalala > 0, 'cart value is reported, separately from sales');
    const byCity = must(await call('/api/admin/booking-analytics?cityId=jeddah', 'GET', undefined, cBoss)); assert.equal(byCity.carts.pending + byCity.carts.abandoned, 0, 'filters apply');
    const ab = must(await call('/api/admin/abandoned-carts', 'GET', undefined, cBoss)); assert(ab.carts.some(x => x.userId === faisal.id && x.remindersSent === 2));
    const pc = must(await call('/api/admin/price-change-events?direction=DECREASE', 'GET', undefined, cBoss)); assert(pc.events.length >= 1 && pc.events.every(e => e.direction === 'DECREASE'));
    assert.equal((await call('/api/admin/price-change-events?direction=SIDEWAYS', 'GET', undefined, cBoss)).status, 400);
    const nj2 = must(await call('/api/admin/notification-jobs?status=DEAD', 'GET', undefined, cBoss)); assert(nj2.jobs.length >= 1);
    assert.equal((await call('/api/admin/notification-settings', 'PATCH', { settings: { reminders: { stagesHours: [48, 24] } } }, cBoss)).status, 400, 'stages must increase');
    assert.equal((await call('/api/admin/notification-settings', 'PATCH', { settings: { reminders: { stagesHours: [0] } } }, cBoss)).status, 400);
    assert.equal((await call('/api/admin/notification-settings', 'PATCH', { settings: { templates: { bogus: {} } } }, cBoss)).status, 400);
    const saved = must(await call('/api/admin/notification-settings', 'PATCH', { settings: { reminders: { stagesHours: [2, 6], finalHours: 12 }, templates: { cart_reminder: { ar: { title: 'عنوان مخصص' } } } } }, cBoss));
    assert.deepEqual(saved.settings.reminders.stagesHours, [2, 6]); assert.equal(saved.settings.reminders.finalHours, 12);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "SystemAuditLog" WHERE "action"='CART_NOTIFICATION_SETTINGS_CHANGED'`)[0].n >= 3, true, 'settings changes are audited');
    ok('administrator endpoints are role-protected, report cart value apart from sales, filter, validate settings and audit changes');

    // ================================================================= 11. pricing quote and retention
    const q = must(await raw('/api/pricing/quote', 'POST', { offerId: 'offer-a', cityId: 'riyadh', date: day(8), time: '09:00', durationMinutes: 60, quantity: 1, guestCount: 1 }));
    assert(q.quote.totals.total > 0); assert.equal((await raw('/api/pricing/quote', 'POST', { offerId: 'offer-a', cityId: 'jeddah', date: day(8), time: '09:00' })).status, 409);
    await sqlx`UPDATE "BookingDraft" SET "expiresAt"=CURRENT_TIMESTAMP - interval '1 day' WHERE "id"=${dc.id}`; await cron();
    assert.equal((await sql`SELECT "status" FROM "BookingDraft" WHERE "id"=${dc.id}`)[0].status, 'EXPIRED'); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "BookingSnapshot" WHERE "draftId"=${dc.id}`)[0].n, 2, 'expired drafts keep their history');
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "BookingDraft" WHERE "status"='IN_CART'`)[0].n >= 1, true);
    ok('the server prices a configuration on request; idle drafts expire without losing their history or anything in a cart');
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    if (mail) mail.close();
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS booking drafts: ${results.length} groups of checks`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-2500)); process.exitCode = 1; });
