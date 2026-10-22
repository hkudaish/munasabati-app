import 'server-only';
import { resolve } from '@/lib/availability/resolver';
import { evaluatePackage, PackageComponent } from '@/lib/availability/package';
import type { Context, Decision, Snapshot } from '@/lib/availability/types';

/** A decision in the smallest form a listing needs: status, visible, bookable, capacity, the notice (only when there is one). */
export interface CompactDecision { s: string; v: boolean; b: boolean; c: string; m?: { ar: string; en: string }; r?: string[]; l?: string; e?: string }
export function compact(d: Decision): CompactDecision {
  const notice = d.effectiveStatus !== 'ACTIVE' || d.reasonCodes.length > 0 || !d.canBook;
  return { s: d.effectiveStatus, v: d.isVisible, b: d.canBook, c: d.capacityStatus, ...(notice && (d.message.ar || d.message.en) ? { m: d.message } : {}), ...(d.reasonCodes.length ? { r: d.reasonCodes } : {}), ...(d.launchDate ? { l: d.launchDate } : {}), ...(d.expectedResumeDate ? { e: d.expectedResumeDate } : {}) };
}
export interface ListedService { id: string; sourceId: string | null; categoryId: string | null; vendorId: string | null; kind: Context['serviceKind']; cities: string[]; vendorActive: boolean; ready: boolean }
const serviceCtx = (s: ListedService, cityId: string | null): Context => ({ entityType: 'SERVICE', moduleId: 'commerce', categoryId: s.categoryId, serviceId: s.id, legacyServiceId: s.sourceId, vendorId: s.vendorId, serviceKind: s.kind, cityId, serviceCities: s.cities, vendorActive: s.vendorActive, serviceReady: s.ready, intent: 'VIEW' });

/** Per service: the decision in each of its cities (digital services: one decision for the whole country). */
export function serviceAvailability(snapshot: Snapshot, s: ListedService) {
  const byCity: Record<string, CompactDecision> = {};
  for (const cityId of s.cities) if (snapshot.geo.cities.some(c => c.id === cityId)) byCity[cityId] = compact(resolve(snapshot, serviceCtx(s, cityId)));
  return { byCity, national: s.kind === 'DIGITAL' ? compact(resolve(snapshot, serviceCtx(s, null))) : undefined };
}
export function offerAvailability(snapshot: Snapshot, s: ListedService, offerId: string, offerEnabled = true) {
  const byCity: Record<string, CompactDecision> = {};
  for (const cityId of s.cities) if (snapshot.geo.cities.some(c => c.id === cityId)) byCity[cityId] = compact(resolve(snapshot, { ...serviceCtx(s, cityId), entityType: 'OFFER', offerId, offerEnabled }));
  return byCity;
}
/** Per package and city: bookable when every required component can be fulfilled; unavailable optional components are reported, not blocking. */
export function packageAvailability(snapshot: Snapshot, packageId: string, components: { key: string; optional: boolean; service: ListedService; offerId: string; substitutes: { id: string; service: ListedService }[] }[], cityIds: string[]) {
  const byCity: Record<string, { b: boolean; blocking: string[]; omitted: string[]; m?: { ar: string; en: string }; s: string }> = {};
  for (const cityId of cityIds) {
    const parts: PackageComponent[] = components.map(c => ({ key: c.key, optional: c.optional, primary: { ...serviceCtx(c.service, cityId), entityType: 'OFFER', offerId: c.offerId, packageId }, substitutes: c.substitutes.map(sub => ({ id: sub.id, context: { ...serviceCtx(sub.service, cityId), entityType: 'OFFER', offerId: sub.id, packageId } })) }));
    const result = evaluatePackage(snapshot, { ...serviceCtx(components[0].service, cityId), entityType: 'PACKAGE', serviceId: null, categoryId: null, vendorId: null, offerId: null, packageId }, parts);
    byCity[cityId] = { b: result.bookable, s: result.packageDecision.effectiveStatus, blocking: result.blocking, omitted: result.omitted, ...(result.packageDecision.message.ar ? { m: result.packageDecision.message } : {}) };
  }
  return byCity;
}
