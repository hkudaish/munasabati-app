// Availability management, end to end: a throwaway schema in the LOCAL database and a separate Next server.
// npm run test:availability
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'avail_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const dist = '.next-av-test-' + process.pid, tsconfig = '.av-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3114, BASE = 'http://127.0.0.1:' + PORT;
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: 'development' };
const db = new PrismaClient({ datasourceUrl: url.toString() });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, logs = '';
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };
async function call(route, method = 'GET', data, cookie) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, data: json };
}
const must = r => (assert.equal(r.status, 200, JSON.stringify(r.data)), r.data);
const session = async user => { const token = randomBytes(32).toString('base64url'); await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } }); return 'munasabati_session=' + token; };
const day = n => new Date(Date.now() + (40 + n) * 86400000).toISOString().slice(0, 10);

(async () => {
  try {
    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    // the migration adds what db push cannot: check constraints, the append-only trigger and the non-overlap indexes
    r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', 'prisma/sql/20261022-availability-policies.sql'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    await require('./seed-geography.cjs').seedGeography(db);
    const region = (id, en, ar) => db.geoRegion.upsert({ where: { id }, create: { id, countryCode: 'SA', nameAr: ar, nameEn: en }, update: {} });
    await region('r-riyadh', 'Riyadh Region', 'منطقة الرياض'); await region('r-makkah', 'Makkah Region', 'منطقة مكة'); await region('r-east', 'Eastern Region', 'المنطقة الشرقية');
    const cityRow = (id, ar, en, regionId) => ({ id, nameAr: ar, nameEn: en, regionAr: ar, regionId, countryCode: 'SA', isAvailable: true, defaultAvailable: true });
    for (const c of [cityRow('riyadh', 'الرياض', 'Riyadh', 'r-riyadh'), cityRow('jeddah', 'جدة', 'Jeddah', 'r-makkah'), cityRow('dammam', 'الدمام', 'Dammam', 'r-east')]) await db.saudiCity.upsert({ where: { id: c.id }, create: c, update: { regionId: c.regionId, countryCode: 'SA', isAvailable: true, defaultAvailable: true } });
    await db.geoCountry.update({ where: { code: 'SA' }, data: { enabled: true } });

    const mk = (name, phone, role, extra = {}) => db.user.create({ data: { name, phone, role, ...extra } });
    const customers = []; for (let i = 0; i < 8; i++) customers.push(await mk('عميل ' + i, '05001000' + i + '0', 'CLIENT'));
    const vendorUser = await mk('مورد', '0500200001', 'VENDOR'), adminUser = await mk('إداري', '0500200002', 'ADMIN'), root = await mk('مدير النظام', '0500200003', 'SUPER_ADMIN');
    const vendor = await db.vendor.create({ data: { userId: vendorUser.id, businessName: 'مورد الاختبار', businessNameEn: 'T', categoryId: 'entertainment', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: vendorUser.phone, whatsappNumber: vendorUser.phone, status: 'ACTIVE', verified: true } });
    const cc = []; for (const c of customers) cc.push(await session(c));
    const cVendor = await session(vendorUser), cAdmin = await session(adminUser), cRoot = await session(root);

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ---- the catalogue: one bookable service in three cities, one digital service ----
    const serviceBody = { titleAr: 'خدمة اختبار الإتاحة', descriptionAr: 'وصف', kind: 'BOOKABLE', categoryId: 'entertainment', subcategoryId: null, artistId: null, cities: ['riyadh', 'jeddah', 'dammam'], managerIds: [vendorUser.id], resourceIds: [], published: true, approved: true, images: [], videoUrls: [] };
    const svc = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'av-service', body: serviceBody }, cRoot)).entity;
    const digital = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'av-digital', body: { ...serviceBody, titleAr: 'دعوة رقمية', kind: 'DIGITAL', cities: ['riyadh'] } }, cRoot)).entity;
    const policyBody = { baseAmount: 10000, bookingMode: 'DIRECT', durationMinutes: 60, minDurationMinutes: 30, maxDurationMinutes: 600, depositBps: 0, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 10000, beforeHours: 0 }], calendar: { minNoticeHours: 0, bufferMinutes: 0 } };
    const offer = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'av-offer', serviceId: svc.id, body: { nameAr: 'عرض', model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 15, policy: policyBody } }, cRoot)).entity;
    const digitalOffer = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'av-digital-offer', serviceId: digital.id, body: { nameAr: 'عرض رقمي', model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 0, policy: { ...policyBody, bookingMode: 'DIRECT' } } }, cRoot)).entity;
    const line = (offerId, time, over = {}) => ({ id: randomBytes(8).toString('hex'), offerId, cityId: 'riyadh', date: day(0), time, durationMinutes: 60, quantity: 1, guestCount: 1, fields: {}, options: [], ...over });
    const cartFor = async (lines, cookie) => { const old = must(await call('/api/commerce/cart', 'GET', undefined, cookie)); return call('/api/commerce/cart', 'PUT', { version: old.cart.version, lines }, cookie); };
    const buy = async (cart, cookie, key = randomBytes(16).toString('hex')) => call('/api/commerce/orders', 'POST', { cartVersion: cart.cart.version, quoteHash: cart.quote.hash, idempotencyKey: key, acceptTerms: true }, cookie);
    /** the whole customer path: cart, then order. Returns the first refusal, or the order. */
    const book = async (who, lineSpec) => { const c = await cartFor([lineSpec], cc[who]); if (c.status !== 200) return { stage: 'cart', ...c }; const o = await buy(c.data, cc[who]); return { stage: 'order', ...o }; };
    const policies = (cookie = cRoot, q = '') => call('/api/system-admin/availability' + q, 'GET', undefined, cookie);
    const create = (policy, cookie = cRoot) => call('/api/system-admin/availability', 'POST', policy, cookie);
    const update = (id, version, policy, cookie = cRoot) => call('/api/system-admin/availability', 'PATCH', { id, expectedVersion: version, policy }, cookie);
    const resolveFor = (q) => call('/api/availability/resolve?' + new URLSearchParams(q).toString());
    const clearPolicies = async () => { await db.availabilityGeoRule.deleteMany({}); await db.availabilitySchedule.deleteMany({}); await db.availabilityPolicy.deleteMany({}); };

    // baseline: with no policy at all everything works as before
    let first = await book(0, line(offer.id, '08:00', { date: day(0) }));
    assert.equal(first.status, 200, JSON.stringify(first.data)); const baselineOrder = first.data.order;
    assert.equal((await book(1, line(digitalOffer.id, '', { date: '', quantity: 1, cityId: 'riyadh' }))).status, 200, 'a digital service can be bought');
    ok('with no policy configured, booking works exactly as before (physical and digital)');

    // ---- permissions ----
    const draft = { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'ACTIVE' };
    assert.equal((await create(draft, null)).status, 401);
    for (const [who, cookie] of [['customer', cc[0]], ['vendor', cVendor]]) { assert.equal((await policies(cookie)).status, 403, who + ' cannot read'); assert.equal((await create(draft, cookie)).status, 403, who + ' cannot write'); }
    assert.equal((await policies(cAdmin)).status, 200, 'an administrator can read');
    assert.equal((await create(draft, cAdmin)).status, 403, 'only the system administrator can change policies');
    assert.equal((await call('/api/system-admin/availability/matrix', 'GET', undefined, cc[0])).status, 403);
    assert.equal((await call('/api/system-admin/availability/preview', 'POST', { serviceId: svc.id }, cVendor)).status, 403);
    assert.equal((await call('/api/system-admin/availability/bulk', 'POST', { dryRun: false }, cAdmin)).status, 403);
    assert.equal((await call('/api/system-admin/public-stats', 'PUT', { cards: [] }, cAdmin)).status, 403);
    assert.equal((await call('/api/system-admin/availability/audit', 'GET', undefined, cc[0])).status, 403);
    assert.equal(await db.availabilityPolicy.count(), 0, 'nothing was created by the refused requests');
    ok('only the system administrator can change policies; administrators can read; customers, vendors and visitors are refused');

    // ---- validation, versions, transitions, overlaps, hierarchy of places ----
    assert.equal((await create({ ...draft, entityId: 'does-not-exist' })).status, 404);
    assert.equal((await create({ entityType: 'GALAXY', entityId: 'x' })).status, 400);
    assert.equal((await create({ ...draft, configuredStatus: 'PARTIALLY_AVAILABLE' })).status, 400, 'partial needs a restriction');
    assert.equal((await create({ ...draft, configuredStatus: 'TEMPORARILY_SUSPENDED' })).status, 400, 'suspension needs a reason');
    assert.equal((await create({ ...draft, restrictionConfig: { evil: 1 }, bookingMode: 'CONDITIONAL' })).status, 400);
    assert.equal((await create({ ...draft, geoRules: [{ cityId: 'riyadh', regionId: 'r-east', geographicEffect: 'DENY' }] })).status, 400, 'a city must belong to its region');
    assert.equal((await create({ ...draft, geoRules: [{ cityId: 'nowhere', geographicEffect: 'DENY' }] })).status, 400);
    assert.equal((await create({ entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'ACTIVE', publicMessage: { ar: 'x'.repeat(301) } })).status, 400);
    const created = must(await create({ ...draft, configuredStatus: 'ACTIVE', priority: 0, publicMessage: { ar: 'متاحة', en: 'Available' } })).policy;
    assert.equal(created.version, 1);
    assert.equal((await create({ ...draft })).status, 409, 'two open-ended policies of one entity at one priority would be ambiguous');
    const overlapSecond = await create({ ...draft, priority: 1, effectiveFrom: '2030-01-01T00:00:00Z', effectiveUntil: '2030-02-01T00:00:00Z' });
    assert.equal(overlapSecond.status, 200, 'a different priority and window is fine');
    assert.equal((await create({ ...draft, priority: 1, effectiveFrom: '2030-01-15T00:00:00Z', effectiveUntil: '2030-03-01T00:00:00Z' })).status, 409, 'overlapping window at the same priority');
    const v2 = must(await update(created.id, 1, { ...draft, configuredStatus: 'DISABLED', reason: 'مراجعة' })).policy;
    assert.equal(v2.version, 2); assert.equal(v2.configuredStatus, 'DISABLED');
    assert.equal((await update(created.id, 1, { ...draft, configuredStatus: 'ACTIVE' })).status, 409, 'a stale version is refused');
    assert.equal((await update(created.id, 2, { ...draft, configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'x' })).status, 409, 'DISABLED cannot jump to TEMPORARILY_SUSPENDED');
    assert.equal((await update(created.id, 2, { ...draft, configuredStatus: 'ACTIVE' })).status, 200, 'but can be restored');
    // two administrators editing at the same instant: exactly one wins
    const cur = (await policies()).data.policies.find(p => p.id === created.id);
    const race = await Promise.all([update(created.id, cur.version, { ...draft, configuredStatus: 'DISABLED', reason: 'أ' }), update(created.id, cur.version, { ...draft, configuredStatus: 'DISABLED', reason: 'ب' })]);
    assert.deepEqual(race.map(x => x.status).sort(), [200, 409], 'concurrent edits cannot both apply');
    await update(created.id, (await policies()).data.policies.find(p => p.id === created.id).version, { ...draft, configuredStatus: 'ACTIVE' });
    { const now = (await policies()).data.policies.find(p => p.id === created.id); assert.equal((await update(created.id, now.version, { ...draft, configuredStatus: 'ACTIVE', publicMessage: { ar: 'رسالة جديدة' } })).status, 200, 'a change that keeps the status'); }
    ok('validation, entity checks, place hierarchy, version control, allowed transitions, overlap rules and concurrent edits');
    await clearPolicies();

    // ---- global and module control: customers are stopped, existing orders stay manageable ----
    const platform = must(await create({ entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'MAINTENANCE', publicMessage: { ar: 'صيانة مجدولة للمنصة', en: 'Scheduled maintenance' } })).policy;
    let blocked = await book(2, line(offer.id, '10:00', { date: day(1) }));
    assert.equal(blocked.stage, 'cart'); assert([403, 409].includes(blocked.status), String(blocked.status)); assert(blocked.data.reasonCodes.includes('STATUS_MAINTENANCE')); assert.equal(blocked.data.error, 'صيانة مجدولة للمنصة');
    const resolved = (await resolveFor({ offerId: offer.id, cityId: 'riyadh', date: day(1), time: '10:00' })).data;
    assert.equal(resolved.canBook, false); assert.equal(resolved.effectiveStatus, 'MAINTENANCE'); assert.equal(resolved.message.en, 'Scheduled maintenance'); assert(!('trace' in resolved)); assert(!JSON.stringify(resolved).includes(platform.id), 'no policy ids for the public');
    assert.equal((await book(2, line(digitalOffer.id, '', { date: '' }))).status === 200, false, 'digital purchases are also stopped');
    // an order made earlier can still be viewed by its owner and confirmed by an administrator
    assert.equal((await call('/api/commerce/orders?id=' + baselineOrder.id, 'GET', undefined, cc[0])).status, 200, 'customers can still see their orders during maintenance');
    const catalog = (await call('/api/commerce/catalog')).data;
    const listed = catalog.services.find(s => s.id === svc.id);
    assert(listed, 'a service under platform maintenance stays visible'); assert.equal(listed.availability.riyadh.s, 'MAINTENANCE'); assert.equal(listed.availability.riyadh.b, false);
    await db.availabilityPolicy.delete({ where: { id: platform.id } });
    ok('platform maintenance stops new transactions with a clear bilingual message, keeps the service listed and existing orders viewable');

    // ---- a service: suspended / coming soon / disabled ----
    const base1 = await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'مراجعة المعدات', suspensionPolicy: { expectedResumeDate: '2030-01-01' } } });
    let r1 = await book(2, line(offer.id, '11:00', { date: day(2) }));
    assert.equal(r1.stage, 'cart'); assert(r1.data.reasonCodes.includes('STATUS_TEMPORARILY_SUSPENDED'));
    assert.equal((await call('/api/commerce/catalog')).data.services.find(s => s.id === svc.id).availability.riyadh.s, 'TEMPORARILY_SUSPENDED');
    // existing bookings under suspension follow the suspension policy
    assert.notEqual((await book(3, line(offer.id, '12:00', { date: day(3) }))).status, 200, 'cannot start a new booking while suspended');
    await db.availabilityPolicy.delete({ where: { id: base1.id } });
    const heldBookings = {}; for (const [who, time] of [[3, '12:00'], [4, '14:00'], [5, '16:00']]) { const h = await book(who, line(offer.id, time, { date: day(3) })); assert.equal(h.status, 200, JSON.stringify(h.data)); heldBookings[who] = h.data.order; }
    const confirmAll = (id, version, cookie) => call('/api/commerce/orders', 'PATCH', { id, version, action: 'CONFIRM_ALL' }, cookie);
    const orderById = async (id) => (await call('/api/commerce/orders', 'GET', undefined, cRoot)).data.orders.find(o => o.id === id);
    const fresh = async who => { const o = await orderById(heldBookings[who].id); return { id: o.id, version: o.version, state: o.items[0].body.status }; };
    const suspendedWith = existingBookings => db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'توقف', suspensionPolicy: { existingBookings } } });
    assert.equal((await fresh(3)).state, 'READY_TO_CONFIRM');
    let pol = await suspendedWith('CONTINUE'); let o3 = await fresh(3);
    let res = await confirmAll(o3.id, o3.version, cc[3]); assert.equal(res.status, 200, 'CONTINUE: an existing booking can still be confirmed: ' + JSON.stringify(res.data)); assert.equal((await fresh(3)).state, 'CONFIRMED');
    await db.availabilityPolicy.delete({ where: { id: pol.id } }); pol = await suspendedWith('BLOCK'); let o4 = await fresh(4);
    res = await confirmAll(o4.id, o4.version, cRoot); assert([403, 409].includes(res.status), 'BLOCK: even an administrator cannot confirm: ' + res.status); assert.equal((await fresh(4)).state, 'READY_TO_CONFIRM');
    await db.availabilityPolicy.delete({ where: { id: pol.id } }); pol = await suspendedWith('REVIEW');
    res = await confirmAll(o4.id, o4.version, cc[4]); assert([403, 409].includes(res.status), 'REVIEW: the customer is stopped');
    res = await confirmAll(o4.id, o4.version, cRoot); assert.equal(res.status, 200, 'REVIEW: an administrator can continue: ' + JSON.stringify(res.data)); assert.equal((await fresh(4)).state, 'CONFIRMED');
    await db.availabilityPolicy.delete({ where: { id: pol.id } });
    // platform maintenance: customers wait, administrators keep controlled access to existing bookings
    const pm = await db.availabilityPolicy.create({ data: { entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'MAINTENANCE' } }); let o5 = await fresh(5);
    res = await confirmAll(o5.id, o5.version, cc[5]); assert([403, 409].includes(res.status), 'maintenance: customers cannot confirm'); assert.equal((await book(6, line(offer.id, '08:00', { date: day(3) }))).status === 200, false, 'and nobody starts a NEW booking');
    res = await confirmAll(o5.id, o5.version, cRoot); assert.equal(res.status, 200, 'maintenance: an administrator keeps controlled access: ' + JSON.stringify(res.data));
    await db.availabilityPolicy.delete({ where: { id: pm.id } });
    await clearPolicies();
    const comingSoon = await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'COMING_SOON', restrictionConfig: { launchDate: '2031-01-01' } } });
    const cs = await book(2, line(offer.id, '13:00', { date: day(4) })); assert.equal(cs.stage, 'cart'); assert(cs.data.reasonCodes.includes('STATUS_COMING_SOON'));
    const csList = (await call('/api/commerce/catalog')).data.services.find(s => s.id === svc.id);
    assert.equal(csList.availability.riyadh.s, 'COMING_SOON'); assert.equal(csList.availability.riyadh.l, '2031-01-01'); assert.equal(csList.availability.riyadh.b, false);
    // interest registration
    const interest = body => call('/api/availability/interest', 'POST', body, cc[2]);
    assert.equal((await interest({ serviceId: svc.id, cityId: 'riyadh', consent: false })).status, 400, 'consent is required');
    assert.equal((await call('/api/availability/interest', 'POST', { serviceId: svc.id, cityId: 'riyadh', consent: true })).status, 401);
    assert.equal((await interest({ serviceId: svc.id, cityId: 'riyadh', consent: true, contactPreference: 'WHATSAPP' })).data.already, false);
    assert.equal((await interest({ serviceId: svc.id, cityId: 'riyadh', consent: true })).data.already, true, 'no duplicate registrations');
    assert.equal(await db.availabilityInterest.count({ where: { serviceId: svc.id, cityId: 'riyadh' } }), 1);
    assert.equal((await call('/api/availability/interest', 'GET', undefined, cc[2])).data.interests.length, 1);
    assert.equal((await call('/api/availability/interest', 'DELETE', { serviceId: svc.id, cityId: 'riyadh' }, cc[2])).data.cancelled, true);
    assert.equal((await call('/api/availability/interest', 'GET', undefined, cc[2])).data.interests.length, 0);
    assert.equal((await interest({ serviceId: svc.id, cityId: 'riyadh', consent: true })).data.already, false, 're-registering after cancelling works');
    assert.equal((await call('/api/system-admin/availability/interest', 'GET', undefined, cRoot)).data.rows[0].count, 1);
    await db.availabilityPolicy.delete({ where: { id: comingSoon.id } });
    assert.equal((await interest({ serviceId: svc.id, cityId: 'riyadh', consent: true })).status, 409, 'no interest registration for a service that can be booked');
    await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'DISABLED', reason: 'x' } });
    const gone = (await call('/api/commerce/catalog')).data.services.find(s => s.id === svc.id);
    assert.equal(gone, undefined, 'a disabled service leaves the public catalogue');
    assert.equal((await resolveFor({ serviceId: svc.id, cityId: 'riyadh' })).data.isVisible, false);
    assert.equal((await book(2, line(offer.id, '14:00', { date: day(5) }))).stage, 'cart');
    assert.equal((await call('/api/commerce/orders?id=' + heldBookings[3].id, 'GET', undefined, cc[3])).status, 200, 'existing orders of a disabled service stay manageable');
    await clearPolicies();
    ok('suspended, coming-soon (with interest registration) and disabled services behave as specified; existing bookings and records are preserved');

    // ---- partial availability and geography: the event city decides, not the visitor ----
    await create({ entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'PARTIALLY_AVAILABLE', restrictionConfig: { allowedTimeSlots: ['16:00-20:00'] }, publicMessage: { ar: 'متاحة في المساء فقط', en: 'Evenings only' }, geoRules: [{ cityId: 'jeddah', geographicEffect: 'ALLOW' }, { cityId: 'dammam', geographicEffect: 'ALLOW', statusOverride: 'COMING_SOON' }, { cityId: 'riyadh', geographicEffect: 'ALLOW' }] });
    let part = await book(4, line(offer.id, '09:00', { date: day(6) })); assert.equal(part.stage, 'cart'); assert(part.data.reasonCodes.includes('RESTRICTION_TIME_SLOT')); assert.equal(part.status, 409);
    part = await book(4, line(offer.id, '17:00', { date: day(6) })); assert.equal(part.status, 200, JSON.stringify(part.data));
    const jeddahEvent = await book(5, line(offer.id, '17:00', { date: day(7), cityId: 'jeddah' }));
    assert.equal(jeddahEvent.status, 200, 'a customer based in Riyadh books an event in Jeddah: ' + JSON.stringify(jeddahEvent.data));
    assert.equal((await db.serviceRequest.findFirst({ where: { cityId: 'jeddah' } })).cityId, 'jeddah');
    const dammam = await book(5, line(offer.id, '17:00', { date: day(8), cityId: 'dammam' })); assert.equal(dammam.stage, 'cart'); assert(dammam.data.reasonCodes.includes('STATUS_COMING_SOON'), 'Dammam is coming soon for this service');
    const dammamList = (await call('/api/commerce/catalog')).data.services.find(s => s.id === svc.id).availability;
    assert.equal(dammamList.dammam.s, 'COMING_SOON'); assert.equal(dammamList.riyadh.s, 'PARTIALLY_AVAILABLE'); assert.equal(dammamList.jeddah.s, 'PARTIALLY_AVAILABLE');
    // the existing city rule layer still applies (GeoRule), and DENY beats everything at a place
    await db.geoRule.create({ data: { cityId: 'jeddah', serviceId: null, categoryId: 'entertainment', status: 'UNAVAILABLE', reason: 'الفئة غير متاحة في جدة' } });
    const geoBlock = await book(6, line(offer.id, '18:00', { date: day(9), cityId: 'jeddah' })); assert.equal(geoBlock.stage, 'cart'); assert.equal(geoBlock.status, 403);
    assert.equal((await book(6, line(digitalOffer.id, '', { date: '', cityId: 'jeddah' }))).status, 200, 'a digital service is not stopped by city coverage rules');
    await db.geoRule.deleteMany({});
    await clearPolicies();
    ok('partial availability restrictions, the service/event city (not the visitor) deciding coverage, coming-soon cities, and the existing city rules');

    // ---- capacity is its own dimension ----
    const cap = must(await create({ entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'ACTIVE', schedules: [{ kind: 'OPERATING', maxBookings: 2 }] })).policy;
    const date = day(12);
    assert.equal((await book(0, line(offer.id, '08:00', { date }))).status, 200);
    let near = (await resolveFor({ offerId: offer.id, cityId: 'riyadh', date, time: '10:00' })).data; assert.equal(near.capacityStatus, 'LIMITED'); assert.equal(near.canBook, true);
    assert.equal((await book(1, line(offer.id, '10:00', { date }))).status, 200);
    const full = await book(2, line(offer.id, '12:00', { date }));
    assert.equal(full.status, 409, JSON.stringify(full.data)); assert(full.data.reasonCodes.includes('CAPACITY_REACHED'));
    const fullView = (await resolveFor({ offerId: offer.id, cityId: 'riyadh', date, time: '12:00' })).data;
    assert.equal(fullView.configuredStatus, 'ACTIVE'); assert.equal(fullView.effectiveStatus, 'ACTIVE'); assert.equal(fullView.capacityStatus, 'FULL'); assert.equal(fullView.canBook, false); assert.equal(fullView.isVisible, true);
    assert.equal((await resolveFor({ offerId: offer.id, cityId: 'riyadh', date: day(13), time: '12:00' })).data.canBook, true, 'another day is open');
    const matrixRow = (await call('/api/system-admin/availability/matrix', 'GET', undefined, cRoot)).data.rows.find(x => x.serviceId === svc.id);
    assert.equal(matrixRow.cells.riyadh.s, 'ACTIVE', 'the administrator view still shows ACTIVE for a full service');
    // a cancelled booking frees its place
    const firstItem = (await db.serviceRequest.findMany({ where: { cityId: 'riyadh' }, orderBy: { createdAt: 'asc' } })).find(x => x.startAt.toISOString().startsWith(date));
    await db.serviceRequest.update({ where: { id: firstItem.id }, data: { status: 'CANCELLED' } });
    assert.equal((await book(2, line(offer.id, '12:00', { date }))).status, 200, 'a cancelled booking no longer counts');
    // simultaneous bookings never exceed the cap
    const raceDate = day(20);
    const carts = []; for (let i = 0; i < 6; i++) carts.push(must(await cartFor([line(offer.id, `${String(6 + i * 2).padStart(2, '0')}:00`, { date: raceDate })], cc[i])));
    const settled = await Promise.all(carts.map((c, i) => buy(c, cc[i])));
    const won = settled.filter(x => x.status === 200).length;
    assert.equal(won, 2, 'exactly the capacity wins: ' + settled.map(x => x.status).join(','));
    assert.equal(await db.serviceRequest.count({ where: { startAt: { gte: new Date(raceDate + 'T00:00:00+03:00'), lt: new Date(raceDate + 'T23:59:59+03:00') } } }), 2);
    assert(settled.filter(x => x.status !== 200).every(x => [409, 429, 503].includes(x.status)), 'the losers are refused cleanly');
    await clearPolicies();
    ok('a full service stays ACTIVE but cannot be booked; cancelled bookings free capacity; six simultaneous orders never exceed a cap of two');

    // ---- scheduled activation, schedules and manual overrides ----
    const launching = await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'COMING_SOON', autoActivate: true, restrictionConfig: { launchDate: '2020-01-01' } } });
    assert.equal((await book(7, line(offer.id, '08:00', { date: day(21) }))).status, 200, 'the launch date has passed and the service is ready: it is active');
    await db.availabilityPolicy.create({ data: { entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'TEMPORARILY_SUSPENDED', reason: 'إيقاف يدوي أحدث' } });
    assert.notEqual((await book(7, line(offer.id, '09:00', { date: day(21) }))).status, 200, 'a newer manual suspension is not reversed by the scheduled activation');
    await clearPolicies(); void launching;
    const closed = must(await create({ entityType: 'SERVICE', entityId: svc.id, schedules: [{ kind: 'HOLIDAY', startDate: day(25), endDate: day(26) }, { kind: 'OPERATING', startTime: '08:00', endTime: '22:00' }] })).policy;
    assert.equal((await book(7, line(offer.id, '10:00', { date: day(25) }))).data.reasonCodes?.includes('SCHEDULE_CLOSED'), true);
    assert.equal((await book(7, line(offer.id, '23:00', { date: day(27) }))).data.reasonCodes?.includes('OUTSIDE_OPERATING_HOURS'), true);
    assert.equal((await book(7, line(offer.id, '10:00', { date: day(27) }))).status, 200);
    await db.availabilityPolicy.delete({ where: { id: closed.id } });
    ok('scheduled activation (with readiness), manual suspensions not reversed, holidays and operating hours');

    // ---- vendor and offer layers, packages ----
    await db.availabilityPolicy.create({ data: { entityType: 'VENDOR', entityId: vendor.id, configuredStatus: 'DISABLED', reason: 'x' } });
    assert.equal((await book(7, line(offer.id, '11:00', { date: day(30) }))).stage, 'cart');
    await clearPolicies();
    await db.vendor.update({ where: { id: vendor.id }, data: { status: 'SUSPENDED' } });
    const inactive = await book(7, line(offer.id, '11:00', { date: day(30) })); assert.notEqual(inactive.status, 200);
    await db.vendor.update({ where: { id: vendor.id }, data: { status: 'ACTIVE' } });
    await db.availabilityPolicy.create({ data: { entityType: 'OFFER', entityId: offer.id, configuredStatus: 'DISABLED', reason: 'x' } });
    assert.equal((await book(7, line(offer.id, '11:00', { date: day(30) }))).stage, 'cart', 'a disabled offer cannot be booked');
    await clearPolicies();
    // a package with a required and an optional component
    const hallService = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'av-hall', body: { ...serviceBody, titleAr: 'خدمة اختيارية' } }, cRoot)).entity;
    const optionalOffer = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'av-optional', serviceId: hallService.id, body: { nameAr: 'اختياري', model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 15, policy: policyBody } }, cRoot)).entity;
    const pack = must(await call('/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: 'av-package', body: { nameAr: 'باقة', descriptionAr: 'وصف', published: true, discountBps: 0, kind: 'FIXED', images: [], termsAr: '', budgetMax: 0, fixedTotal: 0 }, items: [{ id: 'av-pi-1', offerId: offer.id, quantity: 1, durationMinutes: 60, offsetMinutes: 0, optional: false, substitutions: [] }, { id: 'av-pi-2', offerId: optionalOffer.id, quantity: 1, durationMinutes: 60, offsetMinutes: 60, optional: true, substitutions: [] }] }, cRoot)).entity;
    const packLine = (time, date) => ({ id: randomBytes(8).toString('hex'), packageId: pack.id, cityId: 'riyadh', date, time, quantity: 1, guestCount: 1, fields: {}, options: [], choices: {} });
    let cartOk = await cartFor([packLine('08:00', day(31))], cc[7]); assert.equal(cartOk.status, 200, JSON.stringify(cartOk.data)); assert.equal(cartOk.data.quote.lines.length, 2);
    await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: hallService.id, configuredStatus: 'DISABLED', reason: 'x' } });
    const withoutOptional = await cartFor([packLine('08:00', day(31))], cc[7]);
    assert.equal(withoutOptional.status, 200, 'an unavailable OPTIONAL component does not stop the package: ' + JSON.stringify(withoutOptional.data)); assert.equal(withoutOptional.data.quote.lines.length, 1, 'it is left out and the price is recalculated');
    assert(withoutOptional.data.quote.totals.total < cartOk.data.quote.totals.total, 'the total follows');
    await clearPolicies();
    await db.availabilityPolicy.create({ data: { entityType: 'SERVICE', entityId: svc.id, configuredStatus: 'DISABLED', reason: 'x' } });
    const withoutRequired = await cartFor([packLine('08:00', day(31))], cc[7]);
    assert.equal(withoutRequired.status, 409, 'an unavailable REQUIRED component stops the package'); assert(withoutRequired.data.unavailableItem);
    const packList = (await call('/api/commerce/catalog')).data.packages.find(p => p.id === pack.id);
    await clearPolicies();
    ok('vendor and offer layers, and packages: required components must be bookable, unavailable optional ones are left out and repriced', packList ? 'package listed' : 'package hidden while its required service is disabled');

    // ---- administration: preview, matrix, bulk, audit, immutability ----
    const preview = (await call('/api/system-admin/availability/preview', 'POST', { offerId: offer.id, cityId: 'riyadh', date: day(40), time: '10:00', hypothetical: [{ entityType: 'CATEGORY', entityId: 'entertainment', configuredStatus: 'DISABLED', reason: 'تجربة' }] }, cAdmin)).data;
    assert.equal(preview.decision.canBook, false); assert(preview.decision.trace.length > 3, 'the administrator sees the reasoning'); assert.equal(await db.availabilityPolicy.count(), 0, 'previewing saves nothing');
    assert.equal((await call('/api/system-admin/availability/preview', 'POST', { offerId: offer.id, cityId: 'riyadh', hypothetical: [{ entityType: 'SERVICE', entityId: 'x', configuredStatus: 'BROKEN' }] }, cAdmin)).status, 400);
    const m = (await call('/api/system-admin/availability/matrix', 'GET', undefined, cAdmin)).data;
    assert.equal(m.cities.length, 3); assert(m.rows.some(x => x.serviceId === svc.id && x.cells.dammam.s === 'ACTIVE'));
    const bulkBody = { targets: [{ entityType: 'SERVICE', entityId: svc.id }], cityIds: ['dammam', 'jeddah'], change: { geographicEffect: 'ALLOW', statusOverride: 'COMING_SOON' }, reason: 'إطلاق تدريجي' };
    const dry = (await call('/api/system-admin/availability/bulk', 'POST', { ...bulkBody, dryRun: true }, cAdmin)).data;
    assert.equal(dry.dryRun, true); assert.equal(dry.affectedCount, 2); assert(dry.affected.every(a => a.before.canBook && !a.after.canBook)); assert.equal(await db.availabilityPolicy.count(), 0, 'a preview changes nothing');
    assert.equal((await call('/api/system-admin/availability/bulk', 'POST', { ...bulkBody, dryRun: false, reason: '' }, cRoot)).status, 400, 'applying needs a reason');
    const applied = must(await call('/api/system-admin/availability/bulk', 'POST', { ...bulkBody, dryRun: false }, cRoot));
    assert.equal(applied.applied, true);
    assert.equal((await resolveFor({ serviceId: svc.id, cityId: 'dammam' })).data.effectiveStatus, 'COMING_SOON'); assert.equal((await resolveFor({ serviceId: svc.id, cityId: 'riyadh' })).data.effectiveStatus, 'ACTIVE');
    await db.availabilityPolicy.create({ data: { entityType: 'CATEGORY', entityId: 'entertainment', configuredStatus: 'DISABLED', reason: 'x' } });
    const conflicting = (await call('/api/system-admin/availability/bulk', 'POST', { targets: [{ entityType: 'SERVICE', entityId: svc.id }], cityIds: ['riyadh'], change: { geographicEffect: 'ALLOW', statusOverride: 'ACTIVE' }, dryRun: true }, cAdmin)).data;
    assert(conflicting.conflicts.some(c => c.code === 'PARENT_PROHIBITS'), 'a parent prohibition is reported as a conflict');
    await db.availabilityPolicy.deleteMany({ where: { entityType: 'CATEGORY' } });
    const audit = (await call('/api/system-admin/availability/audit', 'GET', undefined, cAdmin)).data;
    for (const action of ['POLICY_CREATED', 'STATUS_CHANGED', 'POLICY_UPDATED', 'BULK_APPLIED']) assert(audit.rows.some(x => x.action === action && x.actorId), action + ' is logged with its actor');
    assert((await call('/api/system-admin/availability/audit?entityType=SERVICE&entityId=' + svc.id, 'GET', undefined, cAdmin)).data.rows.every(x => x.entityId === svc.id));
    const logged = await db.availabilityAuditLog.findFirst({ where: { action: 'STATUS_CHANGED' } });
    await assert.rejects(db.$executeRaw`UPDATE "AvailabilityAuditLog" SET "reason" = 'tampered' WHERE "id" = ${logged.id}`, /append-only/);
    await assert.rejects(db.$executeRaw`DELETE FROM "AvailabilityAuditLog" WHERE "id" = ${logged.id}`, /append-only/);
    await assert.rejects(db.$executeRaw`INSERT INTO "AvailabilityPolicy" ("id","entityType","entityId","configuredStatus") VALUES (${randomUUID()},'SERVICE','x','BROKEN')`, /check|violates/i);
    await assert.rejects(db.$executeRaw`INSERT INTO "AvailabilityPolicy" ("id","entityType","entityId","effectiveFrom","effectiveUntil") VALUES (${randomUUID()},'SERVICE','y','2030-02-01','2030-01-01')`, /check|violates/i);
    await clearPolicies();
    assert.equal((await db.availabilityAuditLog.count()) > 0, true, 'deleting policies never deletes their history');
    ok('administration: preview with reasoning, matrix, bulk preview/apply with conflicts, audit log, append-only history and database checks');

    // ---- public statistics ----
    await db.$executeRaw`DELETE FROM "CommerceBooking"`; await db.$executeRaw`DELETE FROM "ServiceReservation"`; await db.$executeRaw`DELETE FROM "ServiceRequest"`; // start the statistics from a known set of records
    const mkOrder = async (id, customer, items) => {
      await db.$executeRaw`INSERT INTO "CommerceOrder" ("id","customerId","number","body","idempotencyKey","requestHash") VALUES (${id},${customer.id},${'ST-' + id},'{}'::jsonb,${'k-' + id},${'h-' + id})`;
      for (const [itemId, status, body, booking] of items) {
        await db.$executeRaw`INSERT INTO "CommerceOrderItem" ("id","orderId","serviceId","offerId","snapshot","body") VALUES (${itemId},${id},${svc.id},${offer.id},'{}'::jsonb,${JSON.stringify({ status, ...body })}::jsonb)`;
        if (booking) { const rid = randomUUID(); await db.$executeRaw`INSERT INTO "ServiceRequest" ("id","customerId","offeringId","status","cityId","startAt","endAt","body","idempotencyKey","requestHash") VALUES (${rid},${customer.id},${offer.id},${status},${body.cityId},now() - interval '40 days',now() - interval '40 days' + interval '1 hour','{}'::jsonb,${'r-' + itemId},${'rh-' + itemId})`; await db.$executeRaw`INSERT INTO "CommerceBooking" ("id","orderItemId","requestId","status","body") VALUES (${randomUUID()},${itemId},${rid},${status},'{}'::jsonb)`; }
      }
    };
    await mkOrder('s1', customers[0], [['s1a', 'COMPLETED', { date: '2026-05-01', cityId: 'riyadh' }, true], ['s1b', 'COMPLETED', { date: '2026-05-01', cityId: 'riyadh' }, true], ['s1c', 'COMPLETED', { date: '2026-06-10', cityId: 'jeddah' }, true], ['s1x', 'CANCELLED', { date: '2026-05-02', cityId: 'riyadh' }, true], ['s1y', 'CONFIRMED', { date: '2026-12-02', cityId: 'riyadh' }, true]]);
    await mkOrder('s2', customers[1], [['s2a', 'COMPLETED', { date: '2026-05-01', cityId: 'riyadh' }, true]]);
    await mkOrder('s3', customers[2], [['s3a', 'COMPLETED', {}, false]]); // a completed digital delivery: a customer served, not an event or a booking
    const tester = await mk('حساب تجريبي', '0500990001', 'CLIENT', { email: 'qa@internal.test' });
    await mkOrder('s4', tester, [['s4a', 'COMPLETED', { date: '2026-05-01', cityId: 'riyadh' }, true]]);
    await db.multiVendorOrder.create({ data: { orderNumber: 'OLD-ST', customerId: customers[3].id, customerName: 'قديم', customerPhone: customers[3].phone, eventDate: '2026-03-01', cityId: 'riyadh', totalSubtotal: 1, totalTax: 0, finalTotal: 1, totalDeposit: 0, paymentMethod: 'BANK_TRANSFER', suborders: { create: { vendorId: vendor.id, vendorName: 'x', vendorLogo: '', subtotal: 1, taxAmount: 0, totalAmount: 1, depositAmount: 0, remainingAmount: 0, bookingNumber: 'OLD-ST-B', status: 'COMPLETED' } } } });
    const stats = async () => Object.fromEntries((await call('/api/public-stats')).data.cards.map(c => [c.id, c.value]));
    let s = await stats();
    assert.deepEqual(s, { events: 4, customers: 4, vendors: 1, services: 3, cities: 3, bookings: 5 }, 'counted from verified records: ' + JSON.stringify(s));
    const publicShape = JSON.stringify((await call('/api/public-stats')).data);
    for (const secret of [customers[0].id, customers[0].phone, vendor.id, 's1a', 'qa@internal.test']) assert(!publicShape.includes(secret), 'the public figures expose no private record');
    // switching a service off changes what is offered NOW, never what was delivered
    await db.availabilityPolicy.create({ data: { entityType: 'CATEGORY', entityId: 'entertainment', configuredStatus: 'DISABLED', reason: 'x' } });
    s = await stats(); assert.equal(s.services, 0); assert.equal(s.cities, 0); assert.equal(s.events, 4); assert.equal(s.customers, 4); assert.equal(s.bookings, 5, 'history is untouched by deactivation');
    await clearPolicies();
    // coverage by city: a coming-soon or denied city is not counted as served
    await db.availabilityPolicy.create({ data: { entityType: 'CATEGORY', entityId: 'entertainment', configuredStatus: 'ACTIVE', geoRules: { create: [{ cityId: 'dammam', geographicEffect: 'ALLOW', statusOverride: 'COMING_SOON' }, { cityId: 'jeddah', geographicEffect: 'DENY' }] } } });
    s = await stats(); assert.equal(s.cities, 1, 'only Riyadh is actually served'); assert.equal(s.services, 3, 'the services themselves are still bookable in Riyadh');
    await clearPolicies();
    // administration of the display
    const conf = must(await call('/api/system-admin/public-stats', 'GET', undefined, cAdmin)).config;
    assert.equal(conf.cards.length, 6); assert.equal((await call('/api/system-admin/public-stats', 'GET', undefined, cc[0])).status, 403);
    const next = { version: conf.version, enabled: true, scope: 'GLOBAL', period: 'ALL', cards: conf.cards.map((c, i) => ({ ...c, order: 10 - i, visible: c.id !== 'vendors', labelAr: c.id === 'cities' ? 'مدن نخدمها' : c.labelAr })) };
    const saved = must(await call('/api/system-admin/public-stats', 'PUT', next, cRoot)).config;
    assert.equal(saved.version, conf.version + 1);
    assert.equal((await call('/api/system-admin/public-stats', 'PUT', next, cRoot)).status, 409, 'a stale settings version is refused');
    const shown = (await call('/api/public-stats')).data.cards;
    assert(!shown.some(c => c.id === 'vendors'), 'a hidden card is not public'); assert.equal(shown[0].id, 'bookings', 'cards follow the configured order'); assert.equal(shown.find(c => c.id === 'cities').labelAr, 'مدن نخدمها');
    assert.equal((await call('/api/system-admin/public-stats', 'PUT', { ...next, version: saved.version, cards: [{ id: 'invented', labelAr: 'x', labelEn: 'x' }] }, cRoot)).status, 400, 'no invented metrics');
    must(await call('/api/system-admin/public-stats', 'PUT', { ...next, version: saved.version, enabled: false }, cRoot));
    assert.equal((await call('/api/public-stats')).data.enabled, false); assert.deepEqual((await call('/api/public-stats')).data.cards, []);
    ok('public statistics: verified, deduplicated and test-free; history survives deactivation; coverage follows availability; configurable and private');

    // ---- the existing suites keep passing elsewhere; here: the public decision contract ----
    const contract = (await resolveFor({ offerId: offer.id, cityId: 'riyadh', date: day(50), time: '10:00' })).data;
    for (const key of ['configuredStatus', 'effectiveStatus', 'isVisible', 'canBook', 'canCheckout', 'capacityStatus', 'reasonCodes', 'restrictions', 'message']) assert(key in contract, key);
    assert.equal((await resolveFor({ offerId: 'nope', cityId: 'riyadh' })).status, 404); assert.equal((await resolveFor({ cityId: 'riyadh' })).status, 400); assert.equal((await resolveFor({ offerId: offer.id, cityId: 'atlantis' })).status, 404); assert.equal((await resolveFor({ offerId: offer.id, date: 'tomorrow' })).status, 400);
    const noCity = (await resolveFor({ offerId: offer.id })).data; assert.equal(noCity.canBook, false); assert(noCity.needsLocation || noCity.reasonCodes.includes('LOCATION_REQUIRED'), 'a missing location is an explicit result');
    const list = (await call('/api/availability?cityId=riyadh')).data; assert(list.services.some(x => x.serviceId === svc.id && x.canBook));
    ok('the public decision contract and its error handling');
    void baselineOrder;
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS availability: ${results.length} groups of checks (permissions, validation, states, geography, capacity, schedules, packages, administration, statistics)`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-2500)); process.exitCode = 1; });
