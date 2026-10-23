import 'server-only';
import { prisma } from '@/lib/db';
import { admin } from '../booking/repository';

export type Severity = 'critical' | 'warning' | 'info';
export type ReminderKind = 'OVERDUE_START' | 'OVERDUE_COMPLETION' | 'DUE_SOON' | 'PROBLEM' | 'AWAITING_ACTION' | 'EXPIRING_SOON' | 'HOLD_EXPIRING' | 'CUSTOMER_NOTE' | 'FINANCE_REVIEW' | 'REVIEW_MODERATION' | 'VENDOR_APPROVAL' | 'FAILED_NOTIFICATIONS';
export interface Reminder { id: string; kind: ReminderKind; severity: Severity; titleAr: string; detailAr: string; dueAt: string | null; url: string; ref: string; vendorName?: string | null }

const HOUR = 3600000;
const when = (d: Date) => new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(d);
const ago = (hours: number) => (hours < 1 ? 'منذ أقل من ساعة' : hours < 48 ? `منذ ${Math.floor(hours)} ساعة` : `منذ ${Math.floor(hours / 24)} يوماً`);
const STATE_AR: Record<string, string> = { DISPUTED: 'نزاع مفتوح', CANCELLATION_REQUESTED: 'طلب إلغاء بانتظار القرار', RESCHEDULE_REQUESTED: 'طلب إعادة جدولة بانتظار القرار' };
const WAITING_AR: Record<string, string> = { AVAILABILITY_PENDING: 'بانتظار التحقق من التوفر', QUOTE_PENDING: 'بانتظار عرض السعر', APPROVAL_PENDING: 'بانتظار موافقة الجهة', READY_TO_CONFIRM: 'جاهز لتأكيد الحجز' };

interface Who { id: string; role: string }
/**
 * What needs attention now, for the people who run the service: administrators, supervisors and coordinators see everything,
 * a vendor sees only what they manage. Every item says what, when it is due and where to act, and is computed from live data
 * (so it disappears the moment the problem is dealt with).
 */
export async function remindersFor(user: Who, now = new Date()): Promise<Reminder[]> {
  const staff = admin(user), isVendor = user.role === 'VENDOR';
  if (!staff && !isVendor) return [];
  const mine = staff ? null : user.id;                   // vendors: only the items whose managers include them
  const items = await prisma.$queryRaw<any[]>`
    SELECT i."id", i."orderId", o."number", i."snapshot"->>'titleAr' AS "title", i."body"->>'status' AS "status", i."body"->>'startAt' AS "startAt", i."body"->>'endAt' AS "endAt", i."body"->>'expiresAt' AS "expiresAt",
      i."body"->>'notes' AS "notes", o."createdAt" AS "orderedAt", (SELECT u."name" FROM "User" u WHERE u."id" = i."body"->'managerIds'->>0) AS "vendorName"
    FROM "CommerceOrderItem" i JOIN "CommerceOrder" o ON o."id"=i."orderId"
    WHERE i."body"->>'status' NOT IN ('COMPLETED','CLOSED','REJECTED','CANCELLED','EXPIRED')
      AND (${mine}::text IS NULL OR i."body"->'managerIds' ? ${mine})
    ORDER BY o."createdAt" DESC LIMIT 600`;
  const out: Reminder[] = [];
  const add = (r: Omit<Reminder, 'id'>) => out.push({ ...r, id: `${r.kind}:${r.ref}` });
  for (const it of items) {
    const start = it.startAt ? new Date(it.startAt) : null, end = it.endAt ? new Date(it.endAt) : null, expires = it.expiresAt ? new Date(it.expiresAt) : null;
    const url = `/commerce/orders?id=${it.orderId}`, label = `${it.title ?? 'خدمة'} — طلب ${it.number}`, base = { url, ref: it.id, vendorName: it.vendorName };
    if (it.status === 'CONFIRMED' && start) {
      const hoursTo = (+start - +now) / HOUR;
      if (hoursTo < 0) add({ ...base, kind: 'OVERDUE_START', severity: 'critical', titleAr: 'حان موعد التنفيذ ولم يبدأ', detailAr: `${label}\nكان الموعد ${when(start)}`, dueAt: start.toISOString() });
      else if (hoursTo <= 48) add({ ...base, kind: 'DUE_SOON', severity: hoursTo <= 24 ? 'critical' : 'warning', titleAr: hoursTo <= 24 ? 'خدمة مستحقة خلال 24 ساعة' : 'خدمة مستحقة خلال 48 ساعة', detailAr: `${label}\nالموعد ${when(start)}`, dueAt: start.toISOString() });
    }
    if (it.status === 'IN_PROGRESS' && end && +end < +now) add({ ...base, kind: 'OVERDUE_COMPLETION', severity: 'critical', titleAr: 'تجاوز التنفيذ وقته المحدد دون إغلاق', detailAr: `${label}\nكان الانتهاء ${when(end)}`, dueAt: end.toISOString() });
    if (STATE_AR[it.status]) add({ ...base, kind: 'PROBLEM', severity: it.status === 'DISPUTED' ? 'critical' : 'warning', titleAr: STATE_AR[it.status], detailAr: label, dueAt: start?.toISOString() ?? null });
    if (WAITING_AR[it.status]) {
      const waited = (+now - +new Date(it.orderedAt)) / HOUR;
      if (expires && +expires - +now < 12 * HOUR && +expires > +now) add({ ...base, kind: 'EXPIRING_SOON', severity: 'critical', titleAr: 'طلب سينتهي خلال 12 ساعة دون رد', detailAr: `${label}\n${WAITING_AR[it.status]} — ينتهي ${when(expires)}`, dueAt: expires.toISOString() });
      else if (waited >= 12) add({ ...base, kind: 'AWAITING_ACTION', severity: waited >= 48 ? 'warning' : 'info', titleAr: 'إجراء مطلوب', detailAr: `${label}\n${WAITING_AR[it.status]} (${ago(waited)})`, dueAt: expires?.toISOString() ?? null });
    }
    // what the customer wrote down about the event, for services that are coming up
    if (it.notes && it.notes.trim() && start && +start > +now && +start - +now <= 7 * 24 * HOUR && ['CONFIRMED', 'READY_TO_CONFIRM', 'APPROVAL_PENDING'].includes(it.status)) add({ ...base, kind: 'CUSTOMER_NOTE', severity: 'info', titleAr: 'ملاحظات العميل على خدمة قريبة', detailAr: `${label}\n«${it.notes.trim().slice(0, 160)}»`, dueAt: start.toISOString() });
  }
  const holds = await prisma.$queryRaw<any[]>`
    SELECT b."id", b."body"->>'holdExpiresAt' AS "holdExpiresAt", o."number", o."id" AS "orderId", i."snapshot"->>'titleAr' AS "title"
    FROM "CommerceBooking" b JOIN "CommerceOrderItem" i ON i."id"=b."orderItemId" JOIN "CommerceOrder" o ON o."id"=i."orderId"
    WHERE b."status"='HELD' AND (b."body"->>'holdExpiresAt')::timestamptz BETWEEN ${now} AND ${new Date(+now + 2 * HOUR)} AND (${mine}::text IS NULL OR i."body"->'managerIds' ? ${mine})`;
  for (const h of holds) add({ kind: 'HOLD_EXPIRING', severity: 'critical', titleAr: 'حجز مؤقت سينتهي خلال ساعتين', detailAr: `${h.title ?? 'خدمة'} — طلب ${h.number}\nينتهي ${when(new Date(h.holdExpiresAt))}`, dueAt: new Date(h.holdExpiresAt).toISOString(), url: `/commerce/orders?id=${h.orderId}`, ref: h.id });
  if (staff) {
    const transfers = await prisma.$queryRaw<any[]>`SELECT t."id", t."orderId", t."kind", t."amount", t."createdAt", o."number" FROM "CommerceTransfer" t JOIN "CommerceOrder" o ON o."id"=t."orderId" WHERE t."status"='PENDING' AND t."createdAt" < ${new Date(+now - 24 * HOUR)} ORDER BY t."createdAt" LIMIT 50`;
    for (const t of transfers) add({ kind: 'FINANCE_REVIEW', severity: 'warning', titleAr: 'عملية مالية بانتظار مراجعة إداري آخر', detailAr: `طلب ${t.number} — ${(t.amount / 100).toLocaleString('ar-SA')} ر.س (${ago((+now - +new Date(t.createdAt)) / HOUR)})`, dueAt: null, url: `/commerce/orders?id=${t.orderId}`, ref: t.id });
    const reviews = (await prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "Review" WHERE "status"='pending' OR "replyStatus"='PENDING'`)[0].n;
    if (reviews) add({ kind: 'REVIEW_MODERATION', severity: 'info', titleAr: 'تقييمات وردود بانتظار الاعتماد', detailAr: `${reviews} عنصراً يحتاج قرار الإدارة قبل ظهوره للعملاء`, dueAt: null, url: '/admin?tab=reviews', ref: 'reviews' });
    const vendors = await prisma.$queryRaw<any[]>`SELECT "id","businessName" FROM "Vendor" WHERE "status"='UNDER_REVIEW' ORDER BY "createdAt" LIMIT 30`;
    for (const v of vendors) add({ kind: 'VENDOR_APPROVAL', severity: 'info', titleAr: 'مورد بانتظار الاعتماد', detailAr: v.businessName, dueAt: null, url: '/admin?tab=vendors', ref: v.id });
    const dead = (await prisma.$queryRaw<any[]>`SELECT ((SELECT COUNT(*) FROM "NotificationJob" WHERE "status"='DEAD') + (SELECT COUNT(*) FROM "DomainOutbox" WHERE "status"='DEAD'))::int AS n`)[0].n;
    if (dead) add({ kind: 'FAILED_NOTIFICATIONS', severity: 'warning', titleAr: 'إشعارات فشل إرسالها نهائياً', detailAr: `${dead} إشعاراً أو حدثاً استُنفدت محاولاته؛ راجع لوحة مؤشرات الحجز`, dueAt: null, url: '/admin/booking-insights', ref: 'dead' });
  }
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
}
export const counts = (list: Reminder[]) => ({ critical: list.filter(r => r.severity === 'critical').length, warning: list.filter(r => r.severity === 'warning').length, info: list.filter(r => r.severity === 'info').length, total: list.length });
