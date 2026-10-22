import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from '@/lib/server/http';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshot, onAvailabilityChange } from './loader';
import { serviceContext, serviceRows } from './matrix';

/* Public platform statistics. Every figure is computed from verified records; nothing is typed in by hand.
   History is counted from completed orders and bookings, so switching a service off today never erases what was delivered.
   "Services offered" and "cities covered" are CURRENT figures, judged by the same availability engine that gates booking. */

export interface StatDefinition { id: string; labelAr: string; labelEn: string; descriptionAr: string; descriptionEn: string; kind: 'history' | 'current'; hideWhenZero: boolean; icon: string }
export const STAT_DEFINITIONS: StatDefinition[] = [
  { id: 'events', labelAr: 'فعالية نُظّمت واكتملت', labelEn: 'Events organized & completed', descriptionAr: 'فعاليات فريدة اكتملت خدماتها (عميل + يوم الفعالية + المدينة)، لا عدد الحجوزات.', descriptionEn: 'Unique events whose services were completed (customer + event day + city), not the number of bookings.', kind: 'history', hideWhenZero: true, icon: 'calendar' },
  { id: 'customers', labelAr: 'عميل حظي بخدماتنا', labelEn: 'Customers served', descriptionAr: 'عملاء مختلفون أُنجزت لهم خدمة واحدة على الأقل.', descriptionEn: 'Distinct customers who received at least one completed service.', kind: 'history', hideWhenZero: true, icon: 'users' },
  { id: 'vendors', labelAr: 'مورد وشريك موثق', labelEn: 'Verified vendors & partners', descriptionAr: 'موردون موثقون وحساباتهم نشطة حالياً.', descriptionEn: 'Verified vendors whose accounts are currently active.', kind: 'current', hideWhenZero: false, icon: 'store' },
  { id: 'services', labelAr: 'خدمة متاحة', labelEn: 'Services offered', descriptionAr: 'خدمات مختلفة يمكن حجزها الآن في مدينة واحدة على الأقل (لا يُعدّ كل عرض خدمة مستقلة).', descriptionEn: 'Distinct services that can be booked right now in at least one city (each vendor offer is not counted separately).', kind: 'current', hideWhenZero: false, icon: 'sparkles' },
  { id: 'cities', labelAr: 'مدينة مغطاة', labelEn: 'Cities covered', descriptionAr: 'مدن فيها خدمة واحدة على الأقل قابلة للحجز الآن؛ المدن «قريباً» أو المعطلة لا تُحتسب.', descriptionEn: 'Cities where at least one service can be booked now; coming-soon and disabled cities are not counted.', kind: 'current', hideWhenZero: false, icon: 'map' },
  { id: 'bookings', labelAr: 'حجز مكتمل', labelEn: 'Completed bookings', descriptionAr: 'حجوزات أُنجز تنفيذها فعلاً؛ تستثني الملغاة والفاشلة والمتروكة والتجريبية.', descriptionEn: 'Bookings that were actually fulfilled; cancelled, failed, abandoned and test bookings are excluded.', kind: 'history', hideWhenZero: true, icon: 'check' },
];
export interface CardConfig { id: string; visible: boolean; order: number; labelAr: string; labelEn: string; hideWhenZero: boolean }
export interface StatsConfig { enabled: boolean; cards: CardConfig[]; scope: 'GLOBAL' | 'CITY'; cityId: string | null; period: 'ALL' | 'YEAR' | 'QUARTER' | 'MONTH'; version: number }
export const defaultCards = (): CardConfig[] => STAT_DEFINITIONS.map((d, i) => ({ id: d.id, visible: true, order: i, labelAr: d.labelAr, labelEn: d.labelEn, hideWhenZero: d.hideWhenZero }));

export async function readStatsConfig(): Promise<StatsConfig> {
  const row = await prisma.publicStatsConfig.findUnique({ where: { id: 'default' } });
  const base = defaultCards();
  const saved = Array.isArray(row?.cards) ? (row!.cards as any[]) : [];
  const cards = base.map(card => { const s = saved.find(x => x?.id === card.id); return s ? { ...card, visible: s.visible !== false, order: Number.isInteger(s.order) ? s.order : card.order, labelAr: typeof s.labelAr === 'string' && s.labelAr.trim() ? s.labelAr : card.labelAr, labelEn: typeof s.labelEn === 'string' && s.labelEn.trim() ? s.labelEn : card.labelEn, hideWhenZero: s.hideWhenZero ?? card.hideWhenZero } : card; });
  return { enabled: row?.enabled ?? true, cards: cards.sort((a, b) => a.order - b.order), scope: (row?.scope as 'GLOBAL' | 'CITY') ?? 'GLOBAL', cityId: row?.cityId ?? null, period: (row?.period as StatsConfig['period']) ?? 'ALL', version: row?.version ?? 0 };
}
export async function saveStatsConfig(actorId: string, input: any) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'بيانات غير صالحة');
  const known = new Set(STAT_DEFINITIONS.map(d => d.id));
  const cards = Array.isArray(input.cards) ? input.cards : [];
  if (cards.length > 20 || cards.some((c: any) => !known.has(c?.id))) throw new HttpError(400, 'بطاقة غير معروفة');
  const clean = cards.map((c: any, i: number) => {
    for (const key of ['labelAr', 'labelEn']) if (typeof c[key] !== 'string' || !c[key].trim() || c[key].length > 80) throw new HttpError(400, 'عنوان البطاقة مطلوب (حتى 80 حرفاً)');
    return { id: c.id, visible: c.visible !== false, order: Number.isInteger(c.order) ? c.order : i, labelAr: c.labelAr.trim(), labelEn: c.labelEn.trim(), hideWhenZero: c.hideWhenZero === true };
  });
  if (new Set(clean.map((c: any) => c.id)).size !== clean.length) throw new HttpError(400, 'بطاقة مكررة');
  const scope = input.scope === 'CITY' ? 'CITY' : 'GLOBAL', period = ['ALL', 'YEAR', 'QUARTER', 'MONTH'].includes(input.period) ? input.period : 'ALL';
  let cityId: string | null = null;
  if (scope === 'CITY') { cityId = typeof input.cityId === 'string' ? input.cityId : null; if (!cityId || !(await prisma.saudiCity.findUnique({ where: { id: cityId } }))) throw new HttpError(400, 'اختر مدينة صالحة للإحصاءات الخاصة بمدينة'); }
  const current = await prisma.publicStatsConfig.findUnique({ where: { id: 'default' } });
  if (current && input.version !== current.version) throw new HttpError(409, 'عُدّلت الإعدادات من مكان آخر؛ أعد التحميل');
  const data = { enabled: input.enabled !== false, cards: clean, scope, cityId, period, updatedAt: new Date() };
  if (current) await prisma.publicStatsConfig.update({ where: { id: 'default' }, data: { ...data, version: { increment: 1 } } });
  else await prisma.publicStatsConfig.create({ data: { id: 'default', ...data } });
  await prisma.availabilityAuditLog.create({ data: { entityType: 'PLATFORM', entityId: 'public-stats', action: 'STATS_CONFIG_SAVED', previousValue: current ? { enabled: current.enabled, cards: current.cards, scope: current.scope, period: current.period } : undefined, newValue: data as any, actorId } });
  invalidateStats();
  return readStatsConfig();
}

const sinceOf = (period: string) => { const days = period === 'YEAR' ? 365 : period === 'QUARTER' ? 92 : period === 'MONTH' ? 31 : 0; return days ? new Date(Date.now() - days * 86400000) : null; };

/** History: one row per completed booking item, from the current commerce flow and from the older orders, test accounts excluded. */
async function history(cityId: string | null, since: Date | null) {
  const city = cityId, from = since;
  const v2 = await prisma.$queryRaw<{ customer: string; eventKey: string; booking: boolean }[]>`
    SELECT o."customerId" AS customer,
           o."customerId" || '|' || COALESCE(i."body"->>'date', to_char(((i."body"->>'startAt')::timestamptz AT TIME ZONE 'Asia/Riyadh'), 'YYYY-MM-DD')) || '|' || COALESCE(i."body"->>'cityId', '') AS "eventKey",
           (b."id" IS NOT NULL) AS booking
    FROM "CommerceOrderItem" i
    JOIN "CommerceOrder" o ON o."id" = i."orderId"
    JOIN "User" u ON u."id" = o."customerId"
    LEFT JOIN "CommerceBooking" b ON b."orderItemId" = i."id"
    WHERE i."body"->>'status' IN ('COMPLETED', 'CLOSED')
      AND lower(COALESCE(u."email", '')) NOT LIKE '%.test' AND lower(COALESCE(u."email", '')) NOT LIKE '%@example.%'
      AND (${city}::text IS NULL OR i."body"->>'cityId' = ${city})
      AND (${from}::timestamptz IS NULL OR COALESCE(NULLIF(i."body"->>'completedAt', '')::timestamptz, NULLIF(i."body"->>'startAt', '')::timestamptz, o."createdAt") >= ${from})`;
  const legacy = await prisma.$queryRaw<{ customer: string; eventKey: string }[]>`
    SELECT COALESCE(o."customerId", o."customerPhone") AS customer, COALESCE(o."occasionId", COALESCE(o."customerId", o."customerPhone") || '|' || o."eventDate" || '|' || o."cityId") AS "eventKey"
    FROM "Suborder" s JOIN "MultiVendorOrder" o ON o."id" = s."orderId"
    WHERE (s."status" = 'COMPLETED' OR s."omsStatus" IN ('COMPLETED', 'CLOSED'))
      AND lower(COALESCE(o."customerEmail", '')) NOT LIKE '%.test' AND lower(COALESCE(o."customerEmail", '')) NOT LIKE '%@example.%'
      AND (${city}::text IS NULL OR o."cityId" = ${city})
      AND (${from}::timestamptz IS NULL OR o."updatedAt" >= ${from})`;
  const customers = new Set<string>(), events = new Set<string>();
  let bookings = 0;
  for (const r of v2) { customers.add(r.customer); if (r.eventKey) events.add(r.eventKey); if (r.booking) bookings++; } // a delivery with no event day (a digital product) serves a customer but is not an event
  for (const r of legacy) { customers.add(r.customer); events.add(r.eventKey); bookings++; }
  return { customers: customers.size, events: events.size, bookings };
}
/** Current coverage: services that can be booked now, and the cities where at least one can. Uses the booking engine's own decision. */
async function coverage(cityId: string | null) {
  const [snapshot, services] = await Promise.all([loadSnapshot(), serviceRows()]);
  const cities = snapshot.geo.cities.filter(c => !cityId || c.id === cityId);
  const bookable = new Set<string>(), served = new Set<string>();
  for (const s of services) {
    if (!s.ready) continue; // a service with no active offer cannot be bought
    if (s.kind === 'DIGITAL' && !cityId) { if (resolve(snapshot, serviceContext(s, null)).canBook) bookable.add(s.id); continue; }
    for (const city of cities) { if (s.cities.length && !s.cities.includes(city.id)) continue; if (resolve(snapshot, serviceContext(s, city.id)).canBook) { bookable.add(s.id); served.add(city.id); } }
  }
  return { services: bookable.size, cities: served.size };
}
export interface StatsResult { values: Record<string, number>; computedAt: string }
export async function computeStats(config: Pick<StatsConfig, 'scope' | 'cityId' | 'period'>): Promise<StatsResult> {
  const cityId = config.scope === 'CITY' ? config.cityId : null;
  const [h, c, vendors] = await Promise.all([
    history(cityId, sinceOf(config.period)), coverage(cityId),
    prisma.vendor.count({ where: { verified: true, status: 'ACTIVE', ...(cityId ? { cityId } : {}) } }),
  ]);
  return { values: { events: h.events, customers: h.customers, vendors, services: c.services, cities: c.cities, bookings: h.bookings }, computedAt: new Date().toISOString() };
}

// Aggregates are cached: a page view never runs the aggregation. Changes to availability or to the settings clear the cache at once.
const TTL_MS = process.env.NODE_ENV === 'production' ? 60_000 : 0;
let cached: { key: string; at: number; value: Promise<StatsResult> } | null = null;
export function invalidateStats() { cached = null; }
onAvailabilityChange(invalidateStats);
export async function publicStats() {
  const config = await readStatsConfig();
  if (!config.enabled) return { enabled: false, cards: [] as any[], scope: config.scope, period: config.period, computedAt: null as string | null };
  const key = `${config.version}:${config.scope}:${config.cityId}:${config.period}`;
  if (!TTL_MS || !cached || cached.key !== key || Date.now() - cached.at > TTL_MS) {
    const value = computeStats(config);
    cached = { key, at: Date.now(), value };
    value.catch(() => { if (cached?.value === value) cached = null; });
  }
  let result: StatsResult;
  try { result = await cached!.value; } catch (error) { console.warn(JSON.stringify({ event: 'stats.compute_failed', error: error instanceof Error ? error.message : String(error) })); return { enabled: false, cards: [], scope: config.scope, period: config.period, computedAt: null }; }
  const cards = config.cards.filter(c => c.visible).map(c => ({ id: c.id, labelAr: c.labelAr, labelEn: c.labelEn, value: result.values[c.id] ?? 0, icon: STAT_DEFINITIONS.find(d => d.id === c.id)?.icon ?? 'sparkles', hideWhenZero: c.hideWhenZero })).filter(c => !(c.hideWhenZero && c.value === 0));
  return { enabled: true, cards: cards.map(({ hideWhenZero, ...c }) => c), scope: config.scope, period: config.period, computedAt: result.computedAt };
}
