import 'server-only';
import { randomUUID } from 'node:crypto';
import { Tx, lock } from '../booking/repository';
import { PackagePolicy, Rule, Quote, Funding, CALCULATION_VERSION } from '@/lib/commerce/pricing-engine';

/** The pricing policy in force for a package right now. A package that predates policies (or a database before the migration) still prices as it always did. */
export async function loadPolicy(tx: Tx, pack: any, now: Date, overrides?: Record<string, PackagePolicy>): Promise<PackagePolicy> {
  if (overrides?.[pack.id]) return overrides[pack.id];
  try {
    const row = (await tx.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "packageId"=${pack.id} AND "status"='ACTIVE' AND "effectiveFrom" <= ${now} AND ("effectiveUntil" IS NULL OR "effectiveUntil" > ${now}) ORDER BY "version" DESC LIMIT 1`)[0];
    if (row) return policyFromRow(row);
  } catch { /* the table does not exist yet: fall through to the package's own fields */ }
  const b = pack.body ?? {};
  if ((b.fixedTotal ?? 0) > 0) return { model: 'FIXED_PRICE', fixedPrice: b.fixedTotal };
  if ((b.discountBps ?? 0) > 0) return { model: 'PERCENT', discountBps: b.discountBps };
  return { model: 'SUM' };
}
export function policyFromRow(row: any): PackagePolicy {
  return { id: row.id, version: row.version, model: row.pricingModel, fixedPrice: row.fixedPrice === null ? null : Number(row.fixedPrice), discountBps: row.discountPercentage === null ? null : Math.round(Number(row.discountPercentage) * 100), discountAmount: row.discountAmount === null ? null : Number(row.discountAmount), config: row.config ?? {} };
}
export const policyView = (p: PackagePolicy) => ({ id: p.id ?? null, version: p.version ?? null, model: p.model, fixedPrice: p.fixedPrice ?? null, discountBps: p.discountBps ?? null, discountAmount: p.discountAmount ?? null, config: p.config ?? {} });

export function ruleFromRow(row: any, targets: any[]): Rule {
  const pct = row.discountType === 'PERCENTAGE';
  return {
    id: row.id, version: row.version, name: row.name, kind: row.kind, type: row.discountType, value: pct ? Math.round(Number(row.value) * 100) : Number(row.value),
    maxDiscount: row.maximumDiscount === null ? null : Number(row.maximumDiscount), minSubtotal: Number(row.minimumSubtotal), priority: row.priority, stackable: row.stackable, stackingGroup: row.stackingGroup,
    funding: row.fundingType as Funding, vendorShareBps: row.vendorShareBps, code: row.code, startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null, endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    usageLimit: row.usageLimit, perCustomerLimit: row.perCustomerLimit, ownerVendorId: row.ownerVendorId, status: row.status, conditions: row.conditions ?? {},
    targets: { packageIds: targets.filter(t => t.packageId).map(t => t.packageId), serviceIds: targets.filter(t => t.serviceId).map(t => t.serviceId), offerIds: targets.filter(t => t.offerId).map(t => t.offerId), vendorIds: targets.filter(t => t.vendorId).map(t => t.vendorId) },
  };
}
/** Active rules, plus any rule whose code the customer typed (so a code that is disabled or expired can be explained instead of silently ignored). */
export async function loadRules(tx: Tx, promoCodes: string[]): Promise<Rule[]> {
  try {
    const codes = promoCodes.map(c => c.trim().toUpperCase());
    const rows = await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRule" WHERE "status"='ACTIVE' OR (${codes.length > 0} AND upper("code") = ANY(${codes})) ORDER BY "id"`;
    if (!rows.length) return [];
    const targets = await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRuleTarget" WHERE "ruleId" = ANY(${rows.map(r => r.id)})`;
    return rows.map(r => ruleFromRow(r, targets.filter(t => t.ruleId === r.id)));
  } catch { return []; }
}
/** How much of each limited rule has been used (and by this customer): reserved and redeemed count, released does not. */
export async function usageMap(tx: Tx, ruleIds: string[], customerId: string | null) {
  const map = new Map<string, { total: number; byCustomer: number }>();
  if (!ruleIds.length) return (id: string) => map.get(id) ?? { total: 0, byCustomer: 0 };
  const rows = await tx.$queryRaw<any[]>`SELECT "discountRuleId" AS id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "customerId"=${customerId ?? ''})::int AS mine FROM "DiscountRedemption" WHERE "discountRuleId" = ANY(${ruleIds}) AND "status" IN ('RESERVED','REDEEMED') GROUP BY 1`;
  for (const r of rows) map.set(r.id, { total: r.total, byCustomer: r.mine });
  return (id: string) => map.get(id) ?? { total: 0, byCustomer: 0 };
}
export async function orderCount(tx: Tx, userId: string | null): Promise<number | null> {
  if (!userId) return null;
  return (await tx.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "CommerceOrder" WHERE "customerId"=${userId}`)[0].n;
}
/** Serialises the checkout of customers racing for the last uses of a limited promotion (always in the same order, so two checkouts never deadlock). */
export async function lockLimitedRules(tx: Tx) {
  try {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "DiscountRule" WHERE "status"='ACTIVE' AND ("usageLimit" IS NOT NULL OR "perCustomerLimit" IS NOT NULL) ORDER BY "id"`;
    for (const r of rows) await lock(tx, 'discount:' + r.id);
  } catch { /* no rules table yet */ }
}

/** Writes the itemised quote, what was applied and the redemptions, in the caller's transaction (the order). Immutable once written. */
export async function persistQuote(tx: Tx, input: { userId: string; orderId: string; quote: Quote; id?: string }) {
  const id = input.id ?? randomUUID(), q = input.quote;
  const summary = { models: q.models, componentSubtotal: q.componentSubtotal, optionalExtras: q.optionalExtras, fees: q.fees, offerDiscount: q.offerDiscount, packageDiscount: q.packageDiscount, promotionDiscount: q.promotionDiscount, discountTotal: q.discountTotal, taxes: q.taxes, funding: q.funding, rejected: q.rejected };
  await tx.$executeRaw`INSERT INTO "PriceQuote" ("id","userId","orderId","calculationVersion","currency","status","mode","totals","summary") VALUES (${id},${input.userId},${input.orderId},${q.calculationVersion},'SAR','FINAL',${q.mode},${JSON.stringify({ grandTotal: q.grandTotal, taxes: q.taxes, discountTotal: q.discountTotal })}::jsonb,${JSON.stringify(summary)}::jsonb)`;
  for (const c of q.components) await tx.$executeRaw`INSERT INTO "PriceQuoteComponent" ("id","priceQuoteId","offerId","packageItemId","packageId","lineId","componentType","quantity","unitPrice","grossAmount","discountAmount","netAmount","taxAmount","vendorFundedAmount","platformFundedAmount","commissionAmount","vendorId") VALUES (${randomUUID()},${id},${c.offerId},${c.packageItemId},${c.packageId},${c.lineId},${c.type},${c.quantity},${c.unitPrice},${c.gross},${c.discount},${c.net},${c.tax},${c.vendorFunded},${c.platformFunded},${c.commission},${c.vendorId})`;
  for (const d of q.discounts) {
    await tx.$executeRaw`INSERT INTO "AppliedDiscount" ("id","priceQuoteId","discountRuleId","discountRuleVersion","source","description","discountAmount","eligibleBaseAmount","fundingType","allocationDetails","ruleSnapshot") VALUES (${randomUUID()},${id},${d.ruleId},${d.ruleVersion},${d.source},${d.description},${d.amount},${d.eligibleBase},${d.funding},${JSON.stringify(d.allocation)}::jsonb,${d.snapshot ? JSON.stringify(d.snapshot) : null}::jsonb)`;
    if (d.ruleId) await tx.$executeRaw`INSERT INTO "DiscountRedemption" ("id","discountRuleId","customerId","orderId","discountAmount","status") VALUES (${randomUUID()},${d.ruleId},${input.userId},${input.orderId},${d.amount},'REDEEMED')`;
  }
  return id;
}
export { CALCULATION_VERSION };

/** What a customer may see of a quote: amounts and the reasons for them, never who funds a discount or what a vendor's commission is. */
export function publicPricing(q: Quote | undefined, rules: Rule[], promoCodes: string[]) {
  if (!q) return undefined;
  const typed = new Set(promoCodes.map(c => c.trim().toUpperCase())), codeOf = new Map(rules.map(r => [r.id, r.code ? r.code.toUpperCase() : null]));
  return {
    calculationVersion: q.calculationVersion, mode: q.mode, quoteStatus: q.quoteStatus, requiresAcknowledgment: q.requiresAcknowledgment, currency: q.currency,
    componentSubtotal: q.componentSubtotal, optionalExtras: q.optionalExtras, fees: q.fees, packageDiscount: q.packageDiscount, promotionDiscount: q.promotionDiscount, discountTotal: q.discountTotal, taxes: q.taxes, grandTotal: q.grandTotal,
    models: q.models.map(m => ({ entryId: m.entryId, packageId: m.packageId, model: m.model })),
    components: q.components.map(c => ({ lineId: c.lineId, offerId: c.offerId, packageId: c.packageId, type: c.type, quantity: c.quantity, gross: c.gross, discount: c.discount, net: c.net, tax: c.tax })),
    discounts: q.discounts.map(d => ({ source: d.source, description: d.description, amount: d.amount })),
    // a customer is told why a code they typed did not apply (and why a package discount or promotion was not combined); other rules stay private
    rejected: q.rejected.filter(r => r.code === 'PACKAGE_DISCOUNT' || (r.ruleId === null ? r.code === 'UNKNOWN_CODE' : typed.has(codeOf.get(r.ruleId) ?? ''))).map(r => ({ name: r.ruleId === null && r.code === 'UNKNOWN_CODE' ? r.name : r.name, code: r.code, reasonAr: r.reasonAr })),
  };
}
