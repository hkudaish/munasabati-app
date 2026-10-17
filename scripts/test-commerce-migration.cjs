// Regression for upgrading an older schema without rewriting order amounts/statuses.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { randomBytes } = require('node:crypto'), { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const schema = 'commerce_migration_test_' + randomBytes(8).toString('hex');
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const publishedSql = fs.readFileSync('netlify/database/migrations/202610170004_safe_commerce_defaults.sql', 'utf8');
assert(!/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(publishedSql), 'Netlify must own the migration transaction');
(async () => {
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await db.$executeRawUnsafe(`CREATE TYPE "BookingStatus" AS ENUM ('PENDING','CONFIRMED','IN_PREPARATION','COMPLETED','CANCELLED','DISPUTED')`);
  await db.$executeRawUnsafe(`CREATE TABLE "MultiVendorOrder" (id TEXT PRIMARY KEY, "customerId" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), status TEXT NOT NULL DEFAULT 'confirmed', "finalTotal" INT NOT NULL)`);
  await db.$executeRawUnsafe(`CREATE TABLE "Suborder" (id TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "vendorId" TEXT NOT NULL, status "BookingStatus" NOT NULL DEFAULT 'CONFIRMED')`);
  await db.$executeRawUnsafe(`CREATE TABLE "OrderItem" (id TEXT PRIMARY KEY, "scheduledDate" TEXT NOT NULL)`);
  await db.$executeRawUnsafe(`INSERT INTO "MultiVendorOrder" (id,status,"finalTotal") VALUES ('old-complete','completed',5500),('old-confirmed','confirmed',1200)`);
  await db.$executeRawUnsafe(`INSERT INTO "Suborder" (id,"orderId","vendorId",status) VALUES ('sub-complete','old-complete','vendor-a','COMPLETED'),('sub-confirmed','old-confirmed','vendor-a','CONFIRMED')`);
  const env = { ...process.env, DATABASE_URL: url.toString() };
  for (let i = 0; i < 2; i++) {
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','db','execute','--file','netlify/database/migrations/202610170004_safe_commerce_defaults.sql','--schema','prisma/schema.prisma'], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  const orders = await db.$queryRaw`SELECT id,status,"finalTotal","omsStatus"::text,"paymentStatus"::text FROM "MultiVendorOrder" ORDER BY id`;
  assert.deepEqual(orders, [{ id: 'old-complete', status: 'completed', finalTotal: 5500, omsStatus: 'COMPLETED', paymentStatus: 'UNPAID' }, { id: 'old-confirmed', status: 'confirmed', finalTotal: 1200, omsStatus: 'AWAITING_ACCEPTANCE', paymentStatus: 'UNPAID' }]);
  const subs = await db.$queryRaw`SELECT id,"omsStatus"::text FROM "Suborder" ORDER BY id`;
  assert.deepEqual(subs, [{ id: 'sub-complete', omsStatus: 'COMPLETED' }, { id: 'sub-confirmed', omsStatus: 'ACCEPTED' }]);
  const defaults = await db.$queryRaw`SELECT column_name,column_default FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'MultiVendorOrder' AND column_name = 'paymentStatus'`;
  assert(defaults[0].column_default.includes('UNPAID'));
  console.log('PASS additive legacy migration, repeated application, preserved order amounts/statuses, historical supplier reservations, and safe unpaid defaults.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (/^commerce_migration_test_[a-f0-9]{16}$/.test(schema)) await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});
