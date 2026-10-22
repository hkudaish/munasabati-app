import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError, text } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/auth';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshot } from './loader';
import { serviceContext, serviceRows } from './matrix';

const PREFERENCES = ['EMAIL', 'PHONE', 'WHATSAPP', 'NONE'];
/** A customer asks to be told when a service starts in a city. Only possible while the service is announced (coming soon) or not covered there yet. */
export async function registerInterest(user: any, input: Record<string, any>) {
  await rateLimit(`availability-interest:${user.id}`, 30);
  const serviceId = text(input.serviceId, 140, true), cityId = text(input.cityId, 100, true);
  if (input.consent !== true) throw new HttpError(400, 'يلزم موافقتك على التواصل لتسجيل الاهتمام');
  const contactPreference = typeof input.contactPreference === 'string' && PREFERENCES.includes(input.contactPreference) ? input.contactPreference : 'NONE';
  const [snapshot, services] = await Promise.all([loadSnapshot(), serviceRows()]);
  const service = services.find(s => s.id === serviceId);
  if (!service) throw new HttpError(404, 'الخدمة غير موجودة');
  if (!snapshot.geo.cities.some(c => c.id === cityId)) throw new HttpError(404, 'المدينة غير موجودة');
  const decision = resolve(snapshot, serviceContext(service, cityId));
  if (decision.canBook) throw new HttpError(409, 'الخدمة متاحة للحجز في هذه المدينة؛ لا حاجة لتسجيل الاهتمام');
  if (decision.effectiveStatus === 'DISABLED' && !decision.reasonCodes.includes('GEO_UNAVAILABLE') && !decision.reasonCodes.includes('GEO_RULE_DENIED') && !decision.reasonCodes.includes('SERVICE_CITY_NOT_COVERED')) throw new HttpError(409, 'التسجيل غير متاح لخدمة معطلة');
  const existing = await prisma.availabilityInterest.findUnique({ where: { serviceId_cityId_customerId: { serviceId, cityId, customerId: user.id } } });
  if (existing && existing.status !== 'CANCELLED') return { registered: true, already: true };
  const row = existing
    ? await prisma.availabilityInterest.update({ where: { id: existing.id }, data: { status: 'ACTIVE', contactPreference, consentAt: new Date(), notifiedAt: null } })
    : await prisma.availabilityInterest.create({ data: { serviceId, cityId, customerId: user.id, contactPreference, consentAt: new Date() } });
  return { registered: true, already: false, id: row.id };
}
export async function cancelInterest(user: any, input: Record<string, any>) {
  const serviceId = text(input.serviceId, 140, true), cityId = text(input.cityId, 100, true);
  await prisma.availabilityInterest.updateMany({ where: { serviceId, cityId, customerId: user.id, status: { not: 'CANCELLED' } }, data: { status: 'CANCELLED' } });
  return { cancelled: true };
}
export async function myInterests(user: any) {
  return prisma.availabilityInterest.findMany({ where: { customerId: user.id, status: { not: 'CANCELLED' } }, select: { serviceId: true, cityId: true, status: true, contactPreference: true, createdAt: true }, take: 200 });
}
/** Administrators: how many people wait for each service/city, and marking them as informed (the message itself is sent through the channels already in use). */
export async function interestSummary() {
  const rows = await prisma.availabilityInterest.groupBy({ by: ['serviceId', 'cityId', 'status'], _count: { _all: true }, orderBy: { _count: { serviceId: 'desc' } }, take: 200 });
  return rows.map(r => ({ serviceId: r.serviceId, cityId: r.cityId, status: r.status, count: r._count._all }));
}
export async function markInterestNotified(actorId: string, input: Record<string, any>) {
  const serviceId = text(input.serviceId, 140, true), cityId = text(input.cityId, 100, true);
  const changed = await prisma.availabilityInterest.updateMany({ where: { serviceId, cityId, status: 'ACTIVE' }, data: { status: 'NOTIFIED', notifiedAt: new Date() } });
  await prisma.availabilityAuditLog.create({ data: { entityType: 'SERVICE', entityId: serviceId, action: 'INTEREST_NOTIFIED', newValue: { cityId, count: changed.count }, actorId } });
  return { notified: changed.count };
}
