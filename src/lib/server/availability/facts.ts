import 'server-only';
import { prisma } from '@/lib/db';
import type { Context, Intent, Snapshot } from '@/lib/availability/types';
import { DEFAULT_TZ } from '@/lib/availability/schedule';
import type { GeoDB } from '@/lib/server/geo/data';

/** The facts about an offer that live in the existing tables, in the shape the resolver expects. */
export interface OfferFacts {
  offerId: string; serviceId: string; legacyServiceId: string | null; categoryId: string | null; vendorId: string | null;
  kind: Context['serviceKind']; serviceCities: string[] | undefined; vendorActive: boolean; offerEnabled: boolean; serviceReady: boolean;
}
export async function offerFacts(db: GeoDB, offeringId: string): Promise<OfferFacts | null> {
  let rows = await db.$queryRaw<any[]>`SELECT o."id" AS "offerId", o."body" AS "offerBody", s."id" AS "serviceId", s."sourceId", s."ownerId", s."vendorId", s."body" AS "serviceBody" FROM "CommerceOffer" o JOIN "CommerceService" s ON s."id" = o."serviceId" WHERE o."id" = ${offeringId}`;
  let legacy: any = null;
  if (!rows[0]) {
    // an offering defined by the older booking configuration: it points at a legacy service item, which has a CommerceService twin
    const defs = await db.$queryRaw<any[]>`SELECT "body" FROM "ServiceDefinition" WHERE "id" = ${offeringId} AND "kind" = 'OFFERING'`;
    legacy = defs[0]?.body;
    if (!legacy) return null;
    rows = legacy.serviceId ? await db.$queryRaw<any[]>`SELECT NULL AS "offerId", NULL AS "offerBody", s."id" AS "serviceId", s."sourceId", s."ownerId", s."vendorId", s."body" AS "serviceBody" FROM "CommerceService" s WHERE s."sourceId" = ${legacy.serviceId}` : [];
    if (!rows[0]) return { offerId: offeringId, serviceId: legacy.serviceId ?? offeringId, legacyServiceId: legacy.serviceId ?? null, categoryId: legacy.categoryId ?? null, vendorId: legacy.commerceVendorId ?? null, kind: 'BOOKABLE', serviceCities: legacy.cities, vendorActive: true, offerEnabled: legacy.enabled !== false, serviceReady: true };
  }
  const r = rows[0], serviceBody = r.serviceBody ?? {};
  let vendorId: string | null = r.vendorId ?? legacy?.commerceVendorId ?? null;
  if (!vendorId && r.ownerId) vendorId = (await db.vendor.findFirst({ where: { userId: r.ownerId }, select: { id: true } }))?.id ?? null;
  // a service an administrator created for a vendor lists that vendor as its manager: that vendor is the one availability policies refer to
  if (!vendorId && Array.isArray(serviceBody.managerIds) && serviceBody.managerIds.length) vendorId = (await db.vendor.findFirst({ where: { userId: { in: serviceBody.managerIds } }, select: { id: true }, orderBy: { id: 'asc' } }))?.id ?? null;
  let vendorActive = true;
  if (vendorId) { const vendor = await db.vendor.findUnique({ where: { id: vendorId }, select: { status: true, user: { select: { isActive: true } } } }); vendorActive = !vendor || (vendor.status === 'ACTIVE' && vendor.user?.isActive !== false); }
  const ready = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "CommerceOffer" WHERE "serviceId" = ${r.serviceId} AND "body"->>'enabled' = 'true'`;
  return {
    offerId: r.offerId ?? offeringId, serviceId: r.serviceId, legacyServiceId: r.sourceId ?? null, categoryId: serviceBody.categoryId ?? legacy?.categoryId ?? null, vendorId, kind: serviceBody.kind ?? 'BOOKABLE',
    serviceCities: Array.isArray(serviceBody.cities) ? serviceBody.cities : legacy?.cities, vendorActive, offerEnabled: r.offerBody ? r.offerBody.enabled !== false : legacy?.enabled !== false, serviceReady: (ready[0]?.n ?? 0) > 0,
  };
}

/** Bookings already taking capacity on a date (Riyadh calendar day): not cancelled, rejected or expired, and no lapsed hold. */
async function countRequests(db: GeoDB, date: string, filter: { offerIds?: string[]; exclude?: string | null }) {
  const offerIds = filter.offerIds ?? null, exclude = filter.exclude ?? null;
  const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ServiceRequest" r LEFT JOIN "CommerceBooking" b ON b."requestId" = r."id"
    WHERE (${offerIds}::text[] IS NULL OR r."offeringId" = ANY(${offerIds}::text[]))
      AND (r."startAt" AT TIME ZONE ${DEFAULT_TZ})::date = ${date}::date
      AND r."status" NOT IN ('REJECTED', 'CANCELLED', 'EXPIRED')
      AND NOT (b."status" = 'HELD' AND b."body"->>'holdExpiresAt' IS NOT NULL AND (b."body"->>'holdExpiresAt')::timestamptz < now())
      AND (${exclude}::text IS NULL OR r."id" <> ${exclude})`;
  return rows[0]?.n ?? 0;
}
async function offerIdsOf(db: GeoDB, scope: string, facts: OfferFacts, ctx: Context): Promise<string[] | null> {
  if (scope === 'MODULE' || scope === 'PLATFORM') return null;
  const byService = async (where: string, value: string) => {
    const commerce = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT o."id" FROM "CommerceOffer" o JOIN "CommerceService" s ON s."id" = o."serviceId" WHERE ${where}`, value);
    const legacyIds = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT d."id" FROM "ServiceDefinition" d JOIN "CommerceService" s ON s."sourceId" = d."body"->>'serviceId' WHERE d."kind" = 'OFFERING' AND ${where}`, value);
    return [...commerce.map(r => r.id), ...legacyIds.map(r => r.id)];
  };
  if (scope === 'OFFER') return [facts.offerId];
  if (scope === 'SERVICE') return byService('s."id" = $1', facts.serviceId);
  if (scope === 'VENDOR' && facts.vendorId) return byService('s."vendorId" = $1', facts.vendorId);
  if (scope === 'CATEGORY' && facts.categoryId) return byService(`s."body"->>'categoryId' = $1`, facts.categoryId);
  void ctx;
  return [];
}
/** Which levels of the hierarchy have a daily cap (so only those are counted). */
export function cappedScopes(snapshot: Snapshot, chain: Record<string, string | null | undefined>): string[] {
  const scopes: string[] = [];
  for (const policy of snapshot.policies) {
    if (chain[policy.entityType] !== policy.entityId) continue;
    const capped = policy.restrictionConfig.maxBookingsPerDay != null || policy.geoRules.some(r => r.restrictionConfig?.maxBookingsPerDay != null) || policy.schedules.some(s => s.maxBookings != null);
    if (capped && !scopes.includes(policy.entityType)) scopes.push(policy.entityType);
  }
  return scopes.sort();
}
export function chainOf(facts: OfferFacts, moduleId = 'commerce', packageId?: string | null): Record<string, string | null | undefined> {
  return { PLATFORM: 'platform', MODULE: moduleId, CATEGORY: facts.categoryId, SERVICE: facts.serviceId, VENDOR: facts.vendorId, OFFER: facts.offerId, PACKAGE: packageId };
}
export async function countByScope(db: GeoDB, scopes: string[], date: string, facts: OfferFacts, ctx: Context, exclude?: string | null, packageId?: string | null) {
  const used: Record<string, number> = {};
  for (const scope of scopes) {
    if (scope === 'PACKAGE') { if (!packageId) continue; const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT i."orderId")::int AS n FROM "CommerceOrderItem" i WHERE i."packageId" = ${packageId} AND ((i."body"->>'startAt')::timestamptz AT TIME ZONE ${DEFAULT_TZ})::date = ${date}::date AND i."body"->>'status' NOT IN ('REJECTED','CANCELLED','EXPIRED')`; used[scope] = rows[0]?.n ?? 0; continue; }
    const ids = await offerIdsOf(db, scope, facts, ctx);
    used[scope] = ids && !ids.length ? 0 : await countRequests(db, date, { offerIds: ids ?? undefined, exclude });
  }
  return used;
}

export interface BuildInput { /** an approved exception waives the minimum lead time restriction (and nothing else) */ waiveLeadTime?: boolean; offeringId: string; cityId?: string | null; countryCode?: string | null; date?: string | null; time?: string | null; quantity?: number; intent?: Intent; actorIsAdmin?: boolean; packageId?: string | null; visitorCityId?: string | null; excludeRequestId?: string | null; noLock?: boolean }
export function toContext(facts: OfferFacts, input: BuildInput): Context {
  return {
    entityType: 'OFFER', moduleId: 'commerce', categoryId: facts.categoryId, serviceId: facts.serviceId, legacyServiceId: facts.legacyServiceId, offerId: facts.offerId, vendorId: facts.vendorId, packageId: input.packageId ?? null, serviceKind: facts.kind,
    cityId: input.cityId ?? null, countryCode: input.countryCode ?? null, visitorCityId: input.visitorCityId ?? null, bookingDate: input.date ?? null, bookingTime: input.time ?? null, quantity: input.quantity ?? 1, intent: input.intent ?? 'VIEW', actorIsAdmin: input.actorIsAdmin, waiveLeadTime: input.waiveLeadTime,
    serviceCities: facts.serviceCities, vendorActive: facts.vendorActive, offerEnabled: facts.offerEnabled, serviceReady: facts.serviceReady,
  };
}
void prisma;
