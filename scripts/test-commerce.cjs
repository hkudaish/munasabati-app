// Real HTTP + PostgreSQL regression tests in an isolated disposable schema.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, randomUUID, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const schema = 'commerce_test_' + randomBytes(8).toString('hex');
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const dist = '.next-commerce-test-' + process.pid, config = '.commerce-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(config, fs.readFileSync('tsconfig.json'));
const base = 'http://localhost:3104';
const env = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: config, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: base };
const db = new PrismaClient({ datasourceUrl: url.toString() });
let server, logs = '';
async function call(route, method = 'GET', data, cookie, headers = {}) {
  const r = await fetch(base + route, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
  const raw = await r.text(); let result; try { result = JSON.parse(raw); } catch { throw Error(`${r.status}: ${raw.slice(0, 300)}`); }
  return { status: r.status, data: result, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
(async () => {
  const pushed = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
  assert.equal(pushed.status, 0, pushed.stdout + pushed.stderr);
  await require('./seed-geography.cjs').seedGeography(db);
  await db.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض', countryCode: 'SA', isAvailable: true, defaultAvailable: true } });
  const password = randomBytes(24).toString('hex'), salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const users = [];
  for (const [i, role] of ['CLIENT','CLIENT','VENDOR','VENDOR','ADMIN'].entries()) users.push(await db.user.create({ data: { name: `اختبار ${role}`, phone: `050000001${i}`, role, passwordHash } }));
  const vendors = [], services = [];
  for (let i = 0; i < 2; i++) {
    const vendor = await db.vendor.create({ data: { userId: users[i + 2].id, businessName: `مورد ${i}`, businessNameEn: 'Test', categoryId: 'venues', cityId: 'riyadh', logo: '', bannerImage: '', neighborhood: '', bioAr: '', cancellationPolicyAr: '', contactPhone: users[i + 2].phone, whatsappNumber: users[i + 2].phone } });
    vendors.push(vendor);
    services.push(await db.serviceItem.create({ data: { vendorId: vendor.id, categoryId: 'venues', cityId: 'riyadh', titleAr: `خدمة ${i}`, descriptionAr: '', price: 1000 + i * 1000, executionDurationHours: 4, packages: { create: { nameAr: 'باقة اختبار', price: 1200 + i * 1000, durationHours: i === 0 ? 6 : 4 } }, addons: { create: { titleAr: 'إضافة', price: 100, maxQuantity: 2 } } }, include: { packages: true, addons: true } }));
  }
  function startServer() {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3104'], { env, stdio: ['ignore','pipe','pipe'] });
    server.stdout.on('data', d => { logs += d; }); server.stderr.on('data', d => { logs += d; });
  }
  startServer();
  let ready = false;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health/db')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  assert(ready, logs.slice(-3000));
  const cookies = [];
  for (const user of users) { const r = await call('/api/auth/login', 'POST', { identifier: user.phone, password }); assert.equal(r.status, 200, JSON.stringify(r.data)); cookies.push(r.cookie); }
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  function payload(serviceList = services) { return { idempotencyKey: randomUUID(), items: serviceList.map(s => ({ serviceId: s.id, packageId: s.packages[0].id, quantity: 1, addons: [{ addonId: s.addons[0].id, quantity: 2 }], packagePrice: 1, totalAmount: 1 })), customerInfo: { customerName: 'عميل اختبار', customerPhone: users[0].phone, cityId: 'riyadh', eventDate: future, eventTime: '18:00', venueName: 'موقع اختبار', paymentMethod: 'mada' } }; }
  assert.equal((await call('/api/oms/orders')).status, 401);
  assert.equal((await call('/api/oms/orders', 'POST', payload())).status, 401);
  const input = payload();
  assert.equal((await call('/api/oms/orders', 'POST', input, cookies[0], { Origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await call('/api/oms/orders', 'POST', input, cookies[0], { 'x-coverage-preview': 'test' })).status, 403);
  const attempts = await Promise.all([1,2].map(() => call('/api/oms/orders', 'POST', input, cookies[0])));
  attempts.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  const order = attempts[0].data.masterOrder;
  assert.equal(attempts[1].data.masterOrder.id, order.id);
  assert.equal(await db.multiVendorOrder.count(), 1); assert.equal(order.suborders.length, 2);
  assert.equal(order.totalSubtotal, 3800); assert.equal(order.totalTax, 570); assert.equal(order.finalTotal, 4370);
  assert.equal(order.paymentStatus, 'UNPAID'); assert.equal(order.status, 'requested');
  assert(order.suborders.every(s => s.status === 'pending' && s.remainingAmount === s.totalAmount));
  assert.equal(await db.oMSOrderEvent.count(), 2); assert.equal(await db.oMSNotificationLog.count(), 2);
  const changed = structuredClone(input); changed.items[0].quantity = 2;
  assert.equal((await call('/api/oms/orders', 'POST', changed, cookies[0])).status, 409);
  const invalid = payload(); invalid.items[0].packageId = services[1].packages[0].id;
  assert.equal((await call('/api/oms/orders', 'POST', invalid, cookies[0])).status, 400);
  const zero = payload(); zero.items[0].quantity = 0;
  assert.equal((await call('/api/oms/orders', 'POST', zero, cookies[0])).status, 400);
  const forgedCoupon = payload(); forgedCoupon.customerInfo.couponCode = 'FAKE'; forgedCoupon.customerInfo.couponDiscount = 9999;
  assert.equal((await call('/api/oms/orders', 'POST', forgedCoupon, cookies[0])).status, 400);
  assert.equal(await db.multiVendorOrder.count(), 1);
  assert.equal((await call('/api/oms/orders', 'GET', undefined, cookies[1])).data.orders.length, 0);
  const ownVendor = (await call('/api/oms/orders', 'GET', undefined, cookies[2])).data.orders;
  assert.equal(ownVendor.length, 1); assert.equal(ownVendor[0].suborders.length, 1); assert.equal(ownVendor[0].suborders[0].vendorId, vendors[0].id);
  const sub0 = order.suborders.find(s => s.vendorId === vendors[0].id), sub1 = order.suborders.find(s => s.vendorId === vendors[1].id);
  async function transition(sub, targetState, cookie, extra = {}) { return call('/api/oms/orders/transition', 'POST', { suborderId: sub.id, targetState, role: 'ADMIN', actorUserId: users[4].id, ...extra }, cookie); }
  assert.equal((await transition(sub0, 'ACCEPTED', cookies[1])).status, 404);
  assert.equal((await transition(sub1, 'ACCEPTED', cookies[2])).status, 404);
  assert.equal((await transition(sub0, 'ACCEPTED', cookies[0])).status, 422);
  const accepted = await transition(sub0, 'ACCEPTED', cookies[2]); assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.suborder.status, 'pending'); assert.equal(accepted.data.suborder.nextAction, 'AWAIT_PAYMENT_SETUP');
  assert.equal((await transition(sub0, 'IN_PROGRESS', cookies[2])).status, 409);
  assert.equal((await transition(sub0, 'PAYMENT_CONFIRMED', cookies[4])).status, 409);
  const event = await db.oMSOrderEvent.findFirst({ where: { suborderId: sub0.id, action: 'ACCEPT_ORDER' } }); assert.equal(event.actorId, users[2].id); assert.equal(event.actorRole, 'VENDOR');
  const conflict = await call('/api/oms/orders', 'POST', payload([services[0]]), cookies[1]); assert.equal(conflict.status, 200, JSON.stringify(conflict.data));
  assert.equal((await transition(conflict.data.masterOrder.suborders[0], 'ACCEPTED', cookies[2])).status, 409);
  const extended = payload([services[0]]); extended.customerInfo.eventTime = '23:00';
  const longPackage = await call('/api/oms/orders', 'POST', extended, cookies[1]); assert.equal(longPackage.status, 200);
  assert.equal((await transition(longPackage.data.masterOrder.suborders[0], 'ACCEPTED', cookies[2])).status, 409);
  // A rejected sibling remains independent of the accepted suborder.
  assert.equal((await transition(sub1, 'REJECTED', cookies[3], { noteAr: 'غير متاح في الموعد' })).status, 200);
  assert.equal((await db.suborder.findUnique({ where: { id: sub0.id } })).omsStatus, 'ACCEPTED');
  assert.equal((await call('/api/oms/watchdog', 'POST', {}, cookies[0])).status, 403);
  await db.suborder.update({ where: { id: conflict.data.masterOrder.suborders[0].id }, data: { acceptanceDeadline: new Date(Date.now() - 1000) } });
  const scan = await call('/api/oms/watchdog', 'POST', {}, cookies[4]); assert.equal(scan.status, 200, JSON.stringify(scan.data)); assert.equal(scan.data.newExceptionsCount, 1);
  const again = await call('/api/oms/watchdog', 'POST', {}, cookies[4]); assert.equal(again.status, 200); assert.equal(again.data.newExceptionsCount, 0);
  assert.equal((await call('/api/oms/watchdog', 'GET', undefined, cookies[4])).data.exceptions.length, 1);
  // Verified payment is fixture data only: the public transition endpoint cannot forge it.
  await db.multiVendorOrder.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
  assert.equal((await transition(sub0, 'CANCELLED', cookies[0], { noteAr: 'لا تسمح بإلغاء مدفوع دون استرداد' })).status, 409);
  assert.equal((await transition(sub0, 'IN_PROGRESS', cookies[2])).status, 200);
  assert.equal((await transition(sub0, 'READY_FOR_DELIVERY', cookies[2])).status, 200);
  assert.equal((await transition(sub0, 'DELIVERED', cookies[2])).status, 400);
  assert.equal((await transition(sub0, 'DELIVERED', cookies[2], { deliverablesUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await transition(sub0, 'DELIVERED', cookies[2], { proofOfDelivery: 'تم تسليم الخدمة في بيئة الاختبار' })).status, 200);
  assert.equal((await transition(sub0, 'COMPLETED', cookies[0])).status, 200);
  const detail = await call('/api/oms/orders/' + order.id, 'GET', undefined, cookies[0]); assert.equal(detail.status, 200); assert(detail.data.events.length >= 6);
  assert.equal((await call('/api/oms/orders/' + order.id, 'GET', undefined, cookies[1])).status, 404);
  const detailVendor = await call('/api/oms/orders/' + order.id, 'GET', undefined, cookies[2]); assert.equal(detailVendor.data.masterOrder.suborders.length, 1); assert.equal(detailVendor.data.masterOrder.finalTotal, 1610);
  assert(detailVendor.data.events.every(e => e.suborderId === sub0.id));
  // Two simultaneous accepts must reserve a supplier only once.
  const tomorrow = new Date(Date.parse(future) + 86400000).toISOString().slice(0, 10);
  const raceInput = () => { const p = payload([services[0]]); p.customerInfo.eventDate = tomorrow; return p; };
  const raceOrders = await Promise.all([cookies[0],cookies[1]].map(cookie => call('/api/oms/orders', 'POST', raceInput(), cookie)));
  raceOrders.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  const race = await Promise.all(raceOrders.map(r => transition(r.data.masterOrder.suborders[0], 'ACCEPTED', cookies[2])));
  assert.deepEqual(race.map(r => r.status).sort(), [200,409]);
  const winner = raceOrders[race.findIndex(r => r.status === 200)].data.masterOrder.suborders[0];
  assert.equal((await transition(winner, 'CANCELLED', cookies[2], { noteAr: 'إلغاء حجز الاختبار غير المدفوع' })).status, 200);
  const loser = raceOrders[race.findIndex(r => r.status === 409)].data.masterOrder.suborders[0];
  assert.equal((await transition(loser, 'ACCEPTED', cookies[2])).status, 200);
  // Disabling NEW checkout must not hide existing order history or cancellation.
  await db.systemFeature.update({ where: { id: 'commerce' }, data: { enabled: false } });
  assert.equal((await call('/api/oms/orders', 'POST', payload(), cookies[0])).status, 403);
  assert.equal((await call('/api/oms/orders/' + order.id, 'GET', undefined, cookies[0])).status, 200);
  const saved = await call('/api/oms/orders', 'GET', undefined, cookies[0]); assert(saved.data.orders.some(o => o.id === order.id));
  assert.equal((await fetch(base + '/bookings', { headers: { Cookie: cookies[0] } })).status, 200);
  console.log('PASS commerce integration: real persisted multi-vendor orders, authoritative prices, concurrent idempotency, rollback, ownership, role forgery protection, unpaid workflow, conflicts, sibling isolation, durable audit/notifications, and deduplicated escalation.');
})().catch(e => { console.error(e); console.error(logs.slice(-3500)); process.exitCode = 1; }).finally(async () => {
  if (server?.pid) { if (process.platform === 'win32') spawnSync('C:\\Windows\\System32\\taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill('SIGTERM'); }
  if (/^commerce_test_[a-f0-9]{16}$/.test(schema)) await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  try { fs.rmSync(path.resolve(dist), { recursive: true, force: true }); fs.rmSync(config, { force: true }); } catch {}
});
