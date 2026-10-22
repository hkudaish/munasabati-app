import 'server-only';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../auth';
import { HttpError, text } from '../http';
import { atomic, lock } from '../booking/repository';
import { parseSettings, readSettings } from './events';

interface Filters { from: Date; to: Date; cityId: string | null; serviceId: string | null; vendorId: string | null }
function filters(params: URLSearchParams): Filters {
  const date = (key: string, fallback: Date) => { const raw = params.get(key); if (!raw) return fallback; const d = new Date(raw); if (!Number.isFinite(+d)) throw new HttpError(400, 'تاريخ غير صالح'); return d; };
  const to = date('to', new Date()), from = date('from', new Date(+to - 30 * 86400000));
  return { from, to, cityId: params.get('cityId') ? text(params.get('cityId'), 100) : null, serviceId: params.get('serviceId') ? text(params.get('serviceId'), 140) : null, vendorId: params.get('vendorId') ? text(params.get('vendorId'), 140) : null };
}

/** Every active (not saved-for-later) cart item with its last known price, who owns it and when the cart was last touched. */
async function cartItems(f: Filters) {
  return prisma.$queryRaw<any[]>`
    WITH items AS (
      SELECT c."userId", c."lastActivityAt", l->>'id' AS "lineId", l->>'cityId' AS "cityId", l->>'offerId' AS "offerId"
      FROM "CommerceCart" c, jsonb_array_elements(c."body"->'lines') l WHERE COALESCE(l->>'savedForLater','false') <> 'true'),
    latest AS (SELECT DISTINCT ON ("userId","lineId") "userId","lineId","totalHalala" FROM "CartPriceSnapshot" ORDER BY "userId","lineId","createdAt" DESC,"id" DESC)
    SELECT i."userId", i."lineId", i."cityId", i."lastActivityAt", i."offerId", o."serviceId", s."vendorId", COALESCE(p."totalHalala",0)::bigint AS "totalHalala"
    FROM items i LEFT JOIN latest p ON p."userId"=i."userId" AND p."lineId"=i."lineId"
    LEFT JOIN "CommerceOffer" o ON o."id"=i."offerId" LEFT JOIN "CommerceService" s ON s."id"=o."serviceId"
    WHERE i."lastActivityAt" >= ${f.from} AND i."lastActivityAt" <= ${f.to}
      AND (${f.cityId}::text IS NULL OR i."cityId"=${f.cityId}) AND (${f.serviceId}::text IS NULL OR o."serviceId"=${f.serviceId}) AND (${f.vendorId}::text IS NULL OR s."vendorId"=${f.vendorId})
    LIMIT 5000`;
}

export async function analytics(params: URLSearchParams) {
  await requireAdmin();
  const f = filters(params), { settings } = await prisma.$transaction(tx => readSettings(tx as any));
  const abandonAfterHours = settings.reminders.stagesHours[0] ?? 24;
  const items = await cartItems(f);
  const carts = new Map<string, { idleHours: number; value: number }>();
  for (const i of items) { const c = carts.get(i.userId) ?? { idleHours: (Date.now() - new Date(i.lastActivityAt).getTime()) / 3600000, value: 0 }; c.value += Number(i.totalHalala); carts.set(i.userId, c); }
  const list = Array.from(carts.values()), abandoned = list.filter(c => c.idleHours >= abandonAfterHours), pending = list.filter(c => c.idleHours < abandonAfterHours);
  const one = async (query: Promise<any[]>) => Number((await query)[0]?.n ?? 0);
  const drafts = await prisma.$queryRaw<any[]>`SELECT "status", COUNT(*)::int AS n FROM "BookingDraft" WHERE "updatedAt" >= ${f.from} AND "updatedAt" <= ${f.to} AND (${f.serviceId}::text IS NULL OR "serviceId"=${f.serviceId}) GROUP BY "status"`;
  const changes = await prisma.$queryRaw<any[]>`SELECT "direction", COUNT(*)::int AS n, COALESCE(SUM("differenceHalala"),0)::bigint AS total FROM "CartPriceChange" WHERE "detectedAt" >= ${f.from} AND "detectedAt" <= ${f.to} GROUP BY "direction"`;
  const jobs = await prisma.$queryRaw<any[]>`SELECT "template","status", COUNT(*)::int AS n FROM "NotificationJob" WHERE "createdAt" >= ${f.from} AND "createdAt" <= ${f.to} GROUP BY "template","status"`;
  const recovered = await one(prisma.$queryRaw`SELECT COUNT(DISTINCT j."userId")::int AS n FROM "NotificationJob" j JOIN "CommerceOrder" o ON o."customerId"=j."userId" AND o."createdAt" > j."sentAt" AND o."createdAt" < j."sentAt" + interval '7 days' WHERE j."template"='cart_reminder' AND j."status"='SENT' AND j."sentAt" >= ${f.from} AND j."sentAt" <= ${f.to}`);
  const orders = await one(prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "CommerceOrder" WHERE "createdAt" >= ${f.from} AND "createdAt" <= ${f.to}`);
  const started = await one(prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS n FROM "CartPriceSnapshot" WHERE "createdAt" >= ${f.from} AND "createdAt" <= ${f.to}`);
  const bookings = await one(prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "CommerceBooking" b JOIN "CommerceOrderItem" i ON i."id"=b."orderItemId" JOIN "CommerceOrder" o ON o."id"=i."orderId" WHERE b."status"='CONFIRMED' AND o."createdAt" >= ${f.from} AND o."createdAt" <= ${f.to}`);
  const dead = await one(prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "NotificationJob" WHERE "status"='DEAD')::int + (SELECT COUNT(*) FROM "DomainOutbox" WHERE "status"='DEAD')::int AS n`);
  const reminderJobs = jobs.filter(j => j.template === 'cart_reminder'), sum = (rows: any[], status: string) => rows.filter(r => r.status === status).reduce((n, r) => n + r.n, 0);
  const bucket = (direction: string) => { const r = changes.find(c => c.direction === direction); return { count: r?.n ?? 0, totalHalala: Number(r?.total ?? 0) }; };
  return {
    filters: { from: f.from, to: f.to, cityId: f.cityId, serviceId: f.serviceId, vendorId: f.vendorId },
    note: 'Draft and cart values are intentions, not sales: they are never included in revenue.',
    drafts: Object.fromEntries(drafts.map(d => [d.status, d.n])),
    carts: { pending: pending.length, pendingValueHalala: pending.reduce((n, c) => n + c.value, 0), abandoned: abandoned.length, abandonedValueHalala: abandoned.reduce((n, c) => n + c.value, 0), abandonAfterHours, recovered },
    priceChanges: { increases: bucket('INCREASE'), decreases: bucket('DECREASE') },
    reminders: { sent: sum(reminderJobs, 'SENT'), skipped: sum(reminderJobs, 'SKIPPED'), pending: sum(reminderJobs, 'PENDING'), dead: sum(reminderJobs, 'DEAD') },
    notificationJobs: jobs,
    checkout: { ordersCreated: orders, cartsStarted: started, conversion: started ? Number((orders / started).toFixed(4)) : null, confirmedBookings: bookings, deadLetters: dead },
  };
}

export async function abandonedCarts(params: URLSearchParams) {
  await requireAdmin();
  const f = filters(params), { settings } = await prisma.$transaction(tx => readSettings(tx as any)), after = settings.reminders.stagesHours[0] ?? 24;
  const items = await cartItems({ ...f, from: new Date(0) });
  const byUser = new Map<string, { userId: string; lastActivityAt: Date; items: number; valueHalala: number }>();
  for (const i of items) { const c = byUser.get(i.userId) ?? { userId: i.userId, lastActivityAt: i.lastActivityAt, items: 0, valueHalala: 0 }; c.items++; c.valueHalala += Number(i.totalHalala); byUser.set(i.userId, c); }
  const carts = Array.from(byUser.values()).filter(c => (Date.now() - new Date(c.lastActivityAt).getTime()) / 3600000 >= after).sort((a, b) => +new Date(a.lastActivityAt) - +new Date(b.lastActivityAt)).slice(0, 200);
  const names = carts.length ? await prisma.$queryRaw<any[]>`SELECT "id","name" FROM "User" WHERE "id" = ANY(${carts.map(c => c.userId)})` : [];
  const reminders = carts.length ? await prisma.$queryRaw<any[]>`SELECT "userId", COUNT(*) FILTER (WHERE "status"='SENT')::int AS sent FROM "NotificationJob" WHERE "template"='cart_reminder' AND "userId" = ANY(${carts.map(c => c.userId)}) GROUP BY "userId"` : [];
  return { carts: carts.map(c => ({ ...c, name: names.find(n => n.id === c.userId)?.name ?? null, remindersSent: reminders.find(r => r.userId === c.userId)?.sent ?? 0 })), abandonAfterHours: after };
}

export async function priceChangeEvents(params: URLSearchParams) {
  await requireAdmin();
  const f = filters(params), direction = params.get('direction');
  if (direction && !['INCREASE', 'DECREASE'].includes(direction)) throw new HttpError(400, 'بيانات غير صالحة');
  const rows = await prisma.$queryRaw<any[]>`SELECT c."id",c."userId",c."lineId",c."direction",c."differenceHalala",c."differencePercent",c."reasonCode",c."detectedAt",c."acknowledgedAt",a."totalHalala" AS "previousHalala",b."totalHalala" AS "newHalala" FROM "CartPriceChange" c JOIN "CartPriceSnapshot" a ON a."id"=c."previousSnapshotId" JOIN "CartPriceSnapshot" b ON b."id"=c."newSnapshotId" WHERE c."detectedAt" >= ${f.from} AND c."detectedAt" <= ${f.to} AND (${direction}::text IS NULL OR c."direction"=${direction}) ORDER BY c."detectedAt" DESC LIMIT 300`;
  return { events: rows.map(r => ({ ...r, differenceHalala: Number(r.differenceHalala), differencePercent: r.differencePercent === null ? null : Number(r.differencePercent), previousHalala: Number(r.previousHalala), newHalala: Number(r.newHalala) })) };
}

export async function getNotificationSettings() {
  await requireAdmin();
  return prisma.$transaction(tx => readSettings(tx as any));
}
export async function saveNotificationSettings(input: any) {
  const user = await requireAdmin(), settings = parseSettings(input.settings ?? input);
  return atomic(async tx => {
    await lock(tx, 'notification-settings');
    const current = await readSettings(tx);
    if (input.version !== undefined && input.version !== current.version) throw new HttpError(409, 'تغير الطلب');
    await tx.$executeRaw`INSERT INTO "CartNotificationSetting" ("id","body") VALUES ('default',${JSON.stringify(settings)}::jsonb) ON CONFLICT ("id") DO UPDATE SET "body"=EXCLUDED."body","version"="CartNotificationSetting"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'CART_NOTIFICATION_SETTINGS_CHANGED', targetId: 'default', details: { reminders: settings.reminders, price: settings.price, channels: settings.channels } } });
    return readSettings(tx);
  });
}

export async function notificationJobs(params: URLSearchParams) {
  await requireAdmin();
  const status = params.get('status'), template = params.get('template');
  if (status && !['PENDING', 'SENT', 'SKIPPED', 'DEAD'].includes(status)) throw new HttpError(400, 'بيانات غير صالحة');
  const jobs = await prisma.$queryRaw<any[]>`SELECT j."id",j."userId",j."template",j."channel",j."status",j."scheduledAt",j."sentAt",j."retryCount",j."lastError",j."createdAt",(SELECT COUNT(*)::int FROM "NotificationAttempt" a WHERE a."jobId"=j."id") AS attempts FROM "NotificationJob" j WHERE (${status}::text IS NULL OR j."status"=${status}) AND (${template}::text IS NULL OR j."template"=${template}) ORDER BY j."createdAt" DESC LIMIT 200`;
  return { jobs };
}
