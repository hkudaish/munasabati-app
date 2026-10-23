// The assistant and the reminders: what administrators and vendors are reminded of, the questions Luma can answer exactly, how she learns
// from use, and the scheduled alerts. A throwaway schema in the LOCAL database and a separate Next server.
// npm run test:luma
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const ts = require('typescript');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Local database only.');
const schema = 'luma_test_' + randomBytes(6).toString('hex');
const url = new URL(base.toString()); url.searchParams.set('schema', schema);
const dist = '.next-lm-test-' + process.pid, tsconfig = '.lm-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(tsconfig, fs.readFileSync('tsconfig.json'));
const PORT = 3117, BASE = 'http://127.0.0.1:' + PORT, CRON = 'luma-cron-' + randomBytes(4).toString('hex');
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
const H = 3600000, at = hours => new Date(Date.now() + hours * H).toISOString();

// ---- the vocabulary is pure: test it without a server
const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const m = { exports: {} }; cache[file] = m; new Function('module', 'exports', 'require', js)(m, m.exports, require); return m.exports;
}
const vocab = load(path.resolve('src/lib/luma/vocabulary.ts'));

(async () => {
  try {
    const cats = [{ id: 'photography', nameAr: 'التصوير وتوثيق المناسبة', nameEn: 'Photography & Videography' }, { id: 'hall', nameAr: 'القاعات والمنتجعات والفنادق', nameEn: 'Venues, Halls & Resorts' }, { id: 'entertainment', nameAr: 'عروض وفنون وترفيه', nameEn: 'Entertainment & Ardah' }, { id: 'decor', nameAr: 'الكوشة والديكور وتنسيق الورد', nameEn: 'Kosha, Flowers & Decor' }];
    const cities = [{ id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' }, { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah' }, { id: 'khobar', nameAr: 'الدمام والخبر', nameEn: 'Dammam & Khobar' }, { id: 'qassim', nameAr: 'القصيم (بريدة وعنيزة)', nameEn: 'Qassim' }];
    assert.equal(vocab.matchCategory('أحتاج مصور زواج', cats).id, 'photography'); assert.equal(vocab.matchCategory('أفضل قاعة', cats).id, 'hall'); assert.equal(vocab.matchCategory('أبغى فنان', cats).id, 'entertainment');
    assert.equal(vocab.matchCategory('كوشة وورد', cats).id, 'decor'); assert.equal(vocab.matchCategory('كم الساعة', cats), null); assert.equal(vocab.matchCategory('التصوير وتوثيق المناسبة', cats).id, 'photography');
    assert.equal(vocab.matchCity('مصور بجدة', cities).id, 'jeddah'); assert.equal(vocab.matchCity('في الرياض', cities).id, 'riyadh'); assert.equal(vocab.matchCity('بالخبر', cities).id, 'khobar'); assert.equal(vocab.matchCity('عنيزة', cities).id, 'qassim'); assert.equal(vocab.matchCity('photographer in Jeddah', cities).id, 'jeddah'); assert.equal(vocab.matchCity('بدون مدينة', cities), null);
    assert.equal(vocab.categoryNoun(cats[0]), 'مصور'); assert.equal(vocab.categoryNoun({ id: 'x', nameAr: 'شيء آخر' }), 'شيء آخر');
    assert.equal(vocab.nextWeekday('الجمعة القادمة', new Date('2026-10-23T09:00:00Z')), '2026-10-30', 'on a Friday, "next Friday" is a week away'); assert.equal(vocab.nextWeekday('السبت', new Date('2026-10-23T09:00:00Z')), '2026-10-24'); assert.equal(vocab.nextWeekday('بلا يوم', new Date()), undefined);
    ok('the vocabulary resolves everyday words to the real categories and cities (and the real next weekday), and to nothing when there is no match');

    let r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const f of ['20261023-booking-drafts.sql', '20261023-luma-question-log.sql']) { r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', 'prisma/sql/' + f], { env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr); }
    await require('./seed-geography.cjs').seedGeography(db);
    const region = (id, en, ar) => db.geoRegion.upsert({ where: { id }, create: { id, countryCode: 'SA', nameAr: ar, nameEn: en }, update: {} });
    await region('r-riyadh', 'Riyadh Region', 'منطقة الرياض'); await region('r-makkah', 'Makkah Region', 'منطقة مكة');
    for (const c of [{ id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionId: 'r-riyadh' }, { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', regionId: 'r-makkah' }]) await db.saudiCity.upsert({ where: { id: c.id }, create: { ...c, regionAr: c.nameAr, countryCode: 'SA', isAvailable: true, defaultAvailable: true }, update: { isAvailable: true, defaultAvailable: true, regionId: c.regionId, countryCode: 'SA' } });
    await db.geoCountry.update({ where: { code: 'SA' }, data: { enabled: true } });
    for (const c of cats.filter(x => x.id !== 'hall')) await db.serviceCategory.upsert({ where: { id: c.id }, create: { ...c, iconName: 'i', descriptionAr: 'd', color: '#ffffff' }, update: { nameAr: c.nameAr, nameEn: c.nameEn } });

    const mk = (name, phone, role, extra = {}) => db.user.create({ data: { name, phone, role, ...extra } });
    const customer = await mk('نورة', '0500400001', 'CLIENT'), vA = await mk('استوديو الأفق', '0500400002', 'VENDOR', { email: 'a@test.local' }), vB = await mk('قاعة المدى', '0500400003', 'VENDOR'), vC = await mk('بدون طلبات', '0500400009', 'VENDOR'), boss = await mk('مشرفة', '0500400004', 'ADMIN'), root = await mk('مدير النظام', '0500400005', 'SUPER_ADMIN');
    const vendor = (user, name, category, city, status = 'ACTIVE', extra = {}) => db.vendor.create({ data: { userId: user.id, businessName: name, businessNameEn: 'T', categoryId: category, cityId: city, logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: user.phone, whatsappNumber: user.phone, status, verified: true, ...extra } });
    const vendorA = await vendor(vA, 'استوديو الأفق', 'photography', 'riyadh'), vendorB = await vendor(vB, 'قاعة المدى', 'venues', 'riyadh'); await vendor(vC, 'مورد بلا طلبات', 'entertainment', 'jeddah');
    const pendingUser = await mk('مورد جديد', '0500400006', 'VENDOR'); await vendor(pendingUser, 'مورد جديد بانتظار الاعتماد', 'decor', 'riyadh', 'UNDER_REVIEW');
    await db.review.create({ data: { vendorId: vendorA.id, reviewerName: 'ع', rating: 5, commentAr: 'ممتاز جداً ومحترفون', date: '2026-01-01', status: 'approved' } });
    await db.review.create({ data: { vendorId: vendorA.id, reviewerName: 'م', rating: 4, commentAr: 'جيد جداً', date: '2026-01-02', status: 'approved' } });
    await db.review.create({ data: { vendorId: vendorB.id, reviewerName: 'س', rating: 3, commentAr: 'تقييم تحت الانتظار', date: '2026-01-03', status: 'pending' } });
    const [cCust, cA, cB, cC, cBoss, cRoot] = await Promise.all([session(customer), session(vA), session(vB), session(vC), session(boss), session(root)]);

    // ---- orders in every state that matters
    const service = (id, owner, vend, title) => db.$executeRaw`INSERT INTO "CommerceService" ("id","ownerId","vendorId","body") VALUES (${id},${owner.id},${vend.id},${JSON.stringify({ titleAr: title, managerIds: [owner.id], published: true, approved: true, cities: ['riyadh'] })}::jsonb)`;
    await service('svc-a', vA, vendorA, 'تصوير حفل'); await service('svc-b', vB, vendorB, 'قاعة أفراح');
    await db.$executeRaw`INSERT INTO "CommerceOffer" ("id","serviceId","body") VALUES ('offer-a','svc-a','{}'::jsonb), ('offer-b','svc-b','{}'::jsonb)`;
    const order = async (id, hoursOld = 1) => db.$executeRaw`INSERT INTO "CommerceOrder" ("id","customerId","number","body","idempotencyKey","requestHash","createdAt") VALUES (${id},${customer.id},${'MC-' + id},'{}'::jsonb,${'k-' + id},${'h-' + id},${new Date(Date.now() - hoursOld * H)})`;
    const item = async (id, orderId, svc, offer, manager, body) => db.$executeRaw`INSERT INTO "CommerceOrderItem" ("id","orderId","serviceId","offerId","snapshot","body") VALUES (${id},${orderId},${svc},${offer},${JSON.stringify({ titleAr: svc === 'svc-a' ? 'تصوير حفل' : 'قاعة أفراح' })}::jsonb,${JSON.stringify({ managerIds: [manager.id], ...body })}::jsonb)`;
    await order('o1'); await order('o-old', 50);
    await item('i-due24', 'o1', 'svc-a', 'offer-a', vA, { status: 'CONFIRMED', startAt: at(10), endAt: at(14) });
    await item('i-due48', 'o1', 'svc-a', 'offer-a', vA, { status: 'CONFIRMED', startAt: at(40), endAt: at(44) });
    await item('i-late', 'o1', 'svc-a', 'offer-a', vA, { status: 'CONFIRMED', startAt: at(-3), endAt: at(1) });
    await item('i-over', 'o1', 'svc-a', 'offer-a', vA, { status: 'IN_PROGRESS', startAt: at(-6), endAt: at(-1) });
    await item('i-disp', 'o1', 'svc-a', 'offer-a', vA, { status: 'DISPUTED' });
    await item('i-cancel', 'o1', 'svc-a', 'offer-a', vA, { status: 'CANCELLATION_REQUESTED' });
    await item('i-wait', 'o-old', 'svc-a', 'offer-a', vA, { status: 'APPROVAL_PENDING' });
    await item('i-expire', 'o1', 'svc-a', 'offer-a', vA, { status: 'QUOTE_PENDING', expiresAt: at(5) });
    await item('i-note', 'o1', 'svc-a', 'offer-a', vA, { status: 'CONFIRMED', startAt: at(72), endAt: at(76), notes: 'الحفل في الحديقة، يرجى إحضار إضاءة إضافية' });
    await item('i-done', 'o1', 'svc-a', 'offer-a', vA, { status: 'COMPLETED', startAt: at(-90), endAt: at(-86) });
    await item('i-b-due', 'o1', 'svc-b', 'offer-b', vB, { status: 'CONFIRMED', startAt: at(30), endAt: at(34) });
    await db.$executeRaw`INSERT INTO "CommerceTransfer" ("id","orderId","kind","status","amount","reference","makerId","body","createdAt") VALUES ('t1','o1','PAYMENT','PENDING',50000,'ref-1',${boss.id},'{}'::jsonb,${new Date(Date.now() - 30 * H)})`;
    await db.$executeRaw`INSERT INTO "NotificationJob" ("id","userId","template","channel","status","dedupKey") VALUES ('dead-1',${customer.id},'cart_reminder','inbox','DEAD','dead-key-1')`;

    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
    let ready = false;
    for (let i = 0; i < 180; i++) { try { if ((await fetch(BASE + '/api/health/db')).ok) { ready = true; break; } } catch { /* starting */ } await new Promise(x => setTimeout(x, 1000)); }
    assert(ready, 'server did not start\n' + logs.slice(-1500));

    // ================================================================= 1. what each person is reminded of
    assert.equal((await call('/api/reminders')).status, 401); assert.equal((await call('/api/reminders', 'GET', undefined, cCust)).status, 403, 'customers have their own cart reminders, not these');
    const adm = must(await call('/api/reminders', 'GET', undefined, cBoss));
    const kinds = id => adm.reminders.filter(x => x.ref === id).map(x => x.kind + ':' + x.severity);
    assert.deepEqual(kinds('i-due24'), ['DUE_SOON:critical']); assert.deepEqual(kinds('i-due48'), ['DUE_SOON:warning']); assert.deepEqual(kinds('i-late'), ['OVERDUE_START:critical']); assert.deepEqual(kinds('i-over'), ['OVERDUE_COMPLETION:critical']);
    assert.deepEqual(kinds('i-disp'), ['PROBLEM:critical']); assert.deepEqual(kinds('i-cancel'), ['PROBLEM:warning']); assert.deepEqual(kinds('i-expire'), ['EXPIRING_SOON:critical']); assert.deepEqual(kinds('i-note'), ['CUSTOMER_NOTE:info']);
    assert.deepEqual(kinds('i-wait'), ['AWAITING_ACTION:warning'], 'an approval waiting two days'); assert.deepEqual(kinds('i-done'), [], 'finished work is not a reminder'); assert.deepEqual(kinds('i-b-due'), ['DUE_SOON:warning']);
    assert(adm.reminders.some(x => x.kind === 'FINANCE_REVIEW' && x.ref === 't1')); assert(adm.reminders.some(x => x.kind === 'REVIEW_MODERATION')); assert(adm.reminders.some(x => x.kind === 'VENDOR_APPROVAL' && /بانتظار الاعتماد/.test(x.detailAr))); assert(adm.reminders.some(x => x.kind === 'FAILED_NOTIFICATIONS'));
    const severities = adm.reminders.map(x => x.severity); assert.deepEqual(severities, [...severities].sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a] - { critical: 0, warning: 1, info: 2 }[b])), 'most urgent first');
    assert(adm.reminders.find(x => x.ref === 'i-note').detailAr.includes('إضاءة إضافية'), "the customer's note is quoted"); assert(adm.reminders.every(x => x.url && x.titleAr && x.detailAr));
    assert.equal(adm.counts.critical, adm.reminders.filter(x => x.severity === 'critical').length);
    assert.equal(must(await call('/api/reminders', 'GET', undefined, cRoot)).counts.total, adm.counts.total, 'a super administrator sees the same');
    const va = must(await call('/api/reminders', 'GET', undefined, cA)), vb = must(await call('/api/reminders', 'GET', undefined, cB)), vc = must(await call('/api/reminders', 'GET', undefined, cC));
    assert(va.reminders.length > 0 && va.reminders.every(x => !['FINANCE_REVIEW', 'REVIEW_MODERATION', 'VENDOR_APPROVAL', 'FAILED_NOTIFICATIONS'].includes(x.kind)), 'vendors never see platform-level items');
    assert(va.reminders.every(x => x.ref.startsWith('i-') && x.ref !== 'i-b-due'), 'a vendor sees only what they manage'); assert.deepEqual(vb.reminders.map(x => x.ref), ['i-b-due']); assert.deepEqual(vc.reminders, [], 'a vendor with nothing pending sees nothing');
    await sqlx`UPDATE "CommerceOrderItem" SET "body"=jsonb_set("body",'{status}','"COMPLETED"') WHERE "id"='i-late'`;
    assert.equal(must(await call('/api/reminders', 'GET', undefined, cBoss)).reminders.some(x => x.ref === 'i-late'), false, 'dealt with: it disappears');
    await sqlx`UPDATE "CommerceOrderItem" SET "body"=jsonb_set("body",'{status}','"CONFIRMED"') WHERE "id"='i-late'`;
    ok('administrators see every due, overdue, problem, waiting and noted item (most urgent first); vendors only their own; items vanish when resolved');

    // ================================================================= 2. Luma answers only what she can answer exactly
    assert.equal((await call('/api/luma/staff')).status, 401); assert.equal((await call('/api/luma/staff', 'GET', undefined, cCust)).status, 403); assert.equal((await call('/api/luma/staff', 'GET', undefined, cA)).status, 403, 'vendors have no assistant');
    assert.equal((await call('/api/luma/staff', 'POST', { text: 'أفضل مصور' }, cA)).status, 403);
    const sug = must(await call('/api/luma/staff', 'GET', undefined, cBoss)).suggestions;
    assert(sug.length >= 5); const labels = sug.map(s => s.label);
    assert(labels.includes('أفضل مصور في الرياض'), 'built from a real (service, city) pair'); assert(!labels.includes('أفضل مصور في جدة'), 'never a pair with no vendor');
    assert(labels.includes('ما الخدمات المستحقة خلال 48 ساعة؟'));
    for (const s of sug) { const a = must(await call('/api/luma/staff', 'POST', { intent: s.intent, params: s.params }, cBoss)); assert(!a.unknown && a.answerAr && Array.isArray(a.suggestions), 'every suggestion is answered: ' + s.label); }
    for (const s of sug) { const typed = must(await call('/api/luma/staff', 'POST', { text: s.label }, cBoss)); assert.equal(typed.intent, s.intent, 'typing a suggestion gives the same answer as tapping it: ' + s.label); assert.deepEqual(typed.params, s.params); }
    const top = must(await call('/api/luma/staff', 'POST', { text: 'أفضل المصورين في الرياض' }, cBoss));
    assert.equal(top.intent, 'VENDORS_TOP'); assert.deepEqual(top.params, { categoryId: 'photography', cityId: 'riyadh' }); assert.equal(top.vendors[0].businessName, 'استوديو الأفق'); assert.equal(top.vendors[0].rating, 4.5); assert.equal(top.vendors[0].reviews, 2);
    const noHall = must(await call('/api/luma/staff', 'POST', { text: 'أفضل مصور في جدة' }, cBoss)); assert.equal(noHall.vendors.length, 0); assert.match(noHall.answerAr, /لا يوجد موردون/);
    const due = must(await call('/api/luma/staff', 'POST', { text: 'ما الخدمات المستحقة خلال 48 ساعة؟' }, cBoss)); assert.equal(due.intent, 'REMINDERS_DUE'); assert(due.items.every(x => /مستحقة|ينتهي|سينتهي|حجز مؤقت/.test(x.titleAr))); assert(due.items.some(x => /i-/.test(x.id)) || due.items.length >= 3);
    const late = must(await call('/api/luma/staff', 'POST', { text: 'ما الخدمات المتأخرة؟' }, cBoss)); assert.equal(late.intent, 'REMINDERS_OVERDUE'); assert.equal(late.count, 2);
    const prob = must(await call('/api/luma/staff', 'POST', { text: 'هل توجد مشكلات مفتوحة؟' }, cBoss)); assert.equal(prob.intent, 'REMINDERS_PROBLEMS'); assert(prob.count >= 4, 'disputes, cancellation requests, notes and finance items');
    const wait = must(await call('/api/luma/staff', 'POST', { text: 'ما الطلبات التي تنتظر إجراء؟' }, cBoss)); assert.equal(wait.intent, 'AWAITING_ACTION'); assert(wait.count >= 2);
    const pend = must(await call('/api/luma/staff', 'POST', { text: 'من الموردون بانتظار الاعتماد؟' }, cBoss)); assert.equal(pend.intent, 'VENDORS_PENDING'); assert.equal(pend.rows[0].label, 'مورد جديد بانتظار الاعتماد');
    const gap = must(await call('/api/luma/staff', 'POST', { text: 'أين ينقصنا موردون في التصوير؟' }, cBoss)); assert.equal(gap.intent, 'COVERAGE_GAPS'); assert(gap.rows.some(x => x.label === 'جدة') && !gap.rows.some(x => x.label === 'الرياض'), 'Jeddah has no photographer, Riyadh has');
    const unknown = must(await call('/api/luma/staff', 'POST', { text: 'كم عمر الكون؟ اتصل بي على 0555123456789' }, cBoss));
    assert.equal(unknown.unknown, true); assert.match(unknown.answerAr, /لا أستطيع الإجابة/); assert(unknown.suggestions.length >= 5, 'she says what she CAN answer');
    assert.equal((await call('/api/luma/staff', 'POST', { intent: 'DROP_TABLES' }, cBoss)).status, 400); assert.equal((await call('/api/luma/staff', 'POST', {}, cBoss)).status, 400);
    ok('every suggested question is answered exactly from real data; free questions are understood or declined (never guessed), and a refusal always lists what she can answer');

    // ================================================================= 3. she learns from use, without keeping people's words
    for (let i = 0; i < 3; i++) must(await call('/api/luma/staff', 'POST', { text: 'أفضل مصور في الرياض' }, cBoss));
    must(await call('/api/luma/staff', 'POST', { text: 'من الموردون بانتظار الاعتماد؟' }, cBoss));
    const learned = must(await call('/api/luma/staff', 'GET', undefined, cBoss)).suggestions;
    assert.equal(learned[0].label, 'أفضل مصور في الرياض'); assert.equal(learned[0].learned, true, 'what colleagues asked most, successfully, comes first');
    const insights = must(await call('/api/admin/luma-insights', 'GET', undefined, cBoss));
    assert(insights.top.some(t => t.intent === 'VENDORS_TOP' && t.asked >= 4)); assert(insights.unanswered.some(u => u.text.startsWith('كم عمر الكون')), 'the unanswered question is reported to administrators');
    assert(!insights.unanswered.some(u => /\d{7,}/.test(u.text)), 'phone-like numbers never reach the log'); assert(insights.noResults.some(n => n.categoryId === 'photography' && n.cityId === 'jeddah'), 'searches that found nothing are reported as gaps');
    assert.equal((await call('/api/admin/luma-insights', 'GET', undefined, cCust)).status, 403); assert.equal((await call('/api/admin/luma-insights', 'GET', undefined, cA)).status, 403);
    must(await call('/api/luma/log', 'POST', { intent: 'SEARCH_VENDOR', categoryId: 'photography', cityId: 'riyadh', resultCount: 3, text: 'اسمي نورة ورقمي 0555000111' }));
    must(await call('/api/luma/log', 'POST', { intent: 'SEARCH_VENDOR', categoryId: 'photography', cityId: 'riyadh', resultCount: 2 }));
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "LumaQuestionLog" WHERE "audience"='customer' AND "text" IS NOT NULL`)[0].n, 0, "a customer's words are never stored");
    assert.equal(must(await call('/api/luma/log')).popular[0].n, 2); assert.equal((await call('/api/luma/log', 'POST', { intent: 'bad intent!' })).status, 400);
    ok('successful questions rise in her suggestions, unanswered ones and empty searches are reported to administrators, and no customer text or phone number is stored');

    // ================================================================= 4. scheduled alerts: once per item, rechecked, respecting consent
    assert.equal((await fetch(BASE + '/api/internal/notifications-cron', { method: 'POST' })).status, 401);
    let run = await cron(); assert.equal(run.status, 200, JSON.stringify(run.data));
    const alerts = await sql`SELECT "userId","dedupKey","status" FROM "NotificationJob" WHERE "template"='ops_alert'`;
    const forUser = (u, ref) => alerts.filter(a => a.userId === u.id && a.dedupKey.includes(':' + ref + ':')).length;
    for (const ref of ['i-due24', 'i-late', 'i-over', 'i-disp', 'i-expire']) { assert.equal(forUser(boss, ref), 1, 'the administrator is alerted once about ' + ref); assert.equal(forUser(vA, ref), 1, 'so is the vendor who manages it: ' + ref); }
    assert.equal(forUser(vB, 'i-due24'), 0); assert.equal(alerts.filter(a => a.userId === customer.id).length, 0, 'customers get no operational alerts'); assert.equal(alerts.filter(a => a.userId === vC.id).length, 0);
    assert.equal(forUser(boss, 'i-due48'), 0, 'warnings and notes are not alerts; they are in the digest');
    assert(alerts.every(a => a.status === 'SENT'), JSON.stringify(alerts.map(a => a.status)));
    const inbox = await sql`SELECT "body" FROM "ServiceInbox" WHERE "userId"=${vA.id} AND "body"->>'referenceType'='OPS'`;
    assert(inbox.length >= 4); assert(inbox.every(m => m.body.url.startsWith('/commerce/orders?id=') || m.body.url === '/reminders'), 'alerts open the order, the digest opens the reminders page'); assert(inbox.filter(m => m.body.url.startsWith('/commerce/orders?id=')).length >= 4); assert(inbox.some(m => /حان موعد التنفيذ/.test(m.body.titleAr)));
    const riyadhHour = new Date(Date.now() + 3 * H).getUTCHours();
    const digests = await sql`SELECT "userId" FROM "NotificationJob" WHERE "template"='ops_digest'`;
    if (riyadhHour >= 7) { assert(digests.some(d => d.userId === boss.id) && digests.some(d => d.userId === vB.id), 'the daily digest after 07:00'); assert(!digests.some(d => d.userId === vC.id), 'no digest when there is nothing to report'); } else assert.equal(digests.length, 0, 'no digest before 07:00');
    const count = async () => (await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob"`)[0].n; const before = await count();
    await cron(); assert.equal(await count(), before, 'a second run alerts nobody twice');
    const page = must(await call('/api/reminders', 'GET', undefined, cA)); assert(page.recent.length >= 4, 'what was sent is listed on the reminders page');
    // a problem solved before the message goes out is not announced
    await sqlx`INSERT INTO "NotificationJob" ("id","userId","template","channel","dedupKey","payload") VALUES ('stale-1',${boss.id},'ops_alert','inbox','ops:stale:1',${JSON.stringify({ ref: 'OVERDUE_START:gone-item' })}::jsonb)`;
    await cron(); const stale = (await sql`SELECT "status","lastError" FROM "NotificationJob" WHERE "id"='stale-1'`)[0]; assert.equal(stale.status, 'SKIPPED'); assert.equal(stale.lastError, 'resolved');
    // consent and the switch
    await sqlx`INSERT INTO "NotificationPreference" ("userId","channel","enabled") VALUES (${vB.id},'inbox',false)`;
    await sqlx`UPDATE "CommerceOrderItem" SET "body"=jsonb_set("body",'{startAt}',to_jsonb(${at(5)}::text)) WHERE "id"='i-b-due'`;
    await cron(); assert.equal((await sql`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${vB.id} AND "template"='ops_alert'`)[0].n, 0, 'a vendor who switched the inbox off is not alerted');
    must(await call('/api/admin/notification-settings', 'PATCH', { settings: { ops: { enabled: false } } }, cBoss));
    await sqlx`UPDATE "CommerceOrderItem" SET "body"=jsonb_set("body",'{status}','"DISPUTED"') WHERE "id"='i-note'`;
    const b2 = await count(); await cron(); assert.equal(await count(), b2, 'with operational alerts switched off nothing new is queued');
    assert.equal(must(await call('/api/admin/notification-settings', 'GET', undefined, cBoss)).settings.ops.enabled, false);
    ok('urgent items alert administrators and the vendors who manage them once each, a digest follows each morning, resolved problems are not announced, consent and the administrator switch are respected');
  } finally {
    if (server) { server.kill(); await new Promise(x => setTimeout(x, 800)); }
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await admin.$disconnect();
    for (const target of [dist, tsconfig]) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(`\nPASS luma: ${results.length} groups of checks`);
})().catch(e => { console.error('FAIL', e.stack || e.message, '\n--- server log tail ---\n' + logs.slice(-2500)); process.exitCode = 1; });
