// Unified pricing end to end: package pricing policies (every model, versions, schedules), discount rules (codes, vendor rules, funding), stacking
// against package discounts, the cart and checkout (itemised immutable quote, redemptions, concurrency), price-change notifications, permissions.
// A throwaway schema in the LOCAL database and a separate Next server.   npm run test:pricing
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'price_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const dist = '.next-pr-test-' + process.pid, tsconfig = '.pr-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3118, BASE = 'http://127.0.0.1:' + PORT, CRON = 'price-cron-' + randomBytes(4).toString('hex');
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: 'development', BACKUP_CRON_TOKEN: CRON };
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
const cron = () => fetch(BASE + '/api/internal/notifications-cron', { method: 'POST', headers: { 'x-backup-token': CRON } }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const sql = (s, ...v) => db.$queryRaw(s, ...v), sqlx = (s, ...v) => db.$executeRaw(s, ...v);
const SAR = n => n * 100;

(async () => {
  try {
    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const f of ['20261023-booking-drafts.sql', '20261023-luma-question-log.sql', '20261023-pricing-engine.sql']) { r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', 'prisma/sql/' + f], { env, encoding: 'utf8' }); assert.equal(r.status, 0, f + r.stdout + r.stderr); }
    await require('./seed-geography.cjs').seedGeography(db);
    const region = (id, en, ar) => db.geoRegion.upsert({ where: { id }, create: { id, countryCode: 'SA', nameAr: ar, nameEn: en }, update: {} });
    await region('r-riyadh', 'Riyadh Region', 'منطقة الرياض');
    await db.saudiCity.upsert({ where: { id: 'riyadh' }, create: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', regionId: 'r-riyadh', countryCode: 'SA', isAvailable: true, defaultAvailable: true }, update: { isAvailable: true, defaultAvailable: true, regionId: 'r-riyadh', countryCode: 'SA' } });
    await db.geoCountry.update({ where: { code: 'SA' }, data: { enabled: true } });
    const mk = (name, phone, role, extra = {}) => db.user.create({ data: { name, phone, role, ...extra } });
    const [c1, c2, c3] = await Promise.all([mk('عميل ١', '0500500001', 'CLIENT'), mk('عميل ٢', '0500500002', 'CLIENT'), mk('عميل ٣', '0500500003', 'CLIENT')]);
    const vUsers = await Promise.all([mk('مورد أ', '0500500011', 'VENDOR'), mk('مورد ب', '0500500012', 'VENDOR'), mk('مورد ج', '0500500013', 'VENDOR')]);
    const boss = await mk('مشرف', '0500500020', 'ADMIN'), root = await mk('مدير النظام', '0500500021', 'SUPER_ADMIN');
    const vendors = []; for (const [i, u] of vUsers.entries()) vendors.push(await db.vendor.create({ data: { userId: u.id, businessName: 'مورد ' + 'أبج'[i], businessNameEn: 'V', categoryId: 'entertainment', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: u.phone, whatsappNumber: u.phone, status: 'ACTIVE', verified: true } }));
    const [cC1, cC2, cC3, cVA, cVB, cVC, cBoss, cRoot] = await Promise.all([session(c1), session(c2), session(c3), session(vUsers[0]), session(vUsers[1]), session(vUsers[2]), session(boss), session(root)]);

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ---- catalogue: three products from three vendors (500 / 400 / 300 riyals), no appointment needed
    const svcBody = (title, owner) => ({ titleAr: title, descriptionAr: 'وصف', kind: 'PHYSICAL', categoryId: 'entertainment', subcategoryId: null, artistId: null, cities: ['riyadh'], managerIds: [owner.id], resourceIds: [], published: true, approved: true, images: [], videoUrls: [] });
    const policyBody = amount => ({ baseAmount: amount, bookingMode: 'DIRECT', durationMinutes: 60, minDurationMinutes: 30, maxDurationMinutes: 600, depositBps: 0, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 10000, beforeHours: 0 }], calendar: { minNoticeHours: 0, bufferMinutes: 0 }, taxBps: 1500, commissionBps: 1000 });
    const offers = {};
    for (const [i, [key, title, amount]] of [['a', 'تصوير', SAR(500)], ['b', 'كوشة', SAR(400)], ['c', 'صوتيات', SAR(300)]].entries()) {
      // each vendor creates their own service and offer (so the service belongs to their vendor account); an administrator approves it
      const vendorCookie = [cVA, cVB, cVC][i];
      const created = must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'svc-' + key, body: svcBody(title, vUsers[i]) }, vendorCookie)).entity;
      must(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'svc-' + key, version: created.version, body: { ...created.body, approved: true, published: true } }, cRoot));
      offers[key] = must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'offer-' + key, serviceId: 'svc-' + key, body: { nameAr: 'عرض ' + title, model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 0, policy: policyBody(amount) } }, vendorCookie)).entity;
    }
    const pack = (id, kind, extra = {}, items = ['a', 'b', 'c']) => ({ kind: 'PACKAGE', id, body: { nameAr: id, descriptionAr: 'باقة', published: true, kind, discountBps: 0, fixedTotal: 0, ...extra }, items: items.map(k => ({ id: id + '-' + k, offerId: 'offer-' + k, quantity: 1, optional: false, substitutions: [] })) });
    const line = (extra = {}) => ({ cityId: 'riyadh', quantity: 1, guestCount: 1, ...extra });
    const quote = async (cfg, codes, cookie) => must(await call('/api/pricing/quote', 'POST', { ...cfg, ...(codes ? { promoCodes: codes } : {}) }, cookie)).quote;
    const policies = async id => must(await call('/api/commerce/pricing/policies?packageId=' + id, 'GET', undefined, cBoss));
    const addPolicy = async (packageId, p, cookie = cBoss) => call('/api/commerce/pricing/policies', 'POST', { packageId, activate: true, ...p }, cookie);
    const sumBase = SAR(1200), taxOf = n => Math.round(n * 0.15);

    // ================================================================= 1. existing pricing is preserved; the older editor and policies agree
    must(await call('/api/commerce/manage', 'POST', pack('p-sum', 'CUSTOMIZABLE'), cRoot));
    must(await call('/api/commerce/manage', 'POST', pack('p-fixed', 'FIXED', { fixedTotal: SAR(999) }), cRoot));
    must(await call('/api/commerce/manage', 'POST', pack('p-pct', 'CUSTOMIZABLE', { discountBps: 1500 }), cRoot));
    let q = await quote(line({ packageId: 'p-sum' })); eq(q.pricing.packageDiscount, 0); eq(q.totals.total, sumBase + taxOf(sumBase));
    q = await quote(line({ packageId: 'p-fixed' })); eq(q.totals.total, SAR(999)); eq(q.pricing.models[0].model, 'FIXED_PRICE'); assert(q.pricing.discounts[0].amount > 0);
    q = await quote(line({ packageId: 'p-pct' })); eq(q.pricing.packageDiscount, SAR(180), '15% of 1200'); eq(q.totals.total, SAR(1020) + taxOf(SAR(1020)));
    let pol = await policies('p-fixed'); eq(pol.policies.length, 1); eq(pol.current.model, 'FIXED_PRICE'); eq(pol.current.fixedPrice, SAR(999)); eq(pol.policies[0].status, 'ACTIVE');
    eq((await policies('p-pct')).current.discountBps, 1500);
    // a package edited in the older editor becomes a new policy version
    must(await call('/api/commerce/manage', 'POST', { ...pack('p-pct', 'CUSTOMIZABLE', { discountBps: 2000 }), version: (await sql`SELECT "version" FROM "CommercePackage" WHERE "id"='p-pct'`)[0].version }, cRoot));
    pol = await policies('p-pct'); eq(pol.policies.length, 2); eq(pol.current.discountBps, 2000); eq(pol.policies[0].status, 'ACTIVE'); eq(pol.policies[1].status, 'ACTIVE', 'the previous policy is closed by an end date'); assert(pol.policies[1].effectiveUntil);
    q = await quote(line({ packageId: 'p-pct' })); eq(q.pricing.packageDiscount, SAR(240));
    ok('existing fixed-price and percentage packages price exactly as before, and a package edited in the older editor becomes a new policy version');

    // ================================================================= 2. every pricing model through the API
    must(await call('/api/commerce/manage', 'POST', pack('p-fa', 'CUSTOMIZABLE'), cRoot)); must(await call('/api/commerce/manage', 'POST', pack('p-tier', 'CUSTOMIZABLE'), cRoot)); must(await call('/api/commerce/manage', 'POST', pack('p-fp', 'FIXED'), cRoot));
    must(await addPolicy('p-fp', { model: 'FIXED_PRICE', fixedPrice: SAR(900) })); eq((await quote(line({ packageId: 'p-fp' }))).totals.total, SAR(900));
    must(await addPolicy('p-fa', { model: 'FIXED_AMOUNT', discountAmount: SAR(150) })); q = await quote(line({ packageId: 'p-fa' })); eq(q.pricing.packageDiscount, SAR(150)); assert(Math.abs(q.totals.total - (SAR(1050) + taxOf(SAR(1050)))) <= 3, 'tax is rounded per line: ' + q.totals.total);
    must(await addPolicy('p-tier', { model: 'TIERED', config: { tiers: [{ minCount: 1, bps: 0 }, { minCount: 2, bps: 500 }, { minCount: 3, bps: 1000 }, { minCount: 4, bps: 1500 }] } }));
    q = await quote(line({ packageId: 'p-tier' })); eq(q.pricing.packageDiscount, SAR(120), 'three services: the 10% tier');
    must(await call('/api/commerce/manage', 'POST', { ...pack('p-tier', 'CUSTOMIZABLE', {}, ['a', 'b', 'c']), items: ['a', 'b', 'c'].map(k => ({ id: 'p-tier-' + k, offerId: 'offer-' + k, quantity: 1, optional: k === 'c', substitutions: [] })), version: (await sql`SELECT "version" FROM "CommercePackage" WHERE "id"='p-tier'`)[0].version }, cRoot));
    eq((await policies('p-tier')).current.model, 'TIERED', 'editing the components keeps the tier policy (the older editor sent the same 0 / 0)');
    q = await quote(line({ packageId: 'p-tier', choices: { 'p-tier-c': { omit: true } } })); eq(q.pricing.packageDiscount, Math.round(SAR(900) * 0.05), 'customer drops an optional part: two services, the 5% tier, price recalculated');
    // build-your-own limits
    must(await addPolicy('p-tier', { model: 'TIERED', config: { tiers: [{ minCount: 2, bps: 500 }], minComponents: 2, maxComponents: 3 } }));
    eq((await call('/api/pricing/quote', 'POST', line({ packageId: 'p-tier', choices: { 'p-tier-c': { omit: true }, 'p-tier-b': {} } }))).status, 200);
    must(await addPolicy('p-tier', { model: 'TIERED', config: { tiers: [{ minCount: 2, bps: 500 }], minComponents: 3 } }));
    eq((await call('/api/pricing/quote', 'POST', line({ packageId: 'p-tier', choices: { 'p-tier-c': { omit: true } } }))).status, 400, 'fewer components than the policy requires');
    // validation
    for (const [bad, why] of [[{ model: 'PERCENT', discountPercent: 150 }, 'over 100%'], [{ model: 'PERCENT' }, 'no percentage'], [{ model: 'FIXED_AMOUNT' }, 'no amount'], [{ model: 'TIERED', config: { tiers: [{ minCount: 3, bps: 900 }, { minCount: 2, bps: 500 }] } }, 'tiers that do not climb'], [{ model: 'TIERED', config: {} }, 'no tiers'], [{ model: 'NOPE' }, 'unknown model'], [{ model: 'FIXED_PRICE', fixedPrice: SAR(900) }, 'a fixed price on a customizable package'], [{ model: 'SUM', config: { minComponents: 4, maxComponents: 2 } }, 'min above max'], [{ model: 'PERCENT', discountPercent: 10, effectiveFrom: '2026-01-02T00:00:00Z', effectiveUntil: '2026-01-01T00:00:00Z' }, 'ends before it starts']]) eq((await addPolicy('p-fa', bad)).status, 400, why);
    // versions, scheduling and immutability
    must(await addPolicy('p-fa', { model: 'PERCENT', discountPercent: 12.5 })); const vBefore = (await policies('p-fa')); eq(vBefore.current.discountBps, 1250);
    const future = new Date(Date.now() + 86400000 * 2).toISOString();
    must(await addPolicy('p-fa', { model: 'PERCENT', discountPercent: 30, effectiveFrom: future })); q = await quote(line({ packageId: 'p-fa' })); eq(q.pricing.packageDiscount, Math.round(SAR(1200) * 0.125), 'a scheduled policy does not apply before its date');
    const active = (await sql`SELECT COUNT(*)::int AS n FROM "PackagePricingPolicy" WHERE "packageId"='p-fa' AND "status"='ACTIVE'`)[0].n; assert(active >= 2);
    await assert.rejects(() => sqlx`UPDATE "PackagePricingPolicy" SET "discountPercentage"=99 WHERE "packageId"='p-fa' AND "status"='ACTIVE'`, /immutable/i); await assert.rejects(() => sqlx`DELETE FROM "PackagePricingPolicy" WHERE "packageId"='p-fa'`, /cannot be deleted/i);
    await assert.rejects(() => sqlx`INSERT INTO "PackagePricingPolicy" ("id","packageId","pricingModel","discountPercentage","effectiveFrom","version","status") VALUES ('dup','p-fa','PERCENT',5,CURRENT_TIMESTAMP - interval '1 day',99,'ACTIVE')`, /already has an active pricing policy|23P01/i);
    eq((await call('/api/commerce/pricing/policies?packageId=p-fa', 'GET', undefined, cC1)).status, 403); eq((await call('/api/commerce/pricing/policies?packageId=p-fa', 'GET', undefined, cVA)).status, 404, "a vendor cannot see another owner's package pricing");
    const archived = must(await call('/api/commerce/pricing/policies', 'PATCH', { id: (await policies('p-fa')).policies.find(p => p.status === 'ACTIVE' && p.discountBps === 3000).id, action: 'archive' }, cBoss)); assert(archived.ok);
    ok('SUM, fixed price, percentage, fixed amount and tiered policies price correctly; build-your-own limits and validation hold; policies are versioned, schedulable, never overlap and cannot be edited or deleted');

    // ================================================================= 3. a fixed package price does not move when a standalone price does
    const fixedBefore = (await quote(line({ packageId: 'p-fp' }))).totals.total;
    must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'offer-a', serviceId: 'svc-a', version: offers.a.version, body: { ...offers.a.body, policy: policyBody(SAR(900)) } }, cRoot)); offers.a = (await sql`SELECT * FROM "CommerceOffer" WHERE "id"='offer-a'`)[0];
    eq((await quote(line({ packageId: 'p-fp' }))).totals.total, fixedBefore, 'fixed means fixed'); eq((await quote(line({ offerId: 'offer-a' }))).totals.total, SAR(900) + taxOf(SAR(900)), 'the standalone price did change');
    must(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id: 'offer-a', serviceId: 'svc-a', version: offers.a.version, body: { ...offers.a.body, policy: policyBody(SAR(500)) } }, cRoot));
    ok('standalone and package prices are independent: raising one offer does not change a fixed package price');

    // ================================================================= 4. discount rules: codes, windows, vendor rules, funding
    const rule = (o = {}) => ({ name: 'قاعدة', kind: 'GENERAL', discountType: 'PERCENTAGE', value: 10, status: 'ACTIVE', ...o });
    const saveRule = (o, cookie = cBoss) => call('/api/commerce/pricing/rules', 'POST', o, cookie);
    const R10 = must(await saveRule(rule({ name: 'خصم 10% بالرمز', kind: 'PROMO_CODE', code: 'save10' }))).rule; eq(R10.code, 'SAVE10'); eq(R10.version, 1);
    q = await quote(line({ offerId: 'offer-a' })); eq(q.pricing.promotionDiscount, 0, 'no code, no discount');
    q = await quote(line({ offerId: 'offer-a' }), ['Save10'], cC1); eq(q.pricing.promotionDiscount, SAR(50), 'the code works whatever its case'); eq(q.totals.total, SAR(450) + taxOf(SAR(450))); eq(q.pricing.discounts[0].description, 'خصم 10% بالرمز');
    q = await quote(line({ offerId: 'offer-a' }), ['nope'], cC1); eq(q.pricing.promotionDiscount, 0); assert(q.pricing.rejected.some(x => x.code === 'UNKNOWN_CODE'), 'a wrong code is explained');
    eq((await call('/api/pricing/quote', 'POST', { ...line({ offerId: 'offer-a' }), promoCodes: ['bad code!'] })).status, 400);
    assert(!JSON.stringify(q.pricing).includes('allocation') && !('funding' in q.pricing), 'customers never see who funds a discount');
    must(await saveRule(rule({ name: 'منتهي', kind: 'PROMO_CODE', code: 'OLD', startsAt: '2020-01-01T00:00:00Z', endsAt: '2021-01-01T00:00:00Z' })));
    q = await quote(line({ offerId: 'offer-a' }), ['old'], cC1); eq(q.pricing.promotionDiscount, 0); assert(q.pricing.rejected.some(x => x.code === 'EXPIRED' && /انتهت/.test(x.reasonAr)), 'an expired code says so');
    // validation of rules
    for (const [bad, why] of [[{ discountType: 'PERCENTAGE', value: 101 }, 'over 100%'], [{ kind: 'PROMO_CODE' }, 'a code rule without a code'], [{ kind: 'QUANTITY' }, 'a quantity rule without a minimum'], [{ kind: 'TIMED' }, 'a timed rule without dates'], [{ kind: 'CUSTOMER' }, 'a customer rule without a condition'], [{ discountType: 'FIXED_AMOUNT', value: 12.5 }, 'a fractional amount'], [{ fundingType: 'SHARED' }, 'shared funding without a share'], [{ startsAt: '2026-02-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z' }, 'ends before it starts'], [{ code: 'SAVE10', kind: 'PROMO_CODE' }, 'a code already used']]) assert([400, 409].includes((await saveRule(rule(bad))).status), why);
    // vendor rules: own services only, funded by the vendor, switched on by an administrator
    const vr = must(await saveRule(rule({ name: 'عرض المورد أ', kind: 'PROMO_CODE', code: 'VENDA', value: 20, fundingType: 'PLATFORM', status: 'ACTIVE' }), cVA)).rule;
    eq(vr.status, 'DRAFT', "a vendor's rule waits for an administrator"); eq(vr.fundingType, 'VENDOR', "a vendor funds their own promotion (platform funding is not theirs to give)"); eq(vr.ownerVendorId, vendors[0].id);
    eq((await saveRule(rule({ name: 'x', targets: { offerIds: ['offer-b'] } }), cVA)).status, 403, "a vendor cannot target another vendor's offer");
    q = await quote(line({ offerId: 'offer-a' }), ['venda'], cC1); eq(q.pricing.promotionDiscount, 0); assert(q.pricing.rejected.some(x => x.code === 'INACTIVE'));
    eq((await call('/api/commerce/pricing/rules', 'PATCH', { id: vr.id, action: 'activate' }, cVA)).status, 403, 'a vendor cannot activate'); must(await call('/api/commerce/pricing/rules', 'PATCH', { id: vr.id, action: 'activate' }, cBoss));
    q = await quote(line({ offerId: 'offer-a' }), ['venda'], cC1); eq(q.pricing.promotionDiscount, SAR(100));
    q = await quote(line({ offerId: 'offer-b' }), ['venda'], cC1); eq(q.pricing.promotionDiscount, 0, "a vendor's promotion never touches another vendor's service");
    const pv = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ offerId: 'offer-a' }), promoCodes: ['venda'] }, cBoss)); eq(pv.internal.funding.vendors[vendors[0].id], SAR(100)); eq(pv.internal.funding.platform, 0);
    const pvVendor = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ offerId: 'offer-a' }), promoCodes: ['venda'] }, cVA)); assert(!pvVendor.internal, 'only administrators see the funding breakdown');
    // platform funded and shared funding
    const PF = must(await saveRule(rule({ name: 'تمويل المنصة', kind: 'PROMO_CODE', code: 'PLAT', discountType: 'FIXED_AMOUNT', value: SAR(60), fundingType: 'PLATFORM', stackable: true }))).rule;
    const SH = must(await saveRule(rule({ name: 'تمويل مشترك', kind: 'PROMO_CODE', code: 'SHARE', discountType: 'FIXED_AMOUNT', value: SAR(60), fundingType: 'SHARED', vendorShareBps: 5000 }))).rule;
    let pf = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ offerId: 'offer-b' }), promoCodes: ['plat'] }, cBoss)); eq(pf.internal.funding.platform, SAR(60)); eq(pf.internal.funding.vendors, {});
    pf = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ offerId: 'offer-b' }), promoCodes: ['share'] }, cBoss)); eq(pf.internal.funding.platform, SAR(30)); eq(pf.internal.funding.vendors[vendors[1].id], SAR(30));
    // rule edits create versions; an unsaved rule can be previewed without saving anything
    const edited = must(await saveRule({ ...rule({ name: 'خصم 10% بالرمز', kind: 'PROMO_CODE', code: 'save10', value: 12 }), id: R10.id, version: 1 })).rule; eq(edited.version, 2); eq((await saveRule({ ...rule({ code: 'save10', kind: 'PROMO_CODE' }), id: R10.id, version: 1 })).status, 409, 'a stale version is refused');
    const draftView = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ offerId: 'offer-a' }), rule: rule({ name: 'مسودة', value: 25 }) }, cBoss)); eq(draftView.customerView.pricing.promotionDiscount, SAR(125)); eq((await sql`SELECT COUNT(*)::int AS n FROM "DiscountRule" WHERE "name"='مسودة'`)[0].n, 0, 'a preview writes nothing');
    for (const route of ['/api/commerce/pricing/rules', '/api/commerce/pricing/settlement', '/api/commerce/pricing/history?offerId=offer-a']) { eq((await call(route, 'GET', undefined, cC1)).status, 403, route); eq((await call(route)).status, 401, route); }
    ok('promotion codes (case-insensitive, expiry, explained rejections), role-restricted vendor rules, platform / vendor / shared funding, rule versions and previews that write nothing');

    // ================================================================= 5. a package discount and a promotion never stack on their own
    must(await call('/api/commerce/manage', 'POST', pack('p-10', 'CUSTOMIZABLE', { discountBps: 1000 }), cRoot));
    const big = must(await saveRule(rule({ name: 'خصم كبير 30%', kind: 'PROMO_CODE', code: 'BIG30', value: 30 }))).rule, small = must(await saveRule(rule({ name: 'خصم صغير 5%', kind: 'PROMO_CODE', code: 'SMALL5', value: 5 }))).rule;
    const okRule = must(await saveRule(rule({ name: 'يجتمع مع الباقة', kind: 'PROMO_CODE', code: 'TOGETHER', value: 5, conditions: { allowWithPackageDiscount: true } }))).rule;
    q = await quote(line({ packageId: 'p-10' }), ['small5'], cC1); eq(q.pricing.mode, 'PACKAGE'); eq(q.pricing.packageDiscount, SAR(120)); eq(q.pricing.promotionDiscount, 0, 'the package price (10%) beats a 5% code, and they do not combine');
    q = await quote(line({ packageId: 'p-10' }), ['big30'], cC1); eq(q.pricing.mode, 'NO_PACKAGE'); eq(q.pricing.packageDiscount, 0); eq(q.pricing.promotionDiscount, SAR(360), 'a 30% code beats the package, replacing its discount'); assert(q.pricing.rejected.some(x => x.code === 'PACKAGE_DISCOUNT'), 'the dropped package discount is explained');
    q = await quote(line({ packageId: 'p-10' }), ['together'], cC1); eq(q.pricing.packageDiscount, SAR(120)); eq(q.pricing.promotionDiscount, Math.round((SAR(1200) - SAR(120)) * 0.05), 'combined only because the rule says so');
    q = await quote(line({ packageId: 'p-10' }), ['big30', 'small5'], cC1); eq(q.pricing.discounts.filter(d => d.source === 'RULE').length, 1, 'two non-stackable codes: one applies'); eq(q.pricing.promotionDiscount, SAR(360));
    must(await call('/api/commerce/pricing/rules', 'PATCH', { id: big.id, action: 'disable' }, cBoss)); q = await quote(line({ packageId: 'p-10' }), ['big30'], cC1); eq(q.pricing.promotionDiscount, 0); must(await call('/api/commerce/pricing/rules', 'PATCH', { id: small.id, action: 'disable' }, cBoss)); must(await call('/api/commerce/pricing/rules', 'PATCH', { id: okRule.id, action: 'disable' }, cBoss));
    ok('a package discount and a promotion do not stack unless the rule allows it; otherwise the customer gets whichever is cheaper, and the other is explained');

    // ================================================================= 6. cart, checkout: itemised immutable quote, redemptions, settlement
    const cartOf = async cookie => must(await call('/api/commerce/cart', 'GET', undefined, cookie));
    const save = async (cookie, lines, promoCodes) => { const c = await cartOf(cookie); return call('/api/commerce/cart', 'PUT', { version: c.cart.version, lines, ...(promoCodes ? { promoCodes } : {}) }, cookie); };
    const buy = async cookie => { const c = await cartOf(cookie); return call('/api/commerce/orders', 'POST', { cartVersion: c.cart.version, quoteHash: c.quote.hash, idempotencyKey: randomBytes(16).toString('hex'), acceptTerms: true }, cookie); };
    const lineId = () => randomBytes(8).toString('hex');
    must(await saveRule(rule({ name: 'ترويج المنصة', kind: 'PROMO_CODE', code: 'CHECK', value: 10, fundingType: 'PLATFORM' })));
    let saved = must(await save(cC1, [{ id: lineId(), packageId: 'p-10', ...line() }], ['check'])); eq(saved.cart.body.promoCodes, ['CHECK']);
    let cart = await cartOf(cC1); eq(cart.quote.pricing.mode, 'PACKAGE', 'a 10% code ties with the package 10%: equal price, so the simpler outcome (the package price alone) stands'); void cart;
    saved = must(await save(cC1, [{ id: lineId(), offerId: 'offer-a', ...line() }, { id: lineId(), offerId: 'offer-b', ...line() }], ['check']));
    cart = await cartOf(cC1); eq(cart.quote.pricing.promotionDiscount, SAR(90)); assert(cart.quote.lines.every(l => l.price.commission === undefined), 'a customer sees no commission');
    const order = must(await buy(cC1)); const orderId = order.order?.id ?? order.id;
    const pq = (await sql`SELECT * FROM "PriceQuote" WHERE "orderId"=${orderId}`)[0]; assert(pq, 'the itemised quote is stored with the order'); eq(pq.status, 'FINAL');
    const comps = await sql`SELECT * FROM "PriceQuoteComponent" WHERE "priceQuoteId"=${pq.id}`;
    eq(comps.length, 2); eq(comps.reduce((n, c) => n + Number(c.netAmount), 0), SAR(810), 'components add up (500 + 400 less 10%)'); eq(comps.reduce((n, c) => n + Number(c.discountAmount), 0), SAR(90)); assert(comps.every(c => Number(c.grossAmount) - Number(c.discountAmount) === Number(c.netAmount)));
    eq(comps.reduce((n, c) => n + Number(c.platformFundedAmount), 0), SAR(90), 'platform-funded'); eq(comps.reduce((n, c) => n + Number(c.vendorFundedAmount), 0), 0);
    const applied = await sql`SELECT * FROM "AppliedDiscount" WHERE "priceQuoteId"=${pq.id}`; eq(applied.length, 1); eq(Number(applied[0].discountAmount), SAR(90)); eq(applied[0].fundingType, 'PLATFORM'); eq(applied[0].ruleSnapshot.code, 'CHECK'); eq(applied[0].discountRuleVersion, 1);
    eq((await sql`SELECT "status" FROM "DiscountRedemption" WHERE "orderId"=${orderId}`)[0].status, 'REDEEMED');
    const items = await sql`SELECT "body" FROM "CommerceOrderItem" WHERE "orderId"=${orderId}`; const itemPrices = items.map(i => i.body.price);
    assert(itemPrices.every(p => p.commission === Math.round((p.subtotal + p.funding.platform) * 0.10)), "the vendors' commission is charged on what they agreed to be paid: a platform-funded discount does not reduce their payout");
    eq(itemPrices.reduce((n, p) => n + p.total, 0), comps.reduce((n, c) => n + Number(c.netAmount) + Number(c.taxAmount), 0), 'order item totals equal the stored quote');
    await assert.rejects(() => sqlx`UPDATE "PriceQuote" SET "status"='ESTIMATE' WHERE "id"=${pq.id}`, /immutable/i); await assert.rejects(() => sqlx`DELETE FROM "AppliedDiscount" WHERE "priceQuoteId"=${pq.id}`, /immutable/i); await assert.rejects(() => sqlx`UPDATE "PriceQuoteComponent" SET "netAmount"=1 WHERE "priceQuoteId"=${pq.id}`, /immutable/i);
    // later changes to the rule or the catalog never touch a confirmed order
    const chk = (await sql`SELECT "id","version" FROM "DiscountRule" WHERE "code"='CHECK'`)[0];
    must(await saveRule({ ...rule({ name: 'ترويج المنصة', kind: 'PROMO_CODE', code: 'CHECK', value: 50 }), id: chk.id, version: chk.version }));
    eq((await sql`SELECT "ruleSnapshot"->>'value' AS v FROM "AppliedDiscount" WHERE "priceQuoteId"=${pq.id}`)[0].v, '1000', 'the order keeps the rule as it was (10%) after it is edited to 50%');
    eq((await sql`SELECT COUNT(*)::int AS n FROM "AppliedDiscount" WHERE "priceQuoteId"=${pq.id}`)[0].n, 1);
    eq((await cartOf(cC1)).cart.body.promoCodes, undefined, 'the code is spent with the order');
    // settlement review
    const sr = must(await call('/api/commerce/pricing/settlement', 'GET', undefined, cBoss)); const va = sr.vendors.find(v => v.vendorId === vendors[0].id);
    eq(va.gross, SAR(500)); eq(va.platformFunded, SAR(50)); eq(va.vendorFunded, 0); eq(va.payable, va.net + va.platformFunded - va.commission); assert(sr.campaigns.some(c => c.name === 'ترويج المنصة' && c.fundingType === 'PLATFORM'));
    const own = must(await call('/api/commerce/pricing/settlement', 'GET', undefined, cVA)); eq(own.vendors.length, 1); eq(own.vendors[0].vendorId, vendors[0].id); eq(own.campaigns, [], 'a vendor sees only their own row, not the platform campaigns');
    ok('checkout stores an immutable itemised quote with the discounts applied (rule snapshot, funding) and redemptions; vendors keep their commission base under platform funding; the settlement review splits gross / funded / commission / payable');

    // ================================================================= 7. limited promotions: concurrency, per-customer limits, release
    must(await saveRule(rule({ name: 'مرة واحدة', kind: 'PROMO_CODE', code: 'ONCE', value: 10, usageLimit: 1 })));
    must(await save(cC2, [{ id: lineId(), offerId: 'offer-a', ...line() }], ['once'])); must(await save(cC3, [{ id: lineId(), offerId: 'offer-a', ...line() }], ['once']));
    const [q2, q3] = [await cartOf(cC2), await cartOf(cC3)]; eq(q2.quote.pricing.promotionDiscount, SAR(50)); eq(q3.quote.pricing.promotionDiscount, SAR(50), 'both quotes show the discount before anyone has used it');
    const place = (c, cookie) => call('/api/commerce/orders', 'POST', { cartVersion: c.cart.version, quoteHash: c.quote.hash, idempotencyKey: randomBytes(16).toString('hex'), acceptTerms: true }, cookie);
    const raced = await Promise.all([place(q2, cC2), place(q3, cC3)]);
    eq(raced.filter(x => x.status === 200).length, 1, 'exactly one of two simultaneous checkouts gets the last use: ' + raced.map(x => x.status)); eq(raced.filter(x => x.status === 409).length, 1, 'the other is told the price changed');
    eq((await sql`SELECT COUNT(*)::int AS n FROM "DiscountRedemption" r JOIN "DiscountRule" d ON d."id"=r."discountRuleId" WHERE d."code"='ONCE' AND r."status"='REDEEMED'`)[0].n, 1);
    const loserCookie = raced[0].status === 200 ? cC3 : cC2; const lost = await cartOf(loserCookie); eq(lost.quote.pricing.promotionDiscount, 0); assert(lost.quote.pricing.rejected.some(x => x.code === 'USAGE_LIMIT'), 'and told why: the promotion is used up');
    assert(lost.priceChanges.length > 0, 'the lost discount is a price increase the customer must acknowledge');
    for (const ch of lost.priceChanges) must(await call(`/api/cart/items/${ch.lineId}/acknowledge-price`, 'POST', undefined, loserCookie));
    const second = must(await place(await cartOf(loserCookie), loserCookie)); assert(second, 'after acknowledging, at the new price, the loser can still buy');
    // per-customer limits and release on cancellation
    must(await saveRule(rule({ name: 'مرة لكل عميل', kind: 'PROMO_CODE', code: 'EACH', value: 10, perCustomerLimit: 1 })));
    must(await save(cC1, [{ id: lineId(), offerId: 'offer-b', ...line() }], ['each'])); eq((await cartOf(cC1)).quote.pricing.promotionDiscount, SAR(40)); const o1 = must(await buy(cC1));
    must(await save(cC1, [{ id: lineId(), offerId: 'offer-b', ...line() }], ['each'])); const again = await cartOf(cC1); eq(again.quote.pricing.promotionDiscount, 0); assert(again.quote.pricing.rejected.some(x => x.code === 'CUSTOMER_LIMIT'), 'a second use by the same customer is refused');
    await sqlx`UPDATE "CommerceOrderItem" SET "body"=jsonb_set("body",'{status}','"CANCELLED"') WHERE "orderId"=${o1.order?.id ?? o1.id}`; await cron();
    eq((await sql`SELECT "status" FROM "DiscountRedemption" WHERE "orderId"=${o1.order?.id ?? o1.id}`)[0].status, 'RELEASED', 'a cancelled order gives the use back'); eq((await cartOf(cC1)).quote.pricing.promotionDiscount, SAR(40), 'and the customer can use it again');
    ok('limited promotions are race-safe (one of two simultaneous checkouts gets the last use, the other is told why), per-customer limits hold, and a cancelled order releases its use');

    // ================================================================= 8. price changes caused by discounts and schedules reach the customer
    must(await saveRule(rule({ name: 'يسقط لاحقاً', kind: 'PROMO_CODE', code: 'SOON', value: 20 }))); const soon = (await sql`SELECT "id" FROM "DiscountRule" WHERE "code"='SOON'`)[0];
    must(await save(cC3, [{ id: lineId(), offerId: 'offer-c', ...line() }], ['soon'])); await cartOf(cC3); const baseline = (await sql`SELECT COUNT(*)::int AS n FROM "CartPriceChange" WHERE "userId"=${c3.id}`)[0].n;
    must(await call('/api/commerce/pricing/rules', 'PATCH', { id: soon.id, action: 'disable' }, cBoss)); const c3Cart = await cartOf(cC3);
    eq(c3Cart.priceChanges.length, 1); eq(c3Cart.priceChanges[0].direction, 'INCREASE'); eq(c3Cart.priceChanges[0].reasonCode, 'DISCOUNT_CHANGED', 'the reason is the discount, not the catalog'); eq(c3Cart.priceChanges[0].differenceHalala, SAR(69), 'the 20% (60 riyals) plus its 15% tax');
    const refusal = await call('/api/commerce/orders', 'POST', { cartVersion: c3Cart.cart.version, quoteHash: c3Cart.quote.hash, idempotencyKey: randomBytes(16).toString('hex'), acceptTerms: true }, cC3); eq(refusal.status, 409); eq(refusal.data.priceChangeRequired, true, 'a lost discount is never charged silently');
    must(await call(`/api/cart/items/${c3Cart.cart.body.lines[0].id}/acknowledge-price`, 'POST', undefined, cC3)); await cron();
    const notified = await sql`SELECT "template","status" FROM "NotificationJob" WHERE "userId"=${c3.id} AND "template"='price_increase'`; assert(notified.length >= 1 && notified.every(j => ['SENT', 'PENDING'].includes(j.status)), 'the customer is notified (deduplicated by the notification engine)');
    eq((await sql`SELECT COUNT(*)::int AS n FROM "CartPriceChange" WHERE "userId"=${c3.id}`)[0].n, baseline + 1);
    // a scheduled price change becomes a real offer version and the carts holding it are noticed
    must(await save(cC2, [{ id: lineId(), offerId: 'offer-c', ...line() }])); await cartOf(cC2);
    const sched = must(await call('/api/commerce/pricing/schedule', 'POST', { offerId: 'offer-c', newBaseAmount: SAR(330), effectiveFrom: new Date(Date.now() + 1500).toISOString() }, cBoss)); assert(sched.affectedCarts >= 2, 'the administrator is told how many carts hold this offer: ' + sched.affectedCarts);
    eq((await call('/api/commerce/pricing/schedule', 'POST', { offerId: 'offer-c', newBaseAmount: SAR(330), effectiveFrom: '2020-01-01T00:00:00Z' }, cBoss)).status, 400, 'not in the past'); eq((await call('/api/commerce/pricing/schedule', 'POST', { offerId: 'offer-a', newBaseAmount: SAR(330), effectiveFrom: new Date(Date.now() + 5000).toISOString() }, cVB)).status, 404, "a vendor cannot schedule another vendor's price");
    await cron(); eq(Number(JSON.parse(JSON.stringify((await sql`SELECT "body"->'policy'->>'baseAmount' AS a FROM "CommerceOffer" WHERE "id"='offer-c'`)[0].a))), SAR(300), 'not before its time');
    await new Promise(x => setTimeout(x, 1800)); await cron();
    const nowOffer = (await sql`SELECT "body"->'policy'->>'baseAmount' AS a,"version" FROM "CommerceOffer" WHERE "id"='offer-c'`)[0]; eq(Number(nowOffer.a), SAR(330)); assert((await sql`SELECT COUNT(*)::int AS n FROM "CommerceOfferVersion" WHERE "offerId"='offer-c' AND "version"=${nowOffer.version}`)[0].n === 1, 'a version row exists');
    eq((await sql`SELECT "status" FROM "OfferPriceSchedule" WHERE "id"=${sched.id}`)[0].status, 'APPLIED');
    const c2Cart = await cartOf(cC2); assert(c2Cart.priceChanges.some(c => c.direction === 'INCREASE' && c.reasonCode === 'CATALOG_PRICE_CHANGED'), 'the cart holding the offer sees the new price as a catalog change');
    const hist = must(await call('/api/commerce/pricing/history?offerId=offer-c', 'GET', undefined, cBoss)); eq(hist.current, SAR(330)); assert(hist.versions.length >= 2 && hist.schedules.length === 1);
    ok('a promotion that stops applying is reported as a discount change and must be acknowledged before checkout; a scheduled price change takes effect on time as a real offer version and reaches the carts that hold it');

    // ================================================================= 9. the package builder inputs: preview before publishing, who may do what
    const prev = must(await call('/api/commerce/pricing/preview', 'POST', { line: line({ packageId: 'p-sum' }), policy: { model: 'PERCENT', discountPercent: 25 } }, cBoss));
    eq(prev.customerView.pricing.packageDiscount, Math.round(SAR(1230) * 0.25), 'the customer-facing price of a policy that is not published yet (25% of 500 + 400 + the scheduled 330)'); eq((await policies('p-sum')).current.model, 'SUM', 'and nothing was saved');
    eq((await call('/api/commerce/pricing/preview', 'POST', { line: line({ packageId: 'p-sum' }), policy: { model: 'PERCENT', discountPercent: 250 } }, cBoss)).status, 400);
    eq((await call('/api/commerce/pricing/preview', 'POST', { line: line({ packageId: 'p-sum' }) }, cC1)).status, 403);
    eq((await addPolicy('p-sum', { model: 'PERCENT', discountPercent: 10, config: { funding: 'PLATFORM' } }, cBoss)).status, 200); // administrators may fund a package discount
    eq((await call('/api/commerce/pricing/policies', 'POST', { packageId: 'p-sum', model: 'PERCENT', discountPercent: 10, config: { funding: 'PLATFORM' }, activate: true }, cVA)).status, 404, 'a vendor cannot price a package they do not own');
    const vp = must(await call('/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: 'p-vendor', body: { nameAr: 'باقة المورد', descriptionAr: 'ب', published: false, kind: 'CUSTOMIZABLE', discountBps: 0, fixedTotal: 0 }, items: [{ id: 'pv-a', offerId: 'offer-a', quantity: 1, optional: false, substitutions: [] }] }, cVA));
    assert(vp.entity, 'a vendor can build a package from their own offer');
    eq((await call('/api/commerce/pricing/policies', 'POST', { packageId: 'p-vendor', model: 'PERCENT', discountPercent: 10, config: { funding: 'PLATFORM' }, activate: true }, cVA)).status, 403, 'a vendor cannot make the platform fund a discount');
    eq((await call('/api/commerce/pricing/policies', 'POST', { packageId: 'p-vendor', model: 'PERCENT', discountPercent: 10, config: { funding: 'VENDOR' }, activate: true }, cVA)).status, 200);
    ok('previews show the customer price of unpublished changes without saving, and role limits hold (vendors: own packages, own funding only; customers: nothing)');
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS pricing: ${results.length} groups of checks`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-3000)); process.exitCode = 1; });
function eq(a, b, m) { assert.deepEqual(a, b, m); }
