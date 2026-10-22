import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { HttpError } from '@/lib/server/http';
import { lock } from '@/lib/server/booking/repository';
import { resolve, SEVERITY } from '@/lib/availability/resolver';
import { PolicyError, validateGeoRule, validatePolicy } from '@/lib/availability/states';
import type { Context, Decision, Intent, Policy, PolicyGeoRule, Snapshot, Status } from '@/lib/availability/types';
import { STATUSES } from '@/lib/availability/types';
import { FEATURE_CATALOG } from '@/lib/system/feature-catalog';
import { BuildInput, cappedScopes, chainOf, countByScope, offerFacts, toContext } from './facts';
import { invalidateAvailabilityCache, loadSnapshot, toPolicy } from './loader';
import { publicDecision } from './enforce';

type Tx = Prisma.TransactionClient;
const MODULES = FEATURE_CATALOG.map(f => f.id as string);

interface ServiceRow { id: string; title: string; categoryId: string | null; vendorId: string | null; vendorName: string | null; kind: Context['serviceKind']; cities: string[]; sourceId: string | null; vendorActive: boolean; ready: boolean }
/** Every published service with the facts the resolver needs, in three queries. */
export async function serviceRows(db: Tx | typeof prisma = prisma): Promise<ServiceRow[]> {
  const [services, vendors, offers] = await Promise.all([
    db.$queryRaw<any[]>`SELECT "id", "sourceId", "ownerId", "vendorId", "body" FROM "CommerceService" WHERE "body"->>'published' = 'true' AND "body"->>'approved' = 'true' ORDER BY "createdAt"`,
    db.vendor.findMany({ select: { id: true, userId: true, businessName: true, status: true, user: { select: { isActive: true } } } }),
    db.$queryRaw<{ serviceId: string; n: number }[]>`SELECT "serviceId", count(*)::int AS n FROM "CommerceOffer" WHERE "body"->>'enabled' = 'true' GROUP BY "serviceId"`,
  ]);
  const byId = new Map(vendors.map(v => [v.id, v])), byUser = new Map(vendors.filter(v => v.userId).map(v => [v.userId as string, v])), ready = new Map(offers.map(o => [o.serviceId, o.n]));
  return services.map(s => {
    const vendor = (s.vendorId ? byId.get(s.vendorId) : undefined) ?? (s.ownerId ? byUser.get(s.ownerId) : undefined) ?? (Array.isArray(s.body?.managerIds) ? s.body.managerIds.map((id: string) => byUser.get(id)).find(Boolean) : undefined);
    return { id: s.id, title: s.body?.titleAr ?? s.id, categoryId: s.body?.categoryId ?? null, vendorId: vendor?.id ?? null, vendorName: vendor?.businessName ?? null, kind: s.body?.kind ?? 'BOOKABLE', cities: Array.isArray(s.body?.cities) ? s.body.cities : [], sourceId: s.sourceId, vendorActive: !vendor || (vendor.status === 'ACTIVE' && vendor.user?.isActive !== false), ready: (ready.get(s.id) ?? 0) > 0 };
  });
}
export const serviceContext = (s: ServiceRow, cityId: string | null, over: Partial<Context> = {}): Context => ({ entityType: 'SERVICE', moduleId: 'commerce', categoryId: s.categoryId, serviceId: s.id, legacyServiceId: s.sourceId, vendorId: s.vendorId, serviceKind: s.kind, cityId, serviceCities: s.cities, vendorActive: s.vendorActive, serviceReady: s.ready, intent: 'VIEW', ...over });

/** Services × cities with the effective decision in every cell. */
export async function matrix(filter: { categoryId?: string; vendorId?: string; status?: string; cityIds?: string[]; countryCode?: string; regionId?: string; search?: string }) {
  const [snapshot, services] = await Promise.all([loadSnapshot(), serviceRows()]);
  const cities = snapshot.geo.cities.filter(c => (!filter.cityIds?.length || filter.cityIds.includes(c.id)) && (!filter.countryCode || c.countryCode === filter.countryCode) && (!filter.regionId || c.regionId === filter.regionId)).slice(0, 40);
  const rows = services.filter(s => (!filter.categoryId || s.categoryId === filter.categoryId) && (!filter.vendorId || s.vendorId === filter.vendorId) && (!filter.search || s.title.includes(filter.search))).slice(0, 300).map(s => {
    const cells: Record<string, { s: Status; b: boolean; v: boolean; c: string; m: string }> = {};
    for (const city of cities) { const d = resolve(snapshot, serviceContext(s, city.id)); cells[city.id] = { s: d.effectiveStatus, b: d.canBook, v: d.isVisible, c: d.capacityStatus, m: d.message.ar }; }
    return { serviceId: s.id, title: s.title, categoryId: s.categoryId, vendorId: s.vendorId, vendorName: s.vendorName, cells };
  }).filter(r => !filter.status || Object.values(r.cells).some(c => c.s === filter.status));
  return { cities: cities.map(c => ({ id: c.id, nameAr: c.nameAr, regionId: c.regionId ?? null, countryCode: c.countryCode })), rows, categories: (snapshot.geo.categories ?? []).map(c => ({ id: c.id, nameAr: c.nameAr })) };
}

export interface PreviewInput extends Partial<BuildInput> { serviceId?: string; vendorId?: string; offerId?: string; categoryId?: string; hypothetical?: unknown[] }
/** "View as customer": the decision for any place, service, vendor, date and quantity, with the reasoning, optionally with unsaved policies applied. */
export async function previewDecision(input: PreviewInput & { intent?: Intent }) {
  const snapshot = await loadSnapshot();
  const hypothetical: Policy[] = (input.hypothetical ?? []).slice(0, 20).map((p, i) => { try { return { ...validatePolicy(p, MODULES), id: 'hypothetical-' + i, version: 0 } as Policy; } catch (e) { throw new HttpError(400, e instanceof PolicyError ? e.message : 'سياسة المعاينة غير صالحة'); } });
  const merged: Snapshot = { ...snapshot, policies: [...snapshot.policies, ...hypothetical] };
  let ctx: Context;
  if (input.offerId) {
    const facts = await offerFacts(prisma, input.offerId);
    if (!facts) throw new HttpError(404, 'العرض غير موجود');
    ctx = toContext(facts, { offeringId: input.offerId, cityId: input.cityId, countryCode: input.countryCode, date: input.date, time: input.time, quantity: input.quantity, intent: input.intent ?? 'BOOK' });
    if (input.date) { const chain = chainOf(facts); const scopes = cappedScopes(merged, chain); if (scopes.length) ctx.usedByScope = await countByScope(prisma, scopes, input.date, facts, ctx); }
  } else if (input.serviceId) {
    const service = (await serviceRows()).find(s => s.id === input.serviceId);
    if (!service) throw new HttpError(404, 'الخدمة غير موجودة أو غير منشورة');
    ctx = serviceContext(service, input.cityId ?? null, { countryCode: input.countryCode ?? null, bookingDate: input.date ?? null, bookingTime: input.time ?? null, quantity: input.quantity ?? 1, intent: input.intent ?? 'BOOK', ...(input.vendorId ? { vendorId: input.vendorId } : {}) });
  } else throw new HttpError(400, 'اختر خدمة أو عرضاً للمعاينة');
  const decision = resolve(merged, ctx, new Date());
  return { decision, public: publicDecision(decision), context: { cityId: ctx.cityId, serviceId: ctx.serviceId, offerId: ctx.offerId, vendorId: ctx.vendorId, categoryId: ctx.categoryId, date: ctx.bookingDate, quantity: ctx.quantity } };
}

// ---- bulk changes ---------------------------------------------------------------------------------------------------
export interface BulkInput { targets: { entityType: 'SERVICE' | 'CATEGORY' | 'VENDOR' | 'OFFER'; entityId: string }[]; cityIds: string[]; change: { geographicEffect: 'ALLOW' | 'DENY' | 'INHERIT' | 'REMOVE'; statusOverride?: Status | null; restrictionConfig?: unknown }; reason?: string; dryRun?: boolean }
const MAX_CELLS = 500;
function parseBulk(input: any): BulkInput {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'طلب غير صالح');
  const { targets, cityIds, change } = input;
  if (!Array.isArray(targets) || !targets.length || !Array.isArray(cityIds) || !cityIds.length) throw new HttpError(400, 'اختر خدمات ومدناً');
  if (targets.length * cityIds.length > MAX_CELLS) throw new HttpError(400, `الحد الأقصى ${MAX_CELLS} خلية في العملية الواحدة`);
  for (const t of targets) if (!['SERVICE', 'CATEGORY', 'VENDOR', 'OFFER'].includes(t?.entityType) || typeof t?.entityId !== 'string') throw new HttpError(400, 'هدف غير صالح');
  if (cityIds.some((c: unknown) => typeof c !== 'string')) throw new HttpError(400, 'مدينة غير صالحة');
  if (!change || !['ALLOW', 'DENY', 'INHERIT', 'REMOVE'].includes(change.geographicEffect)) throw new HttpError(400, 'نوع التغيير غير صالح');
  if (change.statusOverride != null && !STATUSES.includes(change.statusOverride)) throw new HttpError(400, 'حالة غير صالحة');
  if (change.geographicEffect !== 'REMOVE') { try { validateGeoRule({ cityId: cityIds[0], geographicEffect: change.geographicEffect, statusOverride: change.statusOverride, restrictionConfig: change.restrictionConfig }); } catch (e) { throw new HttpError(400, e instanceof PolicyError ? e.message : 'تغيير غير صالح'); } }
  return { targets, cityIds: Array.from(new Set(cityIds)) as string[], change, reason: typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : undefined, dryRun: input.dryRun !== false };
}
const ruleFor = (cityId: string, c: BulkInput['change']): PolicyGeoRule => ({ cityId, geographicEffect: c.geographicEffect as PolicyGeoRule['geographicEffect'], statusOverride: c.statusOverride ?? null, restrictionConfig: (c.restrictionConfig ?? {}) as PolicyGeoRule['restrictionConfig'] });
/** The policy a bulk change edits: the open-ended, priority-0 policy of the entity (created, still ACTIVE, when none exists). */
const baseOf = (snapshot: Snapshot, t: { entityType: string; entityId: string }) => snapshot.policies.find(p => p.entityType === t.entityType && p.entityId === t.entityId && !p.effectiveFrom && !p.effectiveUntil && p.priority === 0);
function applyInMemory(snapshot: Snapshot, input: BulkInput): Snapshot {
  const policies = snapshot.policies.map(p => ({ ...p, geoRules: [...p.geoRules] }));
  for (const t of input.targets) {
    let base = policies.find(p => p.entityType === t.entityType && p.entityId === t.entityId && !p.effectiveFrom && !p.effectiveUntil && p.priority === 0);
    if (!base) { base = { id: `new-${t.entityType}-${t.entityId}`, entityType: t.entityType, entityId: t.entityId, configuredStatus: 'ACTIVE', visibilityMode: 'AUTO', bookingMode: 'ENABLED', priority: 0, restrictionConfig: {}, suspensionPolicy: {}, publicMessage: {}, autoActivate: false, version: 0, geoRules: [], schedules: [] }; policies.push(base); }
    base.geoRules = base.geoRules.filter(r => !r.cityId || !input.cityIds.includes(r.cityId));
    if (input.change.geographicEffect !== 'REMOVE') base.geoRules.push(...input.cityIds.map(c => ruleFor(c, input.change)));
  }
  return { ...snapshot, policies };
}
export async function bulkPreview(raw: unknown) {
  const input = parseBulk(raw);
  const [snapshot, services] = await Promise.all([loadSnapshot(), serviceRows()]);
  const after = applyInMemory(snapshot, input);
  const cityName = new Map(snapshot.geo.cities.map(c => [c.id, c.nameAr]));
  for (const id of input.cityIds) if (!cityName.has(id)) throw new HttpError(400, 'مدينة غير موجودة: ' + id);
  const affected: any[] = [], conflicts: any[] = [];
  const wanted: Status = input.change.geographicEffect === 'DENY' ? 'DISABLED' : input.change.geographicEffect === 'ALLOW' ? input.change.statusOverride ?? 'ACTIVE' : 'ACTIVE';
  for (const t of input.targets) {
    const matching = t.entityType === 'SERVICE' ? services.filter(s => s.id === t.entityId) : t.entityType === 'CATEGORY' ? services.filter(s => s.categoryId === t.entityId) : t.entityType === 'VENDOR' ? services.filter(s => s.vendorId === t.entityId) : services;
    if (!matching.length) conflicts.push({ target: t, code: 'NO_SERVICES', message: 'لا توجد خدمات منشورة لهذا الهدف' });
    const others = snapshot.policies.filter(p => p.entityType === t.entityType && p.entityId === t.entityId && p !== baseOf(snapshot, t));
    if (others.length) conflicts.push({ target: t, code: 'OTHER_POLICIES_EXIST', message: `يوجد ${others.length} سياسة أخرى لنفس الكيان (بأولوية أو فترة مختلفة) قد تتقدم على هذا التغيير` });
    for (const s of matching.slice(0, 200)) for (const cityId of input.cityIds) {
      const b = resolve(snapshot, serviceContext(s, cityId)), a = resolve(after, serviceContext(s, cityId));
      if (b.effectiveStatus !== a.effectiveStatus || b.canBook !== a.canBook || b.isVisible !== a.isVisible) affected.push({ serviceId: s.id, title: s.title, cityId, city: cityName.get(cityId), before: { status: b.effectiveStatus, canBook: b.canBook }, after: { status: a.effectiveStatus, canBook: a.canBook } });
      if (input.change.geographicEffect !== 'REMOVE' && SEVERITY[a.effectiveStatus] > SEVERITY[wanted]) conflicts.push({ target: t, serviceId: s.id, cityId, code: 'PARENT_PROHIBITS', message: `${s.title} في ${cityName.get(cityId)}: يبقى ${a.effectiveStatus} بسبب قيد أعلى في التسلسل` });
    }
  }
  return { dryRun: true, affected: affected.slice(0, 500), affectedCount: affected.length, conflicts: conflicts.slice(0, 200), targets: input.targets.length, cities: input.cityIds.length };
}
export async function bulkApply(actorId: string, raw: unknown) {
  const input = parseBulk({ ...(raw as object), dryRun: false });
  if (!input.reason) throw new HttpError(400, 'اكتب سبب التغيير الجماعي');
  const preview = await bulkPreview({ ...(raw as object), dryRun: true });
  const result = await prisma.$transaction(async tx => {
    const touched: string[] = [];
    for (const t of input.targets) {
      await lock(tx, `availability-policy:${t.entityType}:${t.entityId}`);
      if (t.entityType === 'SERVICE' && !(await tx.$queryRaw<any[]>`SELECT 1 FROM "CommerceService" WHERE "id" = ${t.entityId}`).length) throw new HttpError(404, 'خدمة غير موجودة: ' + t.entityId);
      if (t.entityType === 'CATEGORY' && !(await tx.serviceCategory.findUnique({ where: { id: t.entityId } }))) throw new HttpError(404, 'تصنيف غير موجود: ' + t.entityId);
      if (t.entityType === 'VENDOR' && !(await tx.vendor.findUnique({ where: { id: t.entityId } }))) throw new HttpError(404, 'مورد غير موجود: ' + t.entityId);
      if (t.entityType === 'OFFER' && !(await tx.$queryRaw<any[]>`SELECT 1 FROM "CommerceOffer" WHERE "id" = ${t.entityId}`).length) throw new HttpError(404, 'عرض غير موجود: ' + t.entityId);
      let base = await tx.availabilityPolicy.findFirst({ where: { entityType: t.entityType, entityId: t.entityId, effectiveFrom: null, effectiveUntil: null, priority: 0 }, include: { geoRules: true, schedules: true } });
      const before = base ? toPolicy(base) : null;
      if (!base) base = await tx.availabilityPolicy.create({ data: { entityType: t.entityType, entityId: t.entityId, createdBy: actorId, updatedBy: actorId }, include: { geoRules: true, schedules: true } });
      const cityRows = await tx.saudiCity.findMany({ where: { id: { in: input.cityIds } }, select: { id: true, regionId: true, countryCode: true } });
      if (cityRows.length !== input.cityIds.length) throw new HttpError(400, 'مدينة غير موجودة');
      await tx.availabilityGeoRule.deleteMany({ where: { policyId: base.id, cityId: { in: input.cityIds } } });
      if (input.change.geographicEffect !== 'REMOVE') await tx.availabilityGeoRule.createMany({ data: input.cityIds.map(cityId => ({ policyId: base!.id, cityId, geographicEffect: input.change.geographicEffect, statusOverride: input.change.statusOverride ?? null, restrictionConfig: (input.change.restrictionConfig ?? {}) as Prisma.InputJsonValue })) });
      await tx.availabilityPolicy.update({ where: { id: base.id }, data: { version: { increment: 1 }, updatedBy: actorId, updatedAt: new Date() } });
      const full = await tx.availabilityPolicy.findUniqueOrThrow({ where: { id: base.id }, include: { geoRules: true, schedules: true } });
      await tx.availabilityAuditLog.create({ data: { policyId: base.id, entityType: t.entityType, entityId: t.entityId, action: 'BULK_APPLIED', previousValue: before ? (before as unknown as Prisma.InputJsonValue) : Prisma.JsonNull, newValue: toPolicy(full) as unknown as Prisma.InputJsonValue, actorId, reason: input.reason ?? null } });
      touched.push(base.id);
    }
    return touched;
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  invalidateAvailabilityCache();
  return { applied: true, policies: result.length, affectedCount: preview.affectedCount, conflicts: preview.conflicts };
}
