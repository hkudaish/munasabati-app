// Review lifecycle test in a throwaway schema of the LOCAL database and a separate Next server.
// npm run test:reviews
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const tag = randomBytes(5).toString('hex');
const schema = 'reviews_test_' + tag, migSchema = 'reviews_mig_' + tag;
const withSchema = name => { const u = new URL(base.toString()); u.searchParams.set('schema', name); return u.toString(); };
const dist = '.next-rv-test-' + process.pid, tsconfig = '.rv-test-tsconfig-' + process.pid + '.json', oldSchemaFile = 'prisma/.old-schema-' + process.pid + '.prisma';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3113, BASE = 'http://127.0.0.1:' + PORT;
const env = { ...process.env, DATABASE_URL: withSchema(schema), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: tsconfig, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: 'development' };
const db = new PrismaClient({ datasourceUrl: withSchema(schema) });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let server, logs = '';
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log('PASS ' + name + (detail ? ' | ' + detail : '')); };
async function call(route, method = 'GET', data, cookie) {
  const r = await fetch(BASE + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, data: json };
}
const session = async user => { const token = randomBytes(32).toString('base64url'); await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } }); return 'munasabati_session=' + token; };

(async () => {
  try {
    // ---------------------------------------------------------------------------------------------------------------
    // 0. the migration SQL on a database built from the PREVIOUS schema, holding a legacy review that already had a reply
    // the previous schema = the current one without the review columns this change adds
    const oldSchema = fs.readFileSync('prisma/schema.prisma', 'utf8').split(/\r?\n/)
      .filter(line => !/^  (commerceItemId|commerceServiceId|replyStatus|replyDraftAr|replyAt|replyById|moderatedById|moderatedAt|moderationNoteAr)\s/.test(line) && !/^  @@index\(\[commerceServiceId\]\)/.test(line) && !/^  @@unique\(\[userId, commerceItemId\]\)/.test(line))
      .map(line => (line.trim() === 'vendorId            String?' ? line.replace('String?', 'String') : line.startsWith('  vendor              Vendor?') ? line.replace('Vendor?', 'Vendor') : line))
      .join('\n');
    assert(!/commerceItemId/.test(oldSchema) && /\n  vendorId            String\n/.test(oldSchema), 'could not derive the previous schema');
    fs.writeFileSync(oldSchemaFile, oldSchema);
    const oldEnv = { ...process.env, DATABASE_URL: withSchema(migSchema) };
    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--schema', oldSchemaFile], { env: oldEnv, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const mig = new PrismaClient({ datasourceUrl: withSchema(migSchema) });
    await mig.serviceCategory.create({ data: { id: 'c', nameAr: 'a', nameEn: 'a', iconName: 'i', descriptionAr: 'd', color: '#ffffff' } });
    await mig.saudiCity.create({ data: { id: 'riyadh', nameAr: 'a', nameEn: 'a', regionAr: 'a' } });
    await mig.vendor.create({ data: { id: 'v1', businessName: 'm', businessNameEn: 'm', categoryId: 'c', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', contactPhone: '1', whatsappNumber: '1', cancellationPolicyAr: '' } });
    await mig.$executeRawUnsafe(`INSERT INTO "Review" ("id","vendorId","reviewerName","rating","commentAr","date","replyAr") VALUES ('old-1','v1','سارة',5,'ممتاز','2026-01-01','شكراً لكم'), ('old-2','v1','منى',4,'جيد','2026-01-02',NULL)`);
    r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', oldSchemaFile, '--file', 'prisma/sql/20261022-review-moderation.sql'], { env: oldEnv, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rows = await mig.$queryRawUnsafe(`SELECT "id","status","replyStatus","commerceItemId" FROM "Review" ORDER BY "id"`);
    assert.deepEqual(rows.map(x => [x.id, x.status, x.replyStatus]), [['old-1', 'approved', 'APPROVED'], ['old-2', 'approved', 'NONE']]);
    await mig.$executeRawUnsafe(`INSERT INTO "Review" ("id","vendorId","reviewerName","rating","commentAr","date") VALUES ('platform-1',NULL,'x',5,'تقييم لخدمة بلا مورد','2026-01-03')`); // vendorId is now optional
    const nullable = await mig.$queryRawUnsafe(`SELECT is_nullable FROM information_schema.columns WHERE table_schema = '${migSchema}' AND table_name = 'Review' AND column_name = 'vendorId'`);
    assert.equal(nullable[0].is_nullable, 'YES');
    assert.equal(spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', oldSchemaFile, '--file', 'prisma/sql/20261022-review-moderation.sql'], { env: oldEnv, encoding: 'utf8' }).status, 0, 'the migration can safely run twice');
    // the exact file Netlify applies (no BEGIN/COMMIT) behaves the same
    const netlifySql = fs.readFileSync('netlify/database/migrations/202610221200_review_moderation.sql', 'utf8');
    assert(!/BEGIN|COMMIT/.test(netlifySql));
    for (const statement of netlifySql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(';').map(x => x.trim()).filter(Boolean)) await mig.$executeRawUnsafe(statement);
    await mig.$disconnect();
    ok('the migration upgrades a database with old reviews: old replies stay public, vendorId becomes optional, and it is safe to run twice');

    // ---------------------------------------------------------------------------------------------------------------
    r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    await require('./seed-geography.cjs').seedGeography(db);
    await db.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true } });
    const mk = (name, phone, role) => db.user.create({ data: { name, phone, role } });
    const [noura, faisal, lens, hall, boss, root] = await Promise.all([mk('نورة العتيبي', '0500010001', 'CLIENT'), mk('فيصل الدوسري', '0500010002', 'CLIENT'), mk('عدسة', '0500010003', 'VENDOR'), mk('قاعة', '0500010004', 'VENDOR'), mk('مشرف', '0500010005', 'ADMIN'), mk('مدير النظام', '0500010006', 'SUPER_ADMIN')]);
    const vendorOf = async (user, name) => db.vendor.create({ data: { userId: user.id, businessName: name, businessNameEn: 'T', categoryId: 'entertainment', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: user.phone, whatsappNumber: user.phone, status: 'ACTIVE' } });
    const lensVendor = await vendorOf(lens, 'استوديو عدسة'), hallVendor = await vendorOf(hall, 'قاعة الأمل');
    const service = async (id, owner, vendor, title) => db.$executeRaw`INSERT INTO "CommerceService" ("id","ownerId","vendorId","body") VALUES (${id},${owner.id},${vendor.id},${JSON.stringify({ titleAr: title, managerIds: [owner.id] })}::jsonb)`;
    await service('svc-lens', lens, lensVendor, 'تصوير حفل'); await service('svc-hall', hall, hallVendor, 'قاعة أفراح');
    await db.$executeRaw`INSERT INTO "CommerceOffer" ("id","serviceId","body") VALUES ('offer-lens','svc-lens','{}'::jsonb), ('offer-hall','svc-hall','{}'::jsonb)`;
    const order = async (id, customer, items) => {
      await db.$executeRaw`INSERT INTO "CommerceOrder" ("id","customerId","number","body","idempotencyKey","requestHash") VALUES (${id},${customer.id},${'MC-' + id},'{}'::jsonb,${'k-' + id},${'h-' + id})`;
      for (const [itemId, serviceId, offerId, status] of items) await db.$executeRaw`INSERT INTO "CommerceOrderItem" ("id","orderId","serviceId","offerId","snapshot","body") VALUES (${itemId},${id},${serviceId},${offerId},${JSON.stringify({ titleAr: 'عنصر' })}::jsonb,${JSON.stringify({ status })}::jsonb)`;
    };
    await order('o1', noura, [['i-done', 'svc-lens', 'offer-lens', 'COMPLETED'], ['i-open', 'svc-lens', 'offer-lens', 'CONFIRMED'], ['i-hall', 'svc-hall', 'offer-hall', 'COMPLETED']]);
    await order('o2', faisal, [['i-faisal', 'svc-lens', 'offer-lens', 'COMPLETED']]);
    const cNoura = await session(noura), cFaisal = await session(faisal), cLens = await session(lens), cHall = await session(hall), cBoss = await session(boss), cRoot = await session(root);

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ---- 1. who may review ----
    const good = { itemId: 'i-done', rating: 5, commentAr: 'تصوير احترافي وتعامل راقٍ جداً' };
    assert.equal((await call('/api/reviews', 'POST', good)).status, 401);
    assert.equal((await call('/api/reviews', 'POST', { ...good, itemId: 'i-open' }, cNoura)).status, 409, 'a service that is not completed cannot be reviewed');
    assert.equal((await call('/api/reviews', 'POST', good, cFaisal)).status, 404, "another customer's item");
    assert.equal((await call('/api/reviews', 'POST', { ...good, itemId: 'nope' }, cNoura)).status, 404);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 'five' }, { commentAr: 'قصير' }, { commentAr: '' }, { commentAr: 'x'.repeat(2001) }, { qualityRating: 9 }]) assert.equal((await call('/api/reviews', 'POST', { ...good, ...bad }, cNoura)).status, 400, JSON.stringify(bad));
    const mineBefore = await call('/api/reviews/mine', 'GET', undefined, cNoura);
    assert.deepEqual(mineBefore.data.reviewable.map(x => x.itemId).sort(), ['i-done', 'i-hall']);
    ok('only the customer of a COMPLETED item can review it; bad ratings and comments are refused');

    // ---- 2. approve first ----
    const created = await call('/api/reviews', 'POST', { ...good, qualityRating: 4 }, cNoura);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(created.data.review.status, 'pending'); assert.equal(created.data.review.reviewerName, 'نورة ا.', 'public name is shortened');
    assert.equal((await call('/api/reviews', 'POST', good, cNoura)).status, 409, 'one review per item');
    const reviewId = created.data.review.id;
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews.length, 0, 'invisible before approval');
    assert.equal((await call('/api/reviews/vendor', 'GET', undefined, cLens)).data.reviews.length, 0, 'the vendor does not see unapproved reviews either');
    const pendingMine = (await call('/api/reviews/mine', 'GET', undefined, cNoura)).data;
    assert.equal(pendingMine.reviews[0].status, 'pending'); assert(!pendingMine.reviewable.some(x => x.itemId === 'i-done'));
    assert.equal((await call('/api/reviews/moderation?filter=pending', 'GET', undefined, cNoura)).status, 403);
    assert.equal((await call('/api/reviews/moderation?filter=pending', 'GET', undefined, cLens)).status, 403);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'APPROVE' }, cLens)).status, 403, 'a vendor cannot approve');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'APPROVE' }, cNoura)).status, 403, 'a customer cannot approve their own review');
    const queue = (await call('/api/reviews/moderation?filter=pending', 'GET', undefined, cBoss)).data;
    assert.equal(queue.counts.pending, 1); assert.equal(queue.reviews[0].vendorName, 'استوديو عدسة'); assert.equal(queue.reviews[0].serviceTitleAr, 'تصوير حفل');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'APPROVE' }, cBoss)).status, 200);
    const pub = (await call('/api/reviews?serviceId=svc-lens')).data;
    assert.equal(pub.reviews.length, 1); assert.equal(pub.summary.count, 1); assert.equal(pub.summary.average, 5);
    assert(!JSON.stringify(pub).includes(noura.id) && !JSON.stringify(pub).includes('نورة العتيبي'), 'no user id or full name in the public list');
    const lv = await db.vendor.findUnique({ where: { id: lensVendor.id } });
    assert.equal(lv.reviewsCount, 1); assert.equal(lv.rating, 5);
    ok('a new review is pending and invisible; only an administrator can approve it; then it is public with a shortened name and updates the vendor rating');

    // ---- 3. vendor replies, approve first ----
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'شكراً لثقتكم' }, cHall)).status, 404, "another vendor cannot reply");
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'شكراً لثقتكم' }, cNoura)).status, 404, 'a customer cannot reply');
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: '' }, cLens)).status, 400);
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'شكراً لثقتكم الغالية' }, cLens)).status, 200);
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews[0].replyAr, null, 'the reply is not public before approval');
    assert.equal((await call('/api/reviews/vendor', 'GET', undefined, cLens)).data.reviews[0].replyStatus, 'PENDING');
    assert.equal((await call('/api/reviews/moderation?filter=replies', 'GET', undefined, cBoss)).data.reviews.length, 1);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'REJECT_REPLY' }, cBoss)).status, 400, 'rejecting needs a reason');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'REJECT_REPLY', noteAr: 'الرد لا يحتوي شكراً مناسباً' }, cBoss)).status, 200);
    const rejected = (await call('/api/reviews/vendor', 'GET', undefined, cLens)).data.reviews[0];
    assert.equal(rejected.replyStatus, 'REJECTED'); assert.equal(rejected.replyNoteAr, 'الرد لا يحتوي شكراً مناسباً');
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'نشكرك على ثقتك ونسعد بخدمتك دائماً' }, cLens)).status, 200, 'the vendor can fix and resend');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'APPROVE_REPLY' }, cBoss)).status, 200);
    const withReply = (await call('/api/reviews?serviceId=svc-lens')).data.reviews[0];
    assert.equal(withReply.replyAr, 'نشكرك على ثقتك ونسعد بخدمتك دائماً');
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'تعديل بعد النشر' }, cLens)).status, 409, 'a published reply cannot be edited by the vendor');
    assert.equal((await call('/api/reviews/mine', 'GET', undefined, cNoura)).data.reviews[0].replyAr, 'نشكرك على ثقتك ونسعد بخدمتك دائماً', 'the customer sees the approved reply');
    ok('vendor replies wait for approval, can be rejected with a reason and resent, become public once approved, and then lock');

    // ---- 4. administrator tools ----
    const second = await call('/api/reviews', 'POST', { itemId: 'i-faisal', rating: 2, commentAr: 'تأخر الفريق كثيراً عن الموعد المحدد' }, cFaisal);
    const secondId = second.data.review.id;
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'ADMIN_REPLY', replyAr: 'نعتذر' }, cBoss)).status, 409, 'approve before replying');
    await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'APPROVE' }, cBoss);
    assert.equal((await db.vendor.findUnique({ where: { id: lensVendor.id } })).rating, 3.5, 'average of 5 and 2');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'ADMIN_REPLY', replyAr: 'نعتذر عن التأخير وتم التواصل مع المورد' }, cBoss)).status, 200);
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews.find(x => x.id === secondId).replyAr, 'نعتذر عن التأخير وتم التواصل مع المورد', 'an administrator reply is public at once');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'HIDE' }, cBoss)).status, 400, 'hiding needs a reason');
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'HIDE', noteAr: 'يحتوي معلومات شخصية' }, cBoss)).status, 200);
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews.length, 1, 'hidden reviews leave the public list');
    assert.equal((await db.vendor.findUnique({ where: { id: lensVendor.id } })).rating, 5, 'a hidden review no longer counts');
    const hiddenForCustomer = (await call('/api/reviews/mine', 'GET', undefined, cFaisal)).data.reviews[0];
    assert.equal(hiddenForCustomer.status, 'hidden'); assert.equal(hiddenForCustomer.moderationNoteAr, 'يحتوي معلومات شخصية');
    await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'APPROVE' }, cBoss);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'FEATURE' }, cBoss)).status, 200);
    assert.equal((await call('/api/reviews?featured=1')).data.reviews.map(x => x.id).join(), reviewId);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'REMOVE_REPLY', noteAr: 'رد غير لائق' }, cBoss)).status, 200);
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews.find(x => x.id === reviewId).replyAr, null);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'DELETE' }, cBoss)).status, 400);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: secondId, action: 'DELETE', noteAr: 'مكرر' }, cBoss)).status, 200);
    assert.equal(await db.review.count({ where: { id: secondId } }), 0);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: 'missing', action: 'APPROVE' }, cBoss)).status, 404);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'EXPLODE' }, cBoss)).status, 400);
    const audited = await db.systemAuditLog.findMany({ where: { action: { startsWith: 'REVIEW_' } } });
    for (const action of ['REVIEW_APPROVE', 'REVIEW_HIDE', 'REVIEW_FEATURE', 'REVIEW_DELETE', 'REVIEW_APPROVE_REPLY', 'REVIEW_REJECT_REPLY', 'REVIEW_ADMIN_REPLY', 'REVIEW_REMOVE_REPLY']) assert(audited.some(x => x.action === action && x.actorId === boss.id), action + ' is audited');
    ok('administrators can reply directly, hide (with a reason), restore, feature, remove replies and delete; every action is audited and vendor ratings follow');

    // ---- 5. the platform switch ----
    await db.systemFeature.upsert({ where: { id: 'reviews' }, create: { id: 'reviews', enabled: false, visible: true }, update: { enabled: false } });
    assert.equal((await call('/api/reviews', 'POST', { itemId: 'i-hall', rating: 5, commentAr: 'قاعة جميلة وخدمة ممتازة' }, cNoura)).status, 403, 'no new reviews while switched off');
    assert.equal((await call('/api/reviews/vendor', 'POST', { reviewId, replyAr: 'شكراً جزيلاً لكم' }, cLens)).status, 403, 'no vendor replies while switched off');
    assert.equal((await call('/api/reviews?serviceId=svc-lens')).data.reviews.length, 1, 'approved reviews stay visible');
    assert.equal((await call('/api/reviews/mine', 'GET', undefined, cNoura)).data.enabled, false);
    assert.equal((await call('/api/reviews/moderation', 'PATCH', { id: reviewId, action: 'UNFEATURE' }, cBoss)).status, 200, 'administrators can still moderate');
    await db.systemFeature.update({ where: { id: 'reviews' }, data: { enabled: true } });
    assert.equal((await call('/api/reviews', 'POST', { itemId: 'i-hall', rating: 5, commentAr: 'قاعة جميلة وخدمة ممتازة' }, cNoura)).status, 200, 'works again once switched on');
    const hallReview = (await db.review.findFirst({ where: { commerceItemId: 'i-hall' } }));
    assert.equal(hallReview.vendorId, hallVendor.id); assert.equal(hallReview.status, 'pending');
    assert.equal((await call('/api/reviews/vendor', 'GET', undefined, cLens)).data.reviews.every(x => x.id !== hallReview.id), true, "one vendor never sees another vendor's reviews");
    ok('switching the feature off stops new reviews and replies, keeps approved reviews visible and lets administrators keep moderating');
    void cRoot;
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    await db.$disconnect();
    for (const name of [schema, migSchema]) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig, oldSchemaFile]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS reviews: ${results.length} groups of checks (migration, eligibility, approve-first, vendor replies, moderation, platform switch)`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-1500)); process.exitCode = 1; });
