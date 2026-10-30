// End to end: advance-notice exceptions and exceptional reschedules, in an isolated database schema and a private dev server.
// Covers the acceptance scenarios: notice met / not met, exception request, provider approval and rejection, offer, customer approval / refusal / expiry,
// payment and confirmation, a failed payment, availability lost before confirmation, reschedule (applied and refused), unapproved vendors, coverage,
// packages with different notice, concurrent and repeated submissions, permissions, audit trail, notifications, dashboard and export.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { spawn, spawnSync } = require('node:child_process'), { randomBytes, createHash } = require('node:crypto'), { PrismaClient } = require('@prisma/client');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const schema = 'exc_test_' + randomBytes(8).toString('hex'), url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const dist = '.next-exc-test-' + process.pid, config = '.exc-test-tsconfig-' + process.pid + '.json'; fs.writeFileSync(config, fs.readFileSync('tsconfig.json'));
const port = 3108, base = 'http://localhost:' + port;
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: config, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: base };
const db = new PrismaClient({ datasourceUrl: url.toString() }); let server, logs = '';
async function call(route, method = 'GET', data, cookie) {
  const r = await fetch(base + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: base }, body: data ? JSON.stringify(data) : undefined });
  const raw = await r.text(); let d; try { d = JSON.parse(raw); } catch { d = { error: raw.slice(0, 400) }; } return { status: r.status, data: d, raw };
}
const ok = r => (assert.equal(r.status, 200, JSON.stringify(r.data)), r.data);
const zonedTest = (date, time) => new Date(`${date}T${time}:00+03:00`).toISOString();
const riyadhDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(ms));
const DAY = 86400000, near = riyadhDay(Date.now() + DAY), far = riyadhDay(Date.now() + 20 * DAY), far2 = riyadhDay(Date.now() + 22 * DAY), mid = riyadhDay(Date.now() + 2 * DAY);

(async () => {
  const push = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' }); assert.equal(push.status, 0, push.stdout + push.stderr);
  const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', 'netlify/database/migrations/202610300001_exception_requests.sql', '--schema', 'prisma/schema.prisma'], { env, encoding: 'utf8' }); assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
  await require('./seed-geography.cjs').seedGeography(db);
  await db.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true } });
  await db.$executeRaw`UPDATE "SystemFeature" SET "enabled"=true WHERE "id"='booking_exceptions'`;

  // people: customer A and B, vendors V1 and V2, super admin, second admin, coordinator, supervisor, a vendor still under review
  const roles = [['CLIENT', 'A'], ['CLIENT', 'B'], ['VENDOR', 'V1'], ['VENDOR', 'V2'], ['SUPER_ADMIN', 'S'], ['ADMIN', 'S2'], ['CLIENT', 'COORD'], ['CLIENT', 'SUP'], ['VENDOR', 'NEW']];
  const users = [], cookies = [];
  for (const [i, [role, tag]] of roles.entries()) {
    const u = await db.user.create({ data: { name: 'اختبار ' + tag, phone: '05000400' + i + '0', email: `exc${i}@test.example`, role } }); users.push(u);
    const token = randomBytes(32).toString('base64url'); cookies.push('munasabati_session=' + token);
    await db.authSession.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), userId: u.id, expiresAt: new Date(Date.now() + 3600000) } });
  }
  const [A, B, V1, V2, S, S2, COORD, SUP, NEW] = cookies, [uA, uB, uV1, uV2, uS, uS2, uCOORD, uSUP, uNEW] = users;
  const vendors = [];
  for (const [i, status] of [[2, 'ACTIVE'], [3, 'ACTIVE'], [8, 'UNDER_REVIEW']]) vendors.push(await db.vendor.create({ data: { userId: users[i].id, businessName: 'مقدم ' + i, businessNameEn: 'Test ' + i, categoryId: 'photography', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: users[i].phone, whatsappNumber: users[i].phone, status } }));
  await db.$executeRaw`INSERT INTO "StaffRole" ("userId","role","grantedBy") VALUES (${uCOORD.id},'COORDINATOR',${uS.id}),(${uSUP.id},'BOOKING_SUPERVISOR',${uS.id})`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
  let ready = false; for (let n = 0; n < 150 && !ready; n++) { try { ready = (await fetch(base + '/api/booking-notice?offerId=x&cityId=riyadh&date=2030-01-01&time=10:00')).status > 0; } catch { await new Promise(r => setTimeout(r, 2000)); } } assert(ready, 'server did not start');

  // ---- catalog: one service with a 3-day notice (V1), one with 12 hours (V2) and one that is closed for booking
  const calendar = { minNoticeHours: 0, bufferMinutes: 0 };
  const policy = (extra = {}) => ({ baseAmount: 100000, bookingMode: 'DIRECT', durationMinutes: 120, minDurationMinutes: 60, maxDurationMinutes: 2880, depositBps: 0, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 10000, beforeHours: 0 }], calendar, ...extra });
  const svcBody = (title, vendorUser, notice, extra = {}) => ({ titleAr: title, descriptionAr: 'وصف', kind: 'BOOKABLE', categoryId: 'photography', subcategoryId: null, artistId: null, cities: ['riyadh'], managerIds: [vendorUser.id], resourceIds: [], published: true, approved: true, images: [], videoUrls: [], advanceNotice: notice, ...extra });
  const rule3d = { enabled: true, value: 3, unit: 'day', allowExceptionRequests: true, preparationMinutes: 0, serviceDurationMinutes: 120 };
  const svcA = ok(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-svc-a', body: svcBody('تصوير زفاف', uV1, rule3d) }, S)).entity;
  const svcB = ok(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-svc-b', body: svcBody('ضيافة', uV2, { enabled: true, value: 12, unit: 'hour', allowExceptionRequests: true }) }, S)).entity;
  const svcClosed = ok(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-svc-closed', body: svcBody('خدمة مغلقة', uV1, { enabled: true, value: 1, unit: 'day', allowExceptionRequests: true, cutoffAt: new Date(Date.now() - 3600000).toISOString() }) }, S)).entity;
  const svcNoExc = ok(await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-svc-no', body: svcBody('خدمة بلا استثناء', uV1, { enabled: true, value: 3, unit: 'day', allowExceptionRequests: false }) }, S)).entity;
  assert.equal(svcA.body.advanceNotice.value, 3, 'the rule is saved with the service');
  assert.equal((await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-bad', body: svcBody('خطأ', uV1, { enabled: true, value: 5, unit: 'year' }) }, S)).status, 400, 'an invalid rule is refused');
  const offer = async (id, svc, extra, cookie = S) => ok(await call('/api/commerce/manage', 'POST', { kind: 'OFFER', id, serviceId: svc.id, body: { nameAr: id, model: 'FIXED', enabled: true, allowPackages: true, holdMinutes: 15, policy: policy(extra) } }, cookie)).entity;
  const offA = await offer('exc-offer-a', svcA), offA2 = await offer('exc-offer-a2', svcA), offA3 = await offer('exc-offer-a3', svcA), offA4 = await offer('exc-offer-a4', svcA, { depositBps: 3000, paymentMilestones: [{ nameAr: 'الرصيد', percentBps: 7000, beforeHours: 0 }] });
  const offB = await offer('exc-offer-b', svcB), offClosed = await offer('exc-offer-closed', svcClosed), offNo = await offer('exc-offer-no', svcNoExc);
  const pack = ok(await call('/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: 'exc-package', body: { nameAr: 'باقة اختبار', descriptionAr: 'باقة', published: true, discountBps: 0, kind: 'FIXED' }, items: [{ id: 'exc-package-a', offerId: offA.id, quantity: 1, durationMinutes: 120, optional: false, substitutions: [] }, { id: 'exc-package-b', offerId: offB.id, quantity: 1, durationMinutes: 120, optional: false, substitutions: [] }] }, S)).entity;
  // a vendor still under review cannot publish anything
  assert.equal((await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-unapproved', body: svcBody('خدمة بلا اعتماد', uNEW, rule3d) }, NEW)).status, 403, 'a vendor that is not approved cannot publish services');

  const screens = async () => {
    // the real-browser check of the screens (phone width); ONLY_UI=1 runs just this, RUN_EXC_BROWSER=1 runs it after the scenarios
    const out = await require('./test-exceptions-browser.cjs')({ base, cookies: { customer: A, vendor: V1, admin: S }, serviceId: svcA.id, offerId: offA.id, near, call, shots: process.env.SHOTS });
    console.log('PASS exception screens in a real browser at 390px: notice hint, dialog wording, request form, request page, provider view, staff dashboard, vendor approvals', out.number);
  };
  if (process.env.ONLY_UI === '1') { await screens(); return; }
  const line = (offerId, date, time = '18:00', extra = {}) => ({ id: randomBytes(8).toString('hex'), offerId, cityId: 'riyadh', date, time, durationMinutes: 120, quantity: 1, guestCount: 10, fields: {}, options: [], ...extra });
  async function cart(lines, cookie = A) { const old = ok(await call('/api/commerce/cart', 'GET', undefined, cookie)); return call('/api/commerce/cart', 'PUT', { version: old.cart.version, lines }, cookie); }
  async function buy(c, cookie = A) { return call('/api/commerce/orders', 'POST', { cartVersion: c.cart.version, quoteHash: c.quote.hash, idempotencyKey: randomBytes(16).toString('hex'), acceptTerms: true }, cookie); }
  const form = (selection, extra = {}) => ({ kind: 'NOTICE', selection, reason: 'مناسبة طارئة', urgencyDetails: 'تغير موعد الحفل بشكل مفاجئ', customerNotes: '', contact: { name: 'اختبار', phone: '0500040010' }, acknowledge: true, ...extra });
  const detail = async (id, cookie = A) => ok(await call('/api/exceptions/' + id, 'GET', undefined, cookie));
  const act = (id, action, version, data = {}, cookie = A) => call('/api/exceptions/' + id, 'POST', { action, version, ...data }, cookie);
  const actOk = async (id, action, cookie, data = {}) => { const d = await detail(id, cookie); return ok(await act(id, action, d.request.version, data, cookie)).request; };

  // 1. notice met: the storefront says so, the cart takes it and the order can be placed
  let n = ok(await call(`/api/booking-notice?offerId=${offA.id}&cityId=riyadh&date=${far}&time=18:00`));
  assert.equal(n.ok, true); assert.equal(n.requiredMinutes, 4320);
  let c = await cart([line(offA.id, far)]); assert.equal(c.status, 200, JSON.stringify(c.data)); assert.equal(c.data.quote.totals.total, 115000);
  ok(await buy(c.data)); await cart([]);

  // 2. notice not met: the screen is told, the server refuses the cart and offers the exception
  n = ok(await call(`/api/booking-notice?offerId=${offA.id}&cityId=riyadh&date=${near}&time=18:00`));
  assert.equal(n.ok, false); assert.equal(n.requiredMinutes, 4320); assert(n.remainingMinutes < 4320); assert.equal(n.canRequestException, true);
  c = await cart([line(offA.id, near)]); assert.equal(c.status, 409); assert.equal(c.data.code, 'ADVANCE_NOTICE'); assert.equal(c.data.canRequestException, true);
  let nb = ok(await call(`/api/booking-notice?offerId=${offClosed.id}&cityId=riyadh&date=${far}&time=18:00`)); assert.equal(nb.cutoffPassed, true); assert.equal(nb.canRequestException, false, 'a closed booking takes no exception');
  nb = ok(await call(`/api/booking-notice?offerId=${offNo.id}&cityId=riyadh&date=${near}&time=18:00`)); assert.equal(nb.canRequestException, false, 'a service that refuses exceptions');
  assert.equal((await call('/api/exceptions', 'POST', form(line(offNo.id, near)), A)).status, 409);
  assert.equal((await call('/api/exceptions', 'POST', form(line(offClosed.id, far)), A)).status, 409);
  assert.equal((await call('/api/exceptions', 'POST', form(line(offA.id, far)), A)).status, 409, 'no exception when the notice is already met');
  assert.equal((await call('/api/exceptions', 'POST', form(line(offA.id, near), { acknowledge: false }), A)).status, 400, 'the acknowledgement is required');
  assert.equal((await call('/api/exceptions', 'POST', form({ ...line(offA.id, near), cityId: 'jeddah' }), A)).status >= 400, true, 'a city outside the service coverage');
  assert.equal((await call('/api/exceptions', 'POST', form(line(offA.id, near)))).status, 401);

  // 3. submit; a repeat (even two at once) is the same request
  const sel = line(offA.id, near);
  const both = await Promise.all([call('/api/exceptions', 'POST', form(sel), A), call('/api/exceptions', 'POST', form(sel), A)]); both.forEach(ok);
  const exc = both[0].data.request; assert.equal(both[0].data.request.id, both[1].data.request.id, 'two simultaneous submissions make one request'); assert.equal(exc.status, 'awaiting_provider_approval'); assert.match(exc.number, /^EX-\d{8}-[A-Z2-9]{6}$/);
  assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ExceptionRequest"`)[0].n, 1);
  assert.equal(ok(await call('/api/exceptions', 'POST', form(sel), A)).duplicate, true);
  let d = await detail(exc.id); assert.equal(d.request.requiredNoticeMinutes, 4320); assert.equal(d.steps.filter(s => s.stage === 'FEASIBILITY' && s.status === 'PENDING').length, 1);
  assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "CustomerConsent" WHERE "kind"='EXCEPTION_ACK'`)[0].n, 1); assert.deepEqual(d.actions.map(a => a.action).sort(), ['CANCEL']);

  // permissions
  assert.equal((await call('/api/exceptions/' + exc.id, 'GET', undefined, B)).status, 404, 'another customer cannot see it');
  assert.equal((await call('/api/exceptions/' + exc.id, 'GET', undefined, V2)).status, 404, 'another vendor cannot see it');
  assert.equal((await call('/api/exceptions/' + exc.id, 'GET', undefined, COORD)).status, 404, 'a coordinator sees only what is assigned');
  assert.equal((await act(exc.id, 'APPROVE_FEASIBILITY', d.request.version, {}, A)).status, 403, 'a customer cannot approve feasibility');
  assert.equal((await act(exc.id, 'CONFIRM', d.request.version, {}, S)).status >= 400, true, 'confirmation is never an action');
  assert.equal((await act(exc.id, 'SEND_OFFER', d.request.version, {}, V1)).status, 409, 'the stages cannot be skipped');
  assert.equal((await act(exc.id, 'APPROVE_FEASIBILITY', 999, {}, V1)).status, 409, 'a stale screen cannot act');
  assert.equal((await call('/api/exceptions/' + exc.id, 'GET', undefined, V1)).status, 200); assert.equal(ok(await call('/api/exceptions', 'GET', undefined, V2)).requests.length, 0);

  // 4. provider approves feasibility: a coordinator is assigned automatically, nothing is confirmed
  let r = await actOk(exc.id, 'APPROVE_FEASIBILITY', V1); assert.equal(r.status, 'assigned_to_coordinator'); assert.equal(r.assignedCoordinatorId, uCOORD.id);
  assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ServiceRequest"`)[0].n, 1, 'approval creates no booking'); assert.equal((await call('/api/exceptions/' + exc.id, 'GET', undefined, COORD)).status, 200);

  // 5. coordinator negotiates, records contacts, prepares and sends the offer
  r = await actOk(exc.id, 'START_NEGOTIATION', COORD); assert.equal(r.status, 'negotiating');
  ok(await act(exc.id, 'LOG_CONTACT', r.version, { channel: 'PHONE', party: 'CUSTOMER', outcome: 'وافق العميل مبدئياً على رسوم الاستعجال' }, COORD));
  assert.equal((await detail(exc.id, COORD)).negotiation.length, 1); assert.equal((await detail(exc.id, A)).negotiation.length, 0, 'the customer does not see internal negotiation');
  assert.equal((await act(exc.id, 'PREPARE_OFFER', (await detail(exc.id, COORD)).request.version, { exceptionFee: 20000, discount: 30000 }, COORD)).status, 400, 'the discount cannot exceed the fee');
  r = await actOk(exc.id, 'PREPARE_OFFER', COORD, { exceptionFee: 20000, discount: 0 }); assert.equal(r.status, 'offer_prepared');
  d = await detail(exc.id, COORD); assert.equal(d.offers[0].total, 138000, '1000 + 200 fee + 15% VAT'); assert.equal((await detail(exc.id, A)).offers.length, 0, 'a draft is invisible to the customer');
  assert.equal((await act(exc.id, 'SEND_OFFER', d.request.version, {}, V1)).status, 403, 'a provider cannot send offers'); assert.equal((await act(exc.id, 'SEND_OFFER', d.request.version, {}, A)).status, 403, 'neither can the customer');
  r = await actOk(exc.id, 'SEND_OFFER', COORD); assert.equal(r.status, 'awaiting_customer_approval');
  const sent = (await detail(exc.id, A)).offers[0]; assert.equal(sent.status, 'SENT'); assert(sent.expiresAt);
  await assert.rejects(() => db.$executeRaw`UPDATE "ExceptionOffer" SET "total"=1 WHERE "id"=${sent.id}`, 'a sent offer is frozen');
  await assert.rejects(() => db.$executeRaw`DELETE FROM "ExceptionEvent"`, 'history cannot be deleted');
  const link = (await db.$queryRaw`SELECT "payload" FROM "ExceptionNotification" WHERE "event"='OFFER_SENT' AND "channel"='sms'`)[0].payload.link; assert.match(link, /\/exceptions\/offer\//);
  const linkToken = link.split('/').pop(); let lookup = ok(await call('/api/exceptions/offer/' + linkToken)); assert.equal(lookup.requestId, exc.id); assert.equal(lookup.signedIn, false);
  assert.equal((await call('/api/exceptions/offer/' + linkToken, 'GET', undefined, B)).status, 403, 'the link does not work for another account'); assert.equal((await call('/api/exceptions/offer/not-a-token')).status, 404);

  // 6. customer approves exactly this version; the booking does not exist yet
  assert.equal((await act(exc.id, 'CUSTOMER_ACCEPT', (await detail(exc.id, A)).request.version, { offerVersion: 99, confirm: true }, A)).status, 409, 'a different version');
  assert.equal((await act(exc.id, 'CUSTOMER_ACCEPT', (await detail(exc.id, A)).request.version, { offerVersion: sent.version }, A)).status, 400, 'explicit confirmation is required');
  assert.equal((await act(exc.id, 'CUSTOMER_ACCEPT', (await detail(exc.id, V1)).request.version, { offerVersion: sent.version, confirm: true }, V1)).status, 403, 'only the customer can approve the price');
  r = ok(await act(exc.id, 'CUSTOMER_ACCEPT', (await detail(exc.id, A)).request.version, { offerVersion: sent.version, confirm: true }, A)).request; assert.equal(r.status, 'awaiting_payment');
  const consent = (await db.$queryRaw`SELECT * FROM "CustomerConsent" WHERE "kind"='OFFER_ACCEPT'`)[0]; assert.equal(consent.offerVersion, sent.version); assert(consent.ip && consent.text.includes('أوافق'));
  assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ServiceRequest"`)[0].n, 1);

  // 7. nobody else can ride on this approval; the cart takes the customer's own approved booking at exactly the agreed price
  assert.equal((await cart([{ ...line(offA.id, near), exceptionId: exc.id }], B)).status, 409, "another customer cannot use someone else's exception");
  assert.equal((await cart([{ ...line(offA.id, near, '19:00'), exceptionId: exc.id }])).status, 409, 'a different time is not covered');
  assert.equal((await cart([{ ...line(offA2.id, near), exceptionId: exc.id }])).status, 409, 'a different offer is not covered');
  ok(await call('/api/exceptions/' + exc.id + '/cart', 'POST', undefined, A));
  let cc = ok(await call('/api/commerce/cart', 'GET', undefined, A)); assert.equal(cc.quote.totals.total, 138000, 'the cart charges the approved price, fee included');
  assert.equal((await call('/api/exceptions/' + exc.id + '/cart', 'POST', undefined, B)).status, 404);
  // payment is required before confirmation: a 30% deposit offer is also tried below; here the deposit is 0
  const order = ok(await buy(cc)).order; assert.equal(order.totals.total, 138000);
  assert.equal((await db.$queryRaw`SELECT "bookingRequestId" FROM "ExceptionRequest" WHERE "id"=${exc.id}`)[0].bookingRequestId !== null, true, 'the booking is linked to the exception');
  const bookingRow = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${(await db.$queryRaw`SELECT "bookingRequestId" FROM "ExceptionRequest" WHERE "id"=${exc.id}`)[0].bookingRequestId}`)[0]; assert.equal(bookingRow.body.exceptionId, exc.id);
  // 8. final confirmation by the platform; repeating it does nothing twice
  const confirmed = ok(await call('/api/commerce/orders', 'PATCH', { id: order.id, version: order.version, action: 'CONFIRM_ALL' }, S)).order; assert(confirmed.items.filter(i => i.bookingId).every(i => i.bookingStatus === 'CONFIRMED'));
  d = await detail(exc.id, A); assert.equal(d.request.status, 'completed'); assert.equal(d.summary.statusAr, 'مكتمل ومؤكد');
  assert.equal((await call('/api/commerce/orders', 'PATCH', { id: order.id, version: order.version, action: 'CONFIRM_ALL' }, S)).status >= 400, true, 'a repeat confirmation is refused');
  assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ExceptionEvent" WHERE "requestId"=${exc.id} AND "action"='CONFIRM'`)[0].n, 1);
  assert.deepEqual((await db.$queryRaw`SELECT "action" FROM "ExceptionEvent" WHERE "requestId"=${exc.id} ORDER BY "createdAt","id"`).map(e => e.action).filter(a => ['SUBMIT', 'REVIEW', 'REQUEST_PROVIDER', 'APPROVE_FEASIBILITY', 'ASSIGN', 'START_NEGOTIATION', 'PREPARE_OFFER', 'SEND_OFFER', 'CUSTOMER_ACCEPT', 'REQUEST_PAYMENT', 'CONFIRM', 'COMPLETE'].includes(a)), ['SUBMIT', 'REVIEW', 'REQUEST_PROVIDER', 'APPROVE_FEASIBILITY', 'ASSIGN', 'START_NEGOTIATION', 'PREPARE_OFFER', 'SEND_OFFER', 'CUSTOMER_ACCEPT', 'REQUEST_PAYMENT', 'CONFIRM', 'COMPLETE'], 'every stage left its mark, in order');
  assert((await db.$queryRaw`SELECT * FROM "SystemAuditLog" WHERE "action"='EXCEPTION_BOOKING_CONFIRMED'`).length === 1);
  assert((await call('/api/exceptions/inbox', 'GET', undefined, A)).data.notifications.length >= 5, 'the customer was notified along the way');
  const dupes = await db.$queryRaw`SELECT "dedupKey", COUNT(*)::int n FROM "ExceptionNotification" GROUP BY "dedupKey" HAVING COUNT(*) > 1`; assert.equal(dupes.length, 0, 'no message twice');

  // 9. rejection by the provider; the request is closed and nothing is booked
  const rej = ok(await call('/api/exceptions', 'POST', form(line(offA2.id, near, '17:00')), A)).request;
  assert.equal((await act(rej.id, 'REJECT', rej.version, {}, V1)).status, 400, 'a reason is required');
  r = await actOk(rej.id, 'REJECT', V1, { note: 'الفريق مشغول في هذا اليوم' }); assert.equal(r.status, 'rejected');
  assert.equal((await act(rej.id, 'CANCEL', r.version, {}, A)).status, 409, 'a closed request stays closed');

  // 10. the customer refuses the price: the request ends, no booking
  const dec = ok(await call('/api/exceptions', 'POST', form(line(offA3.id, near, '16:00')), A)).request;
  await actOk(dec.id, 'APPROVE_FEASIBILITY', V1); await actOk(dec.id, 'START_NEGOTIATION', COORD); await actOk(dec.id, 'PREPARE_OFFER', COORD, { exceptionFee: 50000 }); await actOk(dec.id, 'SEND_OFFER', COORD);
  const decOffer = (await detail(dec.id, A)).offers[0]; r = ok(await act(dec.id, 'CUSTOMER_DECLINE', (await detail(dec.id, A)).request.version, { offerVersion: decOffer.version }, A)).request; assert.equal(r.status, 'customer_declined');
  assert.equal((await db.$queryRaw`SELECT "status" FROM "ExceptionOffer" WHERE "id"=${decOffer.id}`)[0].status, 'DECLINED');

  // 11. renegotiation produces a new version and the old one can no longer be accepted
  const reneg = ok(await call('/api/exceptions', 'POST', form(line(offA3.id, mid, '16:00')), A)).request;
  await actOk(reneg.id, 'APPROVE_FEASIBILITY', V1); await actOk(reneg.id, 'START_NEGOTIATION', COORD); await actOk(reneg.id, 'PREPARE_OFFER', COORD, { exceptionFee: 90000 }); await actOk(reneg.id, 'SEND_OFFER', COORD);
  const v1offer = (await detail(reneg.id, A)).offers[0]; r = ok(await act(reneg.id, 'CUSTOMER_RENEGOTIATE', (await detail(reneg.id, A)).request.version, { offerVersion: v1offer.version, note: 'مرتفع' }, A)).request; assert.equal(r.status, 'negotiating');
  await actOk(reneg.id, 'PREPARE_OFFER', COORD, { exceptionFee: 30000 }); await actOk(reneg.id, 'SEND_OFFER', COORD);
  d = await detail(reneg.id, A); assert.equal(d.offers[0].version, 2); assert.equal(d.offers[0].status, 'SENT'); assert.equal(d.offers[1].status, 'DECLINED');

  // 12. offers expire, and so does an approved request nobody paid for; escalation reaches the platform
  await db.$executeRaw`UPDATE "ExceptionOffer" SET "expiresAt"=CURRENT_TIMESTAMP - interval '1 minute' WHERE "requestId"=${reneg.id} AND "status"='SENT'`;
  assert.equal((await act(reneg.id, 'CUSTOMER_ACCEPT', (await detail(reneg.id, A)).request.version, { offerVersion: 2, confirm: true }, A)).status, 409, 'an expired offer cannot be accepted');
  let sweep = ok(await call('/api/exceptions/sweep', 'POST', {}, S)).result; assert.equal(sweep.offersExpired, 1); assert.equal((await detail(reneg.id, A)).request.status, 'offer_expired');
  assert.equal((await call('/api/exceptions/sweep', 'POST', {}, A)).status, 403);
  sweep = ok(await call('/api/exceptions/sweep', 'POST', {}, S)).result; assert.equal(sweep.offersExpired, 0, 'a second sweep finds nothing to do');
  r = await actOk(reneg.id, 'REOPEN_NEGOTIATION', COORD); assert.equal(r.status, 'negotiating');
  await db.$executeRaw`UPDATE "ExceptionRequest" SET "dueAt"=CURRENT_TIMESTAMP - interval '10 hours' WHERE "id"=${reneg.id}`;
  sweep = ok(await call('/api/exceptions/sweep', 'POST', {}, S)).result; assert(sweep.escalated >= 1); assert((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ExceptionNotification" WHERE "event"='ESCALATED' AND "userId"=${uS.id} AND "channel"='inbox'`)[0].n >= 1);
  sweep = ok(await call('/api/exceptions/sweep', 'POST', {}, S)).result; assert.equal((await db.$queryRaw`SELECT COUNT(*)::int n FROM "ExceptionNotification" WHERE "event"='ESCALATED' AND "requestId"=${reneg.id} AND "channel"='inbox' AND "userId"=${uS.id}`)[0].n, 1, 'an escalation level is announced once');
  ok(await call('/api/exceptions/' + reneg.id, 'POST', { action: 'CANCEL', version: (await detail(reneg.id, A)).request.version }, A));

  // 13. a failed payment leaves the exception waiting; the booking is not confirmed
  const pay = ok(await call('/api/exceptions', 'POST', form(line(offA4.id, near, '15:00')), A)).request;
  await actOk(pay.id, 'APPROVE_FEASIBILITY', V1); await actOk(pay.id, 'START_NEGOTIATION', COORD); await actOk(pay.id, 'PREPARE_OFFER', COORD, { exceptionFee: 10000 }); await actOk(pay.id, 'SEND_OFFER', COORD);
  const payOffer = (await detail(pay.id, A)).offers[0]; ok(await act(pay.id, 'CUSTOMER_ACCEPT', (await detail(pay.id, A)).request.version, { offerVersion: payOffer.version, confirm: true }, A));
  ok(await call('/api/exceptions/' + pay.id + '/cart', 'POST', undefined, A)); const payCart = ok(await call('/api/commerce/cart', 'GET', undefined, A)); const payOrder = ok(await buy(payCart)).order;
  assert.equal((await call('/api/commerce/orders', 'PATCH', { id: payOrder.id, version: payOrder.version, action: 'CONFIRM_ALL' }, S)).status, 409, 'unpaid deposit: not confirmed');
  assert.equal((await detail(pay.id, A)).request.status, 'awaiting_payment');
  // 14. availability lost before the final confirmation: the platform's own re-check refuses, the exception waits
  const payBooking = (await db.$queryRaw`SELECT "bookingRequestId" id FROM "ExceptionRequest" WHERE "id"=${pay.id}`)[0].id;
  const payItem = payOrder.items.find(i => i.bookingId);
  const recorded = ok(await call('/api/commerce/finance', 'POST', { id: payOrder.id, version: payOrder.version, action: 'RECORD', kind: 'PAYMENT', itemId: payItem.id, amount: 45000, reference: 'EXC-PAY-1', evidenceUrl: 'https://example.invalid/receipt', noteAr: 'دفعة مقدمة' }, S)).order;
  const entry = recorded.transfers.find(t => t.kind === 'PAYMENT'); ok(await call('/api/commerce/finance', 'POST', { id: payOrder.id, version: recorded.version, action: 'VERIFY', entryId: entry.id, noteAr: 'مطابقة' }, S2));
  const startAt = (await db.$queryRaw`SELECT "startAt","endAt" FROM "ServiceRequest" WHERE "id"=${payBooking}`)[0];
  await db.$executeRaw`INSERT INTO "ServiceReservation" ("id","requestId","resourceKey","startAt","endAt","active","quantity") VALUES (${randomBytes(8).toString('hex')},${(await db.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id"<>${payBooking} LIMIT 1`)[0].id},${'offering:' + offA4.id},${startAt.startAt},${startAt.endAt},true,1)`;
  const fresh = ok(await call('/api/commerce/orders?id=' + payOrder.id, 'GET', undefined, S)).orders[0];
  assert.equal((await call('/api/commerce/orders', 'PATCH', { id: payOrder.id, version: fresh.version, action: 'CONFIRM_ALL' }, S)).status, 409, 'the slot was taken meanwhile');
  assert.equal((await detail(pay.id, A)).request.status, 'awaiting_payment', 'the exception is not completed');
  await db.$executeRaw`DELETE FROM "ServiceReservation" WHERE "resourceKey"=${'offering:' + offA4.id} AND "startAt"=${startAt.startAt}`;
  const again = ok(await call('/api/commerce/orders?id=' + payOrder.id, 'GET', undefined, S)).orders[0];
  ok(await call('/api/commerce/orders', 'PATCH', { id: payOrder.id, version: again.version, action: 'CONFIRM_ALL' }, S)); assert.equal((await detail(pay.id, A)).request.status, 'completed');

  // 15. packages: only the component that fails needs an exception, and only its provider approves
  nb = ok(await call(`/api/booking-notice?packageId=${pack.id}&cityId=riyadh&date=${near}&time=09:00`)); assert.equal(nb.ok, false); assert.deepEqual(nb.blocking, ['تصوير زفاف']); assert.equal(nb.requiredMinutes, 4320);
  const pk = ok(await call('/api/exceptions', 'POST', form({ id: randomBytes(4).toString('hex'), packageId: pack.id, cityId: 'riyadh', date: near, time: '09:00', quantity: 1, guestCount: 10, choices: {} }), A)).request;
  d = await detail(pk.id, A); assert.equal(d.steps.filter(s => s.stage === 'FEASIBILITY').length, 1); assert.equal((await detail(pk.id, V1)).actions.some(a => a.action === 'APPROVE_FEASIBILITY'), true);
  assert.equal((await call('/api/exceptions/' + pk.id, 'GET', undefined, V2)).status, 404, 'the provider of a component that is fine takes no part');
  await actOk(pk.id, 'CANCEL', A);

  // 16. reschedule of a confirmed booking: approvals and payment first, then one atomic change; a refusal leaves it as it was
  const rb = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "customerId"=${uA.id} AND "startAt" > ${new Date(Date.now() + 10 * DAY)} ORDER BY "createdAt" LIMIT 1`)[0];
  assert(rb, 'the first, normal booking exists'); const rbOrder = (await db.$queryRaw`SELECT i."orderId" FROM "CommerceBooking" b JOIN "CommerceOrderItem" i ON i."id"=b."orderItemId" WHERE b."requestId"=${rb.id}`)[0].orderId;
  const rbOrderView = ok(await call('/api/commerce/orders?id=' + rbOrder, 'GET', undefined, S)).orders[0]; ok(await call('/api/commerce/orders', 'PATCH', { id: rbOrder, version: rbOrderView.version, action: 'CONFIRM_ALL' }, S));
  assert.equal((await db.$queryRaw`SELECT "status" FROM "ServiceRequest" WHERE "id"=${rb.id}`)[0].status, 'CONFIRMED');
  const rsForm = (extra = {}) => ({ kind: 'RESCHEDULE', bookingRequestId: rb.id, date: near, time: '10:00', reason: 'تغير موعد المناسبة', urgencyDetails: 'قدمنا المناسبة', contact: { name: 'اختبار', phone: '0500040010' }, acknowledge: true, ...extra });
  assert.equal((await call('/api/exceptions', 'POST', rsForm({ date: far2 }), A)).status, 409, 'a new time that meets the notice uses the ordinary reschedule');
  assert.equal((await call('/api/exceptions', 'POST', rsForm(), B)).status, 404, "another customer's booking");
  const rs = ok(await call('/api/exceptions', 'POST', rsForm(), A)).request; assert.match(rs.number, /^RS-/);
  assert.equal(ok(await call('/api/exceptions', 'POST', rsForm(), A)).duplicate, true);

  // approvals first; the confirmed booking is not touched until the customer approves the price and the extra amount is paid
  const rsStart = new Date(rb.startAt).toISOString(), rsPrice = rb.body.price.total;
  await actOk(rs.id, 'APPROVE_FEASIBILITY', V1); await actOk(rs.id, 'START_NEGOTIATION', COORD); await actOk(rs.id, 'PREPARE_OFFER', COORD, { exceptionFee: 10000 }); await actOk(rs.id, 'SEND_OFFER', COORD);
  const rsOffer = (await detail(rs.id, A)).offers[0]; assert.equal(rsOffer.total, 126500); assert.equal(rsOffer.previousTotal, 115000);
  const bookingNow = async () => (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${rb.id}`)[0];
  assert.equal(new Date((await bookingNow()).startAt).toISOString(), rsStart, 'nothing changes while the offer is open');
  r = ok(await act(rs.id, 'CUSTOMER_ACCEPT', (await detail(rs.id, A)).request.version, { offerVersion: rsOffer.version, confirm: true }, A)).request; assert.equal(r.status, 'awaiting_payment');
  let bk = await bookingNow(); assert.equal(new Date(bk.startAt).toISOString(), rsStart, 'accepting the price does not move the booking'); assert.equal(bk.body.price.total, rsPrice); assert.equal(bk.body.rescheduleCharge.amountDue, 11500);
  const rsItem = ok(await call('/api/commerce/orders?id=' + rbOrder, 'GET', undefined, S)).orders[0]; const rsLine = rsItem.items.find(i => i.bookingId);
  const rsRec = ok(await call('/api/commerce/finance', 'POST', { id: rbOrder, version: rsItem.version, action: 'RECORD', kind: 'PAYMENT', itemId: rsLine.id, amount: 11500, reference: 'EXC-RS-1', evidenceUrl: 'https://example.invalid/receipt2', noteAr: 'فرق السعر' }, S)).order;
  bk = await bookingNow(); assert.equal(new Date(bk.startAt).toISOString(), rsStart, 'a recorded but unverified payment changes nothing');
  ok(await call('/api/commerce/finance', 'POST', { id: rbOrder, version: rsRec.version, action: 'VERIFY', entryId: rsRec.transfers.find(t => t.kind === 'PAYMENT').id, noteAr: 'مطابقة' }, S2));
  bk = await bookingNow(); assert.equal(new Date(bk.startAt).toISOString(), zonedTest(near, '10:00'), 'now the booking has moved'); assert.equal(bk.body.price.total, 126500); assert.equal(bk.body.rescheduleCharge, null); assert.equal(bk.status, 'CONFIRMED');
  assert.equal(bk.body.price.deposit + bk.body.price.milestones.reduce((a, m) => a + m.amount, 0), bk.body.price.total, 'deposit and milestones still add up');
  assert.equal(new Date((await db.$queryRaw`SELECT "startAt" FROM "ServiceReservation" WHERE "requestId"=${rb.id} AND "resourceKey"=${'offering:' + offA.id}`)[0].startAt).toISOString(), zonedTest(near, '10:00'), 'the calendar reservation moved with it');
  assert.equal((await detail(rs.id, A)).request.status, 'completed'); assert((await db.$queryRaw`SELECT 1 FROM "ExceptionEvent" WHERE "requestId"=${rs.id} AND "action"='CONFIRM'`).length === 1);
  assert((await db.$queryRaw`SELECT 1 FROM "ServiceRequestEvent" WHERE "requestId"=${rb.id} AND "action"='RESCHEDULE_EXCEPTION_APPLIED'`).length === 1, "the booking's own history records the change");

  // a refused reschedule leaves the original booking as it was
  const c2 = await cart([line(offA2.id, far2)]); ok(await buy(c2.data)); const rb2 = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "offeringId"=${offA2.id} AND "customerId"=${uA.id} AND "startAt" > ${new Date(Date.now() + 10 * DAY)}`)[0];
  const rb2Order = (await db.$queryRaw`SELECT i."orderId" FROM "CommerceBooking" b JOIN "CommerceOrderItem" i ON i."id"=b."orderItemId" WHERE b."requestId"=${rb2.id}`)[0].orderId; const rb2View = ok(await call('/api/commerce/orders?id=' + rb2Order, 'GET', undefined, S)).orders[0]; ok(await call('/api/commerce/orders', 'PATCH', { id: rb2Order, version: rb2View.version, action: 'CONFIRM_ALL' }, S));
  const rs2 = ok(await call('/api/exceptions', 'POST', { ...rsForm({ bookingRequestId: rb2.id }), time: '07:00' }, A)).request;
  r = await actOk(rs2.id, 'REJECT', V1, { note: 'لا يمكن التنفيذ' }); assert.equal(r.status, 'rejected');
  let rb2Now = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${rb2.id}`)[0]; assert.equal(new Date(rb2Now.startAt).toISOString(), new Date(rb2.startAt).toISOString()); assert.equal(rb2Now.status, 'CONFIRMED');
  const rs3 = ok(await call('/api/exceptions', 'POST', { ...rsForm({ bookingRequestId: rb2.id }), time: '07:00' }, A)).request;
  await actOk(rs3.id, 'APPROVE_FEASIBILITY', V1); await actOk(rs3.id, 'START_NEGOTIATION', COORD); await actOk(rs3.id, 'PREPARE_OFFER', COORD, { exceptionFee: 5000 }); await actOk(rs3.id, 'SEND_OFFER', COORD);
  r = ok(await act(rs3.id, 'CUSTOMER_DECLINE', (await detail(rs3.id, A)).request.version, { offerVersion: (await detail(rs3.id, A)).offers[0].version }, A)).request; assert.equal(r.status, 'customer_declined');
  rb2Now = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${rb2.id}`)[0]; assert.equal(new Date(rb2Now.startAt).toISOString(), new Date(rb2.startAt).toISOString(), 'the original booking stays valid'); assert.equal(rb2Now.body.rescheduleCharge ?? null, null);

  // availability is checked again at the end: a reschedule whose new time was taken meanwhile is not applied
  const rs4 = ok(await call('/api/exceptions', 'POST', { ...rsForm({ bookingRequestId: rb2.id }), time: '08:00' }, A)).request;
  await actOk(rs4.id, 'APPROVE_FEASIBILITY', V1); await actOk(rs4.id, 'START_NEGOTIATION', COORD); await actOk(rs4.id, 'PREPARE_OFFER', COORD, { exceptionFee: 0 }); await actOk(rs4.id, 'SEND_OFFER', COORD);
  await db.$executeRaw`INSERT INTO "ServiceReservation" ("id","requestId","resourceKey","startAt","endAt","active","quantity") VALUES (${randomBytes(8).toString('hex')},${rb.id},${'offering:' + offA2.id},${new Date(zonedTest(near, '08:00'))},${new Date(+new Date(zonedTest(near, '08:00')) + 7200000)},true,1) ON CONFLICT DO NOTHING`;
  const bad4 = await act(rs4.id, 'CUSTOMER_ACCEPT', (await detail(rs4.id, A)).request.version, { offerVersion: (await detail(rs4.id, A)).offers[0].version, confirm: true }, A);
  assert.equal(bad4.status, 409, 'no extra charge: applied at once, and the taken slot refuses it'); rb2Now = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${rb2.id}`)[0]; assert.equal(new Date(rb2Now.startAt).toISOString(), new Date(rb2.startAt).toISOString(), 'the whole step rolled back');
  assert.equal((await detail(rs4.id, A)).request.status, 'awaiting_customer_approval'); await db.$executeRaw`DELETE FROM "ServiceReservation" WHERE "resourceKey"=${'offering:' + offA2.id} AND "requestId"=${rb.id}`;
  r = ok(await act(rs4.id, 'CUSTOMER_ACCEPT', (await detail(rs4.id, A)).request.version, { offerVersion: (await detail(rs4.id, A)).offers[0].version, confirm: true }, A)).request; assert.equal(r.status, 'completed', 'with the slot free it is applied at once');
  rb2Now = (await db.$queryRaw`SELECT * FROM "ServiceRequest" WHERE "id"=${rb2.id}`)[0]; assert.equal(new Date(rb2Now.startAt).toISOString(), zonedTest(near, '08:00'));

  // two customers racing for the same slot: exactly one gets it
  const rc1 = await cart([line(offB.id, far2, '11:00')], A), rc2 = await cart([line(offB.id, far2, '11:00')], B); const race = await Promise.all([buy(rc1.data, A), buy(rc2.data, B)]); assert.deepEqual(race.map(x => x.status).sort(), [200, 409]);

  // dashboard, counters, search and export
  const list = ok(await call('/api/exceptions?stats=1', 'GET', undefined, S)); assert(list.requests.length >= 8); assert(list.stats.total >= 8); assert(list.stats.confirmed >= 3); assert(list.stats.rejected >= 2); assert(list.stats.reschedule >= 3); assert.equal(typeof list.stats.late, 'number');
  assert.equal(ok(await call('/api/exceptions', 'GET', undefined, A)).requests.every(x => x.id), true); assert.equal(ok(await call('/api/exceptions', 'GET', undefined, B)).requests.length, 0, 'a customer sees only their own');
  assert.equal(ok(await call('/api/exceptions?kind=RESCHEDULE&status=completed', 'GET', undefined, S)).requests.every(x => x.kind === 'RESCHEDULE' && x.status === 'completed'), true);
  assert.equal(ok(await call('/api/exceptions?q=' + encodeURIComponent(exc.number), 'GET', undefined, S)).requests.length, 1);
  assert.equal(ok(await call('/api/exceptions', 'GET', undefined, COORD)).requests.every(x => x.coordinatorId === uCOORD.id), true, 'a coordinator sees their own assignments');
  const csv = await call('/api/exceptions/export', 'GET', undefined, S); assert.equal(csv.status, 200); assert(csv.raw.includes('الرقم')); assert(csv.raw.includes(exc.number)); assert.equal((await call('/api/exceptions/export', 'GET', undefined, A)).status, 403);
  // staff and settings
  assert.equal((await call('/api/exceptions/staff', 'GET', undefined, A)).status, 403); assert.equal(ok(await call('/api/exceptions/staff', 'GET', undefined, S)).staff.length, 2);
  assert.equal((await call('/api/exceptions/config', 'POST', { offerValidityHours: 0 }, S)).status, 400); assert.equal(ok(await call('/api/exceptions/config', 'POST', { offerValidityHours: 12 }, S)).config.offerValidityHours, 12); assert.equal((await call('/api/exceptions/config', 'GET', undefined, A)).status, 403);

  // the feature switch: off means no new requests, and the notice itself still applies
  await db.$executeRaw`UPDATE "SystemFeature" SET "enabled"=false WHERE "id"='booking_exceptions'`;
  assert.equal((await call('/api/exceptions', 'POST', form(line(offA.id, near, '12:00')), A)).status, 403);
  nb = ok(await call(`/api/booking-notice?offerId=${offA.id}&cityId=riyadh&date=${near}&time=12:00`)); assert.equal(nb.ok, false); assert.equal(nb.canRequestException, false); assert.equal(nb.exceptionsOn, false);
  assert.equal((await cart([line(offA.id, near, '12:00')], B)).status, 409, 'the cart still enforces the notice');
  assert.equal(ok(await call('/api/exceptions/sweep', 'POST', {}, S)).result.disabled, true);
  await db.$executeRaw`UPDATE "SystemFeature" SET "enabled"=true WHERE "id"='booking_exceptions'`;

  // vendor account approval: a new vendor waits, cannot publish, and is decided on with reasons; customers are active at once
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ userType: 'vendor', vendorData: { contactName: 'مورد جديد', businessName: 'مؤسسة التسجيل', businessNameEn: 'Reg Co', categoryId: 'photography', cityId: 'riyadh', contactPhone: '0551234567', email: 'reg-vendor@test.example', password: 'Strong-Pass-2026!', bioAr: 'نبذة' } }) });
  assert.equal(reg.status, 200, await reg.clone().text()); const regCookie = reg.headers.get('set-cookie').split(';')[0], regUser = (await reg.json()).user;
  const regVendor = (await db.$queryRaw`SELECT * FROM "Vendor" WHERE "userId"=${regUser.id}`)[0]; assert.equal(regVendor.status, 'UNDER_REVIEW');
  assert.equal((await db.$queryRaw`SELECT "state" FROM "VendorApproval" WHERE "vendorId"=${regVendor.id}`)[0].state, 'PENDING');
  assert((await db.$queryRaw`SELECT 1 FROM "ExceptionNotification" WHERE "event"='VENDOR_REGISTERED' AND "userId"=${uS.id} AND "channel"='inbox'`).length >= 1, 'the platform is told about the new vendor');
  assert.equal(ok(await call('/api/vendor/approval', 'GET', undefined, regCookie)).canPublish, false);
  assert.equal((await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-reg-service', body: svcBody('خدمة مورد جديد', { id: regUser.id }, rule3d) }, regCookie)).status, 403, 'an unapproved vendor cannot publish');
  assert.equal((await call('/api/admin/vendor-approvals', 'GET', undefined, A)).status, 403); assert.equal((await call('/api/admin/vendor-approvals', 'POST', { vendorId: regVendor.id, decision: 'approve' }, regCookie)).status, 403, 'a vendor cannot approve itself');
  let va = ok(await call('/api/admin/vendor-approvals?state=PENDING', 'GET', undefined, S)); assert(va.vendors.some(v => v.vendorId === regVendor.id));
  assert.equal((await call('/api/admin/vendor-approvals', 'POST', { vendorId: regVendor.id, decision: 'request_info' }, S)).status, 400, 'a reason is required');
  ok(await call('/api/admin/vendor-approvals', 'POST', { vendorId: regVendor.id, decision: 'request_info', note: 'أرفق السجل التجاري' }, S));
  assert.equal(ok(await call('/api/vendor/approval', 'GET', undefined, regCookie)).state, 'INFO_REQUIRED'); assert.equal(ok(await call('/api/vendor/approval', 'GET', undefined, regCookie)).note, 'أرفق السجل التجاري');
  ok(await call('/api/vendor/approval', 'POST', { note: 'تم الإرفاق' }, regCookie)); assert.equal(ok(await call('/api/vendor/approval', 'GET', undefined, regCookie)).state, 'PENDING');
  ok(await call('/api/admin/vendor-approvals', 'POST', { vendorId: regVendor.id, decision: 'approve' }, S));
  assert.equal(ok(await call('/api/vendor/approval', 'GET', undefined, regCookie)).canPublish, true); assert.equal((await db.$queryRaw`SELECT "status" FROM "Vendor" WHERE "id"=${regVendor.id}`)[0].status, 'ACTIVE');
  const regSvc = await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-reg-service', body: svcBody('خدمة مورد جديد', { id: regUser.id }, rule3d) }, regCookie); assert.equal(regSvc.status, 200, JSON.stringify(regSvc.data));
  assert.equal(regSvc.data.entity.body.approved, false, 'approving the vendor does not approve its services'); assert.equal(ok(await call('/api/commerce/catalog')).services.some(x => x.id === 'exc-reg-service'), false, 'an unapproved service is not shown to customers');
  assert((await db.$queryRaw`SELECT 1 FROM "ExceptionNotification" WHERE "event"='VENDOR_APPROVED' AND "userId"=${regUser.id} AND "channel"='inbox'`).length === 1, 'the vendor is told');
  ok(await call('/api/admin/vendor-approvals', 'POST', { vendorId: regVendor.id, decision: 'hold', note: 'مراجعة دورية' }, S));
  assert.equal((await db.$queryRaw`SELECT "status" FROM "Vendor" WHERE "id"=${regVendor.id}`)[0].status, 'UNDER_REVIEW'); assert.equal((await call('/api/commerce/manage', 'POST', { kind: 'SERVICE', id: 'exc-reg-service', body: svcBody('خدمة مورد جديد', { id: regUser.id }, rule3d), version: 1 }, regCookie)).status, 403, 'a vendor put on hold cannot change services');
  ok(await call('/api/admin/vendors', 'POST', { id: regVendor.id, status: 'active', verified: true }, S)); assert.equal((await db.$queryRaw`SELECT "state" FROM "VendorApproval" WHERE "vendorId"=${regVendor.id}`)[0].state, 'APPROVED', 'the older status switch keeps the approval record in step');
  assert((await db.$queryRaw`SELECT COUNT(*)::int n FROM "VendorApprovalEvent" WHERE "vendorId"=${regVendor.id}`)[0].n >= 6); await assert.rejects(() => db.$executeRaw`DELETE FROM "VendorApprovalEvent"`, 'approval history cannot be deleted');
  const regCustomer = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ userType: 'client', customerData: { name: 'عميل جديد', phone: '0551234568', cityId: 'riyadh', password: 'Strong-Pass-2026!' } }) });
  assert.equal(regCustomer.status, 200); assert.equal(((await regCustomer.json()).user).role, 'client', 'customers are active at once, with no administrator approval');
  if (process.env.RUN_EXC_BROWSER === '1') await screens();
  console.log('PASS exceptions: notice met/not met (cart, checkout, packages, cutoff, no-exception services, coverage), request + duplicate/concurrent submit, provider approval/rejection, coordinator, versioned frozen offers, consent, customer accept/decline/renegotiate/expiry, escalation, payment + failed payment + lost availability, atomic reschedule (paid, declined, rejected, retaken slot), permissions, audit, notifications without duplicates, dashboard, export, settings, feature switch, vendor account approval (pending, information, hold, approval, separate service approval) and immediate customer registration.');
} )().catch(e => { console.error(e); console.error(logs.slice(-6000)); process.exitCode = 1; }).finally(async () => {
  if (server?.pid) { if (process.platform === 'win32') spawnSync('C:\\Windows\\System32\\taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill('SIGTERM'); }
  if (/^exc_test_[a-f0-9]{16}$/.test(schema)) await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect(); try { fs.rmSync(path.resolve(dist), { recursive: true, force: true }); fs.rmSync(config, { force: true }); } catch { /* ignore */ }
});
