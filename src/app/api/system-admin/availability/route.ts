import { api, body, HttpError } from '@/lib/server/http';
import { requireAdmin, requireSystemAdmin } from '@/lib/server/auth';
import { prisma } from '@/lib/db';
import { FEATURE_CATALOG } from '@/lib/system/feature-catalog';
import { STATUSES, ENTITY_TYPES } from '@/lib/availability/types';
import { STATUS_MESSAGES } from '@/lib/availability/resolver';
import { TRANSITIONS } from '@/lib/availability/states';
import { createPolicy, deletePolicy, listPolicies, updatePolicy } from '@/lib/server/availability/policies';

export const dynamic = 'force-dynamic';
/** Reads are open to any administrator; changes need the system administrator (the Super Admin). */
export const GET = api(async request => {
  await requireAdmin();
  const q = new URL(request.url).searchParams;
  const policies = await listPolicies({ entityType: q.get('entityType') || undefined, entityId: q.get('entityId') || undefined });
  const [categories, vendors, services, cities, countries, regions] = await Promise.all([
    prisma.serviceCategory.findMany({ select: { id: true, nameAr: true }, orderBy: { nameAr: 'asc' } }),
    prisma.vendor.findMany({ select: { id: true, businessName: true }, orderBy: { businessName: 'asc' }, take: 500 }),
    prisma.$queryRaw<{ id: string; title: string }[]>`SELECT "id", "body"->>'titleAr' AS title FROM "CommerceService" ORDER BY "createdAt" LIMIT 500`,
    prisma.saudiCity.findMany({ select: { id: true, nameAr: true, regionId: true, countryCode: true }, orderBy: { nameAr: 'asc' } }),
    prisma.geoCountry.findMany({ select: { code: true, nameAr: true }, orderBy: { nameAr: 'asc' } }),
    prisma.geoRegion.findMany({ select: { id: true, nameAr: true, countryCode: true }, orderBy: { nameAr: 'asc' } }),
  ]);
  return {
    policies, statuses: STATUSES, entityTypes: ENTITY_TYPES, transitions: TRANSITIONS, defaultMessages: STATUS_MESSAGES,
    entities: { MODULE: FEATURE_CATALOG.map(f => ({ id: f.id, name: f.name })), CATEGORY: categories.map(c => ({ id: c.id, name: c.nameAr })), VENDOR: vendors.map(v => ({ id: v.id, name: v.businessName })), SERVICE: services.map(s => ({ id: s.id, name: s.title })), PLATFORM: [{ id: 'platform', name: 'المنصة كاملة' }] },
    places: { cities, countries, regions },
  };
}, { allowDisabledFeature: true });
export const POST = api(async request => { const user = await requireSystemAdmin(); return { policy: await createPolicy(user.id, await body(request, 200000)) }; }, { allowDisabledFeature: true });
export const PATCH = api(async request => {
  const user = await requireSystemAdmin(); const d = await body(request, 200000);
  if (typeof d.id !== 'string') throw new HttpError(400, 'المعرّف مطلوب');
  return { policy: await updatePolicy(user.id, d.id, d.policy, d.expectedVersion) };
}, { allowDisabledFeature: true });
export const DELETE = api(async request => { const user = await requireSystemAdmin(); const d = await body(request, 4000); if (typeof d.id !== 'string') throw new HttpError(400, 'المعرّف مطلوب'); return deletePolicy(user.id, d.id, d.reason); }, { allowDisabledFeature: true });
