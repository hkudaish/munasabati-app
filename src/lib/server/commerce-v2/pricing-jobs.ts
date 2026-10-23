import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { atomic, lock } from '../booking/repository';
import { mergePolicy } from '@/lib/booking/engine';
import { offerRow, serviceRow, syncOffer } from './catalog';

/**
 * Cron: scheduled price changes whose time has come become real offer versions (new version number, version history row, synced offering),
 * exactly as if the owner had saved them; carts that hold the offer are noticed by the price watch on its next pass.
 */
export async function applyDuePriceSchedules(now = new Date()) {
  const due = await prisma.$queryRaw<{ id: string; offerId: string }[]>`SELECT "id","offerId" FROM "OfferPriceSchedule" WHERE "status"='SCHEDULED' AND "effectiveFrom" <= ${now} ORDER BY "effectiveFrom","id" LIMIT 50`;
  let applied = 0, failed = 0;
  for (const item of due) {
    try {
      await atomic(async tx => {
        await lock(tx, 'offer-price:' + item.offerId);
        const row = (await tx.$queryRaw<any[]>`SELECT * FROM "OfferPriceSchedule" WHERE "id"=${item.id} AND "status"='SCHEDULED'`)[0];
        if (!row) return;
        const offer = await offerRow(tx, row.offerId), service = await serviceRow(tx, offer.serviceId);
        const previous = Number(offer.body.policy?.baseAmount ?? 0), policy = mergePolicy({ ...offer.body.policy, baseAmount: Number(row.newBaseAmount) });
        const body = { ...offer.body, policy: { ...offer.body.policy, baseAmount: policy.baseAmount } };
        await tx.$executeRaw`UPDATE "CommerceOffer" SET "body"=${JSON.stringify(body)}::jsonb,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.offerId}`;
        const next = await offerRow(tx, row.offerId);
        await tx.$executeRaw`INSERT INTO "CommerceOfferVersion" ("id","offerId","version","snapshot") VALUES (${randomUUID()},${row.offerId},${next.version},${JSON.stringify(next.body)}::jsonb)`;
        await syncOffer(tx, next, service);
        await tx.$executeRaw`UPDATE "OfferPriceSchedule" SET "status"='APPLIED',"appliedAt"=CURRENT_TIMESTAMP,"previousBaseAmount"=${previous} WHERE "id"=${row.id}`;
        await tx.systemAuditLog.create({ data: { actorId: row.createdBy ?? undefined, action: 'COMMERCE_PRICE_SCHEDULE_APPLIED', targetId: row.offerId, details: { scheduleId: row.id, from: previous, to: Number(row.newBaseAmount), version: next.version } } });
      });
      applied++;
    } catch (error) { failed++; console.warn(JSON.stringify({ event: 'price-schedule.failed', id: item.id, error: error instanceof Error ? error.message : String(error) })); }
  }
  return { applied, failed };
}

/** Cron: a promotion use is given back when every item of the order that used it was cancelled, rejected or expired. */
export async function releaseStaleRedemptions() {
  return Number(await prisma.$executeRaw`UPDATE "DiscountRedemption" r SET "status"='RELEASED' WHERE r."status"='REDEEMED' AND NOT EXISTS (SELECT 1 FROM "CommerceOrderItem" i WHERE i."orderId"=r."orderId" AND i."body"->>'status' NOT IN ('CANCELLED','REJECTED','EXPIRED'))`);
}
