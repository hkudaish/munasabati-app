import 'server-only';
import { prisma } from '@/lib/db';
import { readGeo, GeoDB } from '@/lib/server/geo/data';
import type { Policy, PolicyGeoRule, PolicySchedule, Snapshot, Status } from '@/lib/availability/types';

const iso = (d?: Date | null) => (d ? d.toISOString() : null);
export function toPolicy(row: any): Policy {
  return {
    id: row.id, entityType: row.entityType, entityId: row.entityId, configuredStatus: row.configuredStatus, visibilityMode: row.visibilityMode, bookingMode: row.bookingMode, priority: row.priority,
    restrictionConfig: row.restrictionConfig ?? {}, suspensionPolicy: row.suspensionPolicy ?? {}, publicMessage: row.publicMessage ?? {},
    effectiveFrom: iso(row.effectiveFrom), effectiveUntil: iso(row.effectiveUntil), autoActivate: row.autoActivate, reason: row.reason, version: row.version, updatedAt: iso(row.updatedAt) ?? undefined,
    geoRules: (row.geoRules ?? []).map((r: any): PolicyGeoRule => ({ id: r.id, countryCode: r.countryCode, regionId: r.regionId, cityId: r.cityId, geographicEffect: r.geographicEffect, statusOverride: (r.statusOverride as Status | null) ?? null, restrictionConfig: r.restrictionConfig ?? {}, effectiveFrom: iso(r.effectiveFrom), effectiveUntil: iso(r.effectiveUntil) })),
    schedules: (row.schedules ?? []).map((s: any): PolicySchedule => ({ id: s.id, kind: s.kind, timezone: s.timezone, startTime: s.startTime, endTime: s.endTime, dayOfWeek: s.dayOfWeek, startDate: s.startDate, endDate: s.endDate, maxBookings: s.maxBookings, isEnabled: s.isEnabled })),
  };
}
export async function loadPolicies(db: GeoDB = prisma): Promise<Policy[]> {
  return (await db.availabilityPolicy.findMany({ include: { geoRules: true, schedules: true }, orderBy: { id: 'asc' } })).map(toPolicy);
}
/** Everything the resolver reads, straight from the database (also inside a transaction). Enforcement always uses this. */
export async function loadSnapshot(db: GeoDB = prisma): Promise<Snapshot> {
  const [policies, geo] = await Promise.all([loadPolicies(db), readGeo(db)]);
  return { policies, geo };
}

// Listings may share one snapshot for a few seconds; enforcement (cart, order, confirmation) never uses this cache,
// so a change made by an administrator is honoured by the very next booking attempt.
const TTL_MS = process.env.NODE_ENV === 'production' ? 5000 : 0;
let cache: { at: number; value: Promise<Snapshot> } | null = null;
let policyCache: { at: number; value: Promise<Policy[]> } | null = null;
/** The policies only, for callers that already hold the geography (the catalog, which may be showing a coverage preview). */
export function loadPoliciesForListing(): Promise<Policy[]> {
  if (!TTL_MS) return loadPolicies();
  if (!policyCache || Date.now() - policyCache.at > TTL_MS) {
    const value = loadPolicies();
    policyCache = { at: Date.now(), value };
    value.catch(() => { if (policyCache?.value === value) policyCache = null; });
  }
  return policyCache.value;
}
export function loadSnapshotForListing(): Promise<Snapshot> {
  if (!TTL_MS) return loadSnapshot();
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const value = loadSnapshot();
    cache = { at: Date.now(), value };
    value.catch(() => { if (cache?.value === value) cache = null; });
  }
  return cache.value;
}
const hooks: (() => void)[] = [];
/** Other caches that depend on availability (the public statistics) register here to be cleared with it. */
export function onAvailabilityChange(fn: () => void) { hooks.push(fn); }
export function invalidateAvailabilityCache() { cache = null; policyCache = null; for (const fn of hooks) fn(); }
