import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { HttpError } from '@/lib/server/http';
import { lock } from '@/lib/server/booking/repository';
import { FEATURE_CATALOG } from '@/lib/system/feature-catalog';
import { canTransition, PolicyError, validatePolicy } from '@/lib/availability/states';
import type { Policy } from '@/lib/availability/types';
import { invalidateAvailabilityCache, toPolicy } from './loader';

type Tx = Prisma.TransactionClient;
const MODULES = FEATURE_CATALOG.map(f => f.id as string);
const checked = <T>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof PolicyError) throw new HttpError(400, e.message); throw e; } };
const json = (v: unknown) => v as Prisma.InputJsonValue;
const date = (v?: string | null) => (v ? new Date(v) : null);

async function entityExists(tx: Tx, type: string, id: string) {
  if (type === 'PLATFORM') return id === 'platform';
  if (type === 'MODULE') return MODULES.includes(id);
  if (type === 'CATEGORY') return !!(await tx.serviceCategory.findUnique({ where: { id }, select: { id: true } }));
  if (type === 'VENDOR') return !!(await tx.vendor.findUnique({ where: { id }, select: { id: true } }));
  const table = type === 'SERVICE' ? 'CommerceService' : type === 'OFFER' ? 'CommerceOffer' : 'CommercePackage';
  return ((await tx.$queryRawUnsafe<any[]>(`SELECT 1 AS ok FROM "${table}" WHERE "id" = $1`, id))).length > 0;
}
/** Country, region and city must exist and belong together; an inconsistent rule would silently never match. */
async function checkPlaces(tx: Tx, rules: { countryCode?: string | null; regionId?: string | null; cityId?: string | null }[]) {
  for (const rule of rules) {
    const city = rule.cityId ? await tx.saudiCity.findUnique({ where: { id: rule.cityId } }) : null;
    if (rule.cityId && !city) throw new HttpError(400, 'مدينة غير موجودة: ' + rule.cityId);
    const region = rule.regionId ? await tx.geoRegion.findUnique({ where: { id: rule.regionId } }) : null;
    if (rule.regionId && !region) throw new HttpError(400, 'منطقة غير موجودة: ' + rule.regionId);
    if (rule.countryCode && !(await tx.geoCountry.findUnique({ where: { code: rule.countryCode } }))) throw new HttpError(400, 'دولة غير موجودة: ' + rule.countryCode);
    if (city && region && city.regionId !== region.id) throw new HttpError(400, `المدينة ${city.nameAr} لا تتبع المنطقة ${region.nameAr}`);
    const country = rule.countryCode ?? null;
    if (region && country && region.countryCode !== country) throw new HttpError(400, `المنطقة ${region.nameAr} لا تتبع الدولة المحددة`);
    if (city && country && city.countryCode && city.countryCode !== country) throw new HttpError(400, `المدينة ${city.nameAr} لا تتبع الدولة المحددة`);
  }
}
/** Two policies of one entity may not be in force at the same time with the same priority: the winner would be arbitrary. */
async function checkOverlap(tx: Tx, input: { entityType: string; entityId: string; priority: number; effectiveFrom?: string | null; effectiveUntil?: string | null }, ignoreId?: string) {
  const others = await tx.availabilityPolicy.findMany({ where: { entityType: input.entityType, entityId: input.entityId, priority: input.priority, ...(ignoreId ? { id: { not: ignoreId } } : {}) } });
  const from = input.effectiveFrom ? Date.parse(input.effectiveFrom) : -Infinity, until = input.effectiveUntil ? Date.parse(input.effectiveUntil) : Infinity;
  for (const other of others) {
    const oFrom = other.effectiveFrom ? +other.effectiveFrom : -Infinity, oUntil = other.effectiveUntil ? +other.effectiveUntil : Infinity;
    if (from < oUntil && oFrom < until) throw new HttpError(409, 'توجد سياسة أخرى لنفس الكيان بنفس الأولوية تتداخل فترتها؛ غيّر الأولوية أو الفترة');
  }
}
const audit = (tx: Tx, actorId: string, action: string, policy: { id?: string; entityType?: string; entityId?: string }, previous: unknown, next: unknown, reason?: string | null) =>
  tx.availabilityAuditLog.create({ data: { policyId: policy.id, entityType: policy.entityType, entityId: policy.entityId, action, previousValue: previous === null || previous === undefined ? Prisma.JsonNull : json(previous), newValue: next === null || next === undefined ? Prisma.JsonNull : json(next), actorId, reason: reason ?? null } });
const withChildren = { geoRules: true, schedules: true } as const;
const snapshotOf = (row: any): Policy => toPolicy(row);

export async function listPolicies(filter: { entityType?: string; entityId?: string } = {}) {
  const rows = await prisma.availabilityPolicy.findMany({ where: { ...(filter.entityType ? { entityType: filter.entityType } : {}), ...(filter.entityId ? { entityId: filter.entityId } : {}) }, include: withChildren, orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }, { priority: 'desc' }], take: 1000 });
  return rows.map(snapshotOf);
}
const writeChildren = async (tx: Tx, policyId: string, v: ReturnType<typeof validatePolicy>) => {
  await tx.availabilityGeoRule.deleteMany({ where: { policyId } }); await tx.availabilitySchedule.deleteMany({ where: { policyId } });
  if (v.geoRules.length) await tx.availabilityGeoRule.createMany({ data: v.geoRules.map(r => ({ policyId, countryCode: r.countryCode ?? null, regionId: r.regionId ?? null, cityId: r.cityId ?? null, geographicEffect: r.geographicEffect, statusOverride: r.statusOverride ?? null, restrictionConfig: json(r.restrictionConfig ?? {}), effectiveFrom: date(r.effectiveFrom), effectiveUntil: date(r.effectiveUntil) })) });
  if (v.schedules.length) await tx.availabilitySchedule.createMany({ data: v.schedules.map(s => ({ policyId, kind: s.kind, timezone: s.timezone ?? 'Asia/Riyadh', startTime: s.startTime ?? null, endTime: s.endTime ?? null, dayOfWeek: s.dayOfWeek ?? null, startDate: s.startDate ?? null, endDate: s.endDate ?? null, maxBookings: s.maxBookings ?? null, isEnabled: s.isEnabled !== false })) });
};
const scalar = (v: ReturnType<typeof validatePolicy>) => ({ configuredStatus: v.configuredStatus, visibilityMode: v.visibilityMode, bookingMode: v.bookingMode, priority: v.priority, restrictionConfig: json(v.restrictionConfig), suspensionPolicy: json(v.suspensionPolicy), publicMessage: json(v.publicMessage), effectiveFrom: date(v.effectiveFrom), effectiveUntil: date(v.effectiveUntil), autoActivate: v.autoActivate, reason: v.reason ?? null });

export async function createPolicy(actorId: string, input: unknown) {
  const v = checked(() => validatePolicy(input, MODULES));
  const created = await prisma.$transaction(async tx => {
    await lock(tx, `availability-policy:${v.entityType}:${v.entityId}`);
    if (!(await entityExists(tx, v.entityType, v.entityId))) throw new HttpError(404, 'الكيان غير موجود');
    await checkPlaces(tx, v.geoRules); await checkOverlap(tx, v);
    const row = await tx.availabilityPolicy.create({ data: { entityType: v.entityType, entityId: v.entityId, ...scalar(v), createdBy: actorId, updatedBy: actorId } });
    await writeChildren(tx, row.id, v);
    const full = await tx.availabilityPolicy.findUniqueOrThrow({ where: { id: row.id }, include: withChildren });
    await audit(tx, actorId, 'POLICY_CREATED', row, null, snapshotOf(full), v.reason);
    return snapshotOf(full);
  }, { isolationLevel: 'Serializable', timeout: 20000 });
  invalidateAvailabilityCache();
  return created;
}
export async function updatePolicy(actorId: string, id: string, input: unknown, expectedVersion: unknown) {
  if (!Number.isInteger(expectedVersion)) throw new HttpError(400, 'رقم الإصدار مطلوب');
  const updated = await prisma.$transaction(async tx => {
    const before = await tx.availabilityPolicy.findUnique({ where: { id }, include: withChildren });
    if (!before) throw new HttpError(404, 'السياسة غير موجودة');
    await lock(tx, `availability-policy:${before.entityType}:${before.entityId}`);
    const v = checked(() => validatePolicy({ ...(input as object), entityType: before.entityType, entityId: before.entityId }, MODULES));
    if (!canTransition(before.configuredStatus as any, v.configuredStatus)) throw new HttpError(409, `لا يمكن الانتقال من ${before.configuredStatus} إلى ${v.configuredStatus} مباشرة؛ استعد الحالة أو أطلق الخدمة أولاً`);
    await checkPlaces(tx, v.geoRules); await checkOverlap(tx, v, id);
    const changed = await tx.availabilityPolicy.updateMany({ where: { id, version: expectedVersion as number }, data: { ...scalar(v), updatedBy: actorId, updatedAt: new Date(), version: { increment: 1 } } });
    if (!changed.count) throw new HttpError(409, 'عُدّلت السياسة من مكان آخر؛ أعد التحميل');
    await writeChildren(tx, id, v);
    const full = await tx.availabilityPolicy.findUniqueOrThrow({ where: { id }, include: withChildren });
    await audit(tx, actorId, before.configuredStatus !== v.configuredStatus ? 'STATUS_CHANGED' : 'POLICY_UPDATED', before, snapshotOf(before), snapshotOf(full), v.reason);
    return snapshotOf(full);
  }, { isolationLevel: 'Serializable', timeout: 20000 });
  invalidateAvailabilityCache();
  return updated;
}
export async function deletePolicy(actorId: string, id: string, reason: unknown) {
  if (typeof reason !== 'string' || !reason.trim()) throw new HttpError(400, 'اكتب سبب الحذف');
  await prisma.$transaction(async tx => {
    const before = await tx.availabilityPolicy.findUnique({ where: { id }, include: withChildren });
    if (!before) throw new HttpError(404, 'السياسة غير موجودة');
    await lock(tx, `availability-policy:${before.entityType}:${before.entityId}`);
    await tx.availabilityPolicy.delete({ where: { id } });
    await audit(tx, actorId, 'POLICY_DELETED', before, snapshotOf(before), null, reason.trim().slice(0, 500));
  }, { isolationLevel: 'Serializable', timeout: 20000 });
  invalidateAvailabilityCache();
  return { success: true };
}
export async function auditLogs(filter: { policyId?: string; entityType?: string; entityId?: string; page?: number }) {
  const where = { ...(filter.policyId ? { policyId: filter.policyId } : {}), ...(filter.entityType ? { entityType: filter.entityType } : {}), ...(filter.entityId ? { entityId: filter.entityId } : {}) };
  const [rows, total] = await Promise.all([prisma.availabilityAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50, skip: Math.max(0, filter.page ?? 0) * 50 }), prisma.availabilityAuditLog.count({ where })]);
  return { rows, total };
}
