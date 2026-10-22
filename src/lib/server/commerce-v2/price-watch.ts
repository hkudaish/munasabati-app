import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { atomic, lock, Tx } from '../booking/repository';
import { HttpError } from '../http';
import { activeLines, quoteLines } from './cart';
import { emit } from './events';

const PRICING_VERSION = 1;
const total = (line: any) => Math.round(line.price.total);
const breakdownOf = (rows: any[]) => ({
  subtotal: rows.reduce((n, l) => n + l.price.subtotal, 0), tax: rows.reduce((n, l) => n + l.price.tax, 0), fees: rows.reduce((n, l) => n + l.price.fees, 0),
  discount: rows.reduce((n, l) => n + l.price.discount, 0), total: rows.reduce((n, l) => n + l.price.total, 0), deposit: rows.reduce((n, l) => n + l.price.deposit, 0),
});

/**
 * Compares what each active cart item costs now with the last price the customer was shown.
 * A first sight records a baseline; a different total records a new immutable snapshot and a change event
 * (an increase must be acknowledged before checkout; a decrease just takes effect). Items that can no longer be bought are flagged for
 * review but never removed. Returns how many changes were recorded.
 */
export async function detectPriceChanges(userId: string): Promise<number> {
  return atomic(async tx => {
    await lock(tx, 'pricewatch:' + userId);
    const cart = (await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${userId}`)[0];
    const lines = activeLines(cart?.body.lines ?? []);
    if (!lines.length) return 0;
    let quoted: any[] = [];
    try { quoted = (await quoteLines(tx, lines)).lines; }
    catch (error) {
      if (!(error instanceof HttpError)) throw error;
      // the cart as a whole cannot be priced: find which items are the problem, and price the rest
      for (const line of lines) {
        try { quoted.push(...(await quoteLines(tx, [line])).lines); }
        catch (inner) {
          if (!(inner instanceof HttpError)) throw inner;
          if (inner.message.includes('يلزم إضافة الخدمة المطلوبة')) continue;     // a relationship between items, not a fault of this one
          const key = createHash('sha256').update(line.id + '|' + inner.message).digest('hex').slice(0, 24);
          const seen = (await tx.$queryRaw<any[]>`SELECT 1 FROM "DomainOutbox" WHERE "aggregateId"=${userId} AND "eventType"='CartItemRequiresReview' AND "payload"->>'key'=${key} LIMIT 1`)[0];
          if (!seen) await emit(tx, { aggregateType: 'Cart', aggregateId: userId, version: cart.version, type: 'CartItemRequiresReview', payload: { lineId: line.id, key, reason: inner.message } });
        }
      }
    }
    const byLine = new Map<string, any[]>();
    for (const l of quoted) byLine.set(l.cartLineId, [...(byLine.get(l.cartLineId) ?? []), l]);
    let changes = 0;
    for (const [lineId, rows] of Array.from(byLine.entries())) {
      if (rows.some(r => r.price.needsQuote)) continue;                              // no price to compare until the vendor quotes
      const now = rows.reduce((n, l) => n + total(l), 0), breakdown = breakdownOf(rows);
      const last = (await tx.$queryRaw<any[]>`SELECT "id","totalHalala" FROM "CartPriceSnapshot" WHERE "userId"=${userId} AND "lineId"=${lineId} ORDER BY "createdAt" DESC, "id" DESC LIMIT 1`)[0];
      if (last && Number(last.totalHalala) === now) continue;
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO "CartPriceSnapshot" ("id","userId","lineId","currency","totalHalala","breakdown","pricingVersion") VALUES (${id},${userId},${lineId},'SAR',${now},${JSON.stringify(breakdown)}::jsonb,${PRICING_VERSION})`;
      if (!last) continue;                                                           // baseline
      const previous = Number(last.totalHalala), difference = now - previous, direction = difference > 0 ? 'INCREASE' : 'DECREASE';
      const percent = previous ? Number(((difference / previous) * 100).toFixed(4)) : null;
      const changeId = randomUUID();
      await tx.$executeRaw`INSERT INTO "CartPriceChange" ("id","userId","lineId","previousSnapshotId","newSnapshotId","direction","differenceHalala","differencePercent","reasonCode","acknowledgedAt") VALUES (${changeId},${userId},${lineId},${last.id},${id},${direction},${difference},${percent},'CATALOG_PRICE_CHANGED',${direction === 'DECREASE' ? new Date() : null})`;
      await emit(tx, { aggregateType: 'Cart', aggregateId: userId, version: cart.version, type: direction === 'INCREASE' ? 'CartPriceIncreased' : 'CartPriceDecreased', payload: { changeId, lineId, previousHalala: previous, newHalala: now, differenceHalala: difference, title: rows[0].titleAr, titleEn: rows[0].service?.titleEn || null } });
      changes++;
    }
    return changes;
  });
}

/** After the customer saved the cart themselves, the prices they see are the new baseline (their own edit is not a catalog change). */
export async function recordBaseline(tx: Tx, userId: string, quotedLines: any[]) {
  const byLine = new Map<string, any[]>();
  for (const l of quotedLines) byLine.set(l.cartLineId, [...(byLine.get(l.cartLineId) ?? []), l]);
  for (const [lineId, rows] of Array.from(byLine.entries())) {
    if (rows.some(r => r.price.needsQuote)) continue;
    const now = rows.reduce((n, l) => n + total(l), 0);
    const last = (await tx.$queryRaw<any[]>`SELECT "totalHalala" FROM "CartPriceSnapshot" WHERE "userId"=${userId} AND "lineId"=${lineId} ORDER BY "createdAt" DESC, "id" DESC LIMIT 1`)[0];
    if (last && Number(last.totalHalala) === now) continue;
    await tx.$executeRaw`INSERT INTO "CartPriceSnapshot" ("id","userId","lineId","currency","totalHalala","breakdown","pricingVersion") VALUES (${randomUUID()},${userId},${lineId},'SAR',${now},${JSON.stringify(breakdownOf(rows))}::jsonb,${PRICING_VERSION})`;
  }
}

/** Cron: looks at every cart that has active items. One failing cart never stops the others. */
export async function detectAllPriceChanges(limit = 200) {
  const carts = await prisma.$queryRaw<{ userId: string }[]>`SELECT "userId" FROM "CommerceCart" WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("body"->'lines') l WHERE COALESCE(l->>'savedForLater','false') <> 'true') ORDER BY "updatedAt" DESC LIMIT ${limit}`;
  let changes = 0, failed = 0;
  for (const { userId } of carts) { try { changes += await detectPriceChanges(userId); } catch (error) { failed++; console.warn(JSON.stringify({ event: 'pricewatch.failed', userId, error: error instanceof Error ? error.message : String(error) })); } }
  return { carts: carts.length, changes, failed };
}
