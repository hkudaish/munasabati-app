import 'server-only';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireUser, rateLimit } from '../auth';
import { HttpError, text, integer } from '../http';
import { requireFeature } from '../features';
import { atomic, lock, Tx, admin, requestRow } from '../booking/repository';
import { calendarAndConflict } from '../booking/requests';
import { quoteLines } from '../commerce-v2/cart';
import { checkNotice } from './notice';
import { notify } from './notify';
import { evaluatePackageNotice, PackageNoticeItem, describeMinutes, zonedInstant } from '@/lib/booking/advance-notice';
import {
  Actor, ExceptionAction, ExceptionConfigBody, ExceptionStatus, FINAL_STATUSES, defaultExceptionConfig, normalizeExceptionConfig, priorityFor, referenceNumber, responseTarget, transition, Priority,
} from '@/lib/exceptions/machine';
import { EXCEPTION_ACK_TEXT } from '@/lib/exceptions/texts';

export const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const FINALS_SQL = FINAL_STATUSES as readonly string[];
export interface RequestMeta { ip: string; userAgent: string; origin: string }

// ---- configuration and access ---------------------------------------------------------------------------------------------------
export async function loadConfig(db: Tx | typeof prisma): Promise<ExceptionConfigBody> {
  const row = (await (db as Tx).$queryRaw<any[]>`SELECT "body" FROM "ExceptionConfig" WHERE "key"='settings'`)[0];
  try { return normalizeExceptionConfig(row?.body); } catch { return defaultExceptionConfig(); }
}
export async function saveConfig(input: any) {
  const user = await requireUser(); if (!admin(user)) throw new HttpError(403, 'هذه الصلاحية مخصصة للإدارة');
  let body: ExceptionConfigBody; try { body = normalizeExceptionConfig({ ...(await loadConfig(prisma)), ...(input ?? {}) }); } catch (e: any) { throw new HttpError(400, e.message); }
  await prisma.$executeRaw`INSERT INTO "ExceptionConfig" ("key","body","version","updatedBy") VALUES ('settings',${JSON.stringify(body)}::jsonb,1,${user.id}) ON CONFLICT ("key") DO UPDATE SET "body"=EXCLUDED."body","version"="ExceptionConfig"."version"+1,"updatedBy"=EXCLUDED."updatedBy","updatedAt"=CURRENT_TIMESTAMP`;
  await prisma.systemAuditLog.create({ data: { actorId: user.id, action: 'EXCEPTION_CONFIG_SAVED', targetId: 'settings', details: body as any } });
  return body;
}
export async function staffOf(db: Tx | typeof prisma, userId: string): Promise<Set<string>> {
  const rows = await (db as Tx).$queryRaw<{ role: string }[]>`SELECT "role" FROM "StaffRole" WHERE "userId"=${userId}`;
  return new Set(rows.map(r => r.role));
}
export const components = (row: any): any[] => row.body?.components ?? [];
export const managersOf = (row: any): string[] => Array.from(new Set(components(row).flatMap((c: any) => c.managerIds ?? [])));
export function providerScope(user: any, row: any) {
  if (user.role !== 'VENDOR' || user.vendorProfile?.status !== 'ACTIVE') return [];
  return components(row).filter((c: any) => (c.providerIds ?? []).includes(user.id));
}
/** The roles this person plays on this request. Admins act as the platform, supervisor and coordinator; staff roles are narrower; a vendor is a provider only for its own services. */
export function actorsFor(user: any, row: any, staff: Set<string>): Actor[] {
  const out: Actor[] = [];
  if (row.customerId === user.id) out.push('customer');
  if (providerScope(user, row).length) out.push('provider');
  if (admin(user)) out.push('platform', 'supervisor', 'coordinator');
  else {
    if (staff.has('BOOKING_SUPERVISOR')) out.push('supervisor');
    if (staff.has('COORDINATOR') && row.assignedCoordinatorId === user.id) out.push('coordinator');
  }
  return out;
}
/** Who may open a request at all: its customer, its providers, the coordinator it is assigned to, supervisors, support and administrators. */
export const canSee = (user: any, row: any, staff: Set<string>) => row.customerId === user.id || admin(user) || staff.has('BOOKING_SUPERVISOR') || staff.has('SUPPORT') || (staff.has('COORDINATOR') && row.assignedCoordinatorId === user.id) || providerScope(user, row).length > 0;

export async function platformUserIds(tx: Tx): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "isActive"=true AND "role" IN ('ADMIN','SUPER_ADMIN') UNION SELECT s."userId" FROM "StaffRole" s JOIN "User" u ON u."id"=s."userId" WHERE s."role"='BOOKING_SUPERVISOR' AND u."isActive"=true`;
  return rows.map(r => r.id);
}

// ---- row helpers ----------------------------------------------------------------------------------------------------------------
export async function load(tx: Tx, id: string, forUpdate = true) {
  if (forUpdate) await lock(tx, 'exception:' + id);
  const row = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${id}`)[0];
  if (!row) throw new HttpError(404, 'الطلب غير موجود');
  return row;
}
export async function record(tx: Tx, row: any, actor: { id: string | null; role: string }, action: string, from: string | null, to: string | null, body: Record<string, unknown> = {}) {
  await tx.$executeRaw`INSERT INTO "ExceptionEvent" ("id","requestId","actorId","actorRole","action","fromStatus","toStatus","body","createdAt") VALUES (${randomUUID()},${row.id},${actor.id},${actor.role},${action},${from},${to},${JSON.stringify(body)}::jsonb,clock_timestamp())`;
}
export interface Patch { body?: Record<string, unknown>; assignedCoordinatorId?: string | null; slot?: { date: string; time: string; startAt: Date }; priority?: Priority }
/** Moves a request to a state (or keeps it) and refreshes its response deadline. The version always advances, so a stale screen cannot act. */
export async function move(tx: Tx, row: any, to: ExceptionStatus, cfg: ExceptionConfigBody, patch: Patch = {}) {
  const now = Date.now(), priority = (patch.priority ?? row.priority) as Priority, target = responseTarget(to, cfg, priority, now);
  const slot = patch.slot ?? { date: row.requestedDate, time: row.requestedTime, startAt: row.startAt };
  const assigned = patch.assignedCoordinatorId === undefined ? row.assignedCoordinatorId : patch.assignedCoordinatorId;
  const changed = await tx.$executeRaw`UPDATE "ExceptionRequest" SET "status"=${to},"stateEnteredAt"=CURRENT_TIMESTAMP,"dueAt"=${target.dueAt ? new Date(target.dueAt) : null},"body"="body" || ${JSON.stringify(patch.body ?? {})}::jsonb,"assignedCoordinatorId"=${assigned},"requestedDate"=${slot.date},"requestedTime"=${slot.time},"startAt"=${slot.startAt},"priority"=${priority},"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id} AND "version"=${row.version}`;
  if (changed !== 1) throw new HttpError(409, 'تغيّر الطلب؛ حدّث الصفحة');
  return load(tx, row.id, false);
}
export async function steps(tx: Tx, id: string, stage?: string) {
  return stage ? tx.$queryRaw<any[]>`SELECT * FROM "ExceptionApprovalStep" WHERE "requestId"=${id} AND "stage"=${stage} ORDER BY "createdAt"` : tx.$queryRaw<any[]>`SELECT * FROM "ExceptionApprovalStep" WHERE "requestId"=${id} ORDER BY "createdAt"`;
}
export async function addStep(tx: Tx, requestId: string, stage: string, approverType: string, offerId: string | null = null) {
  await tx.$executeRaw`INSERT INTO "ExceptionApprovalStep" ("id","requestId","stage","approverType","offerId") VALUES (${randomUUID()},${requestId},${stage},${approverType},${offerId}) ON CONFLICT DO NOTHING`;
}
export async function decide(tx: Tx, requestId: string, filter: { stage: string; approverType?: string; offerId?: string | null }, status: 'APPROVED' | 'REJECTED' | 'SUPERSEDED', by: string | null, note = '') {
  await tx.$executeRaw`UPDATE "ExceptionApprovalStep" SET "status"=${status},"decidedBy"=${by},"decidedAt"=CURRENT_TIMESTAMP,"note"=${note} WHERE "requestId"=${requestId} AND "stage"=${filter.stage} AND "status"='PENDING' AND (${filter.approverType ?? null}::text IS NULL OR "approverType"=${filter.approverType ?? null}) AND (${filter.offerId === undefined ? null : filter.offerId}::text IS NULL OR "offerId"=${filter.offerId === undefined ? null : filter.offerId})`;
}
export const pending = (list: any[]) => list.filter(s => s.status === 'PENDING');

export async function system(tx: Tx, row: any, action: ExceptionAction, cfg: ExceptionConfigBody, patch: Patch = {}, body: Record<string, unknown> = {}) {
  const to = transition(row.status, action, 'system');
  const next = await move(tx, row, to, cfg, patch);
  await record(tx, next, { id: null, role: 'system' }, action, row.status, to, body);
  return next;
}

// ---- creating a request ---------------------------------------------------------------------------------------------------------
const SELECTION_KEYS = ['offerId', 'packageId', 'cityId', 'date', 'time', 'quantity', 'durationMinutes', 'guestCount', 'notes', 'venue', 'options', 'fields', 'choices'];
function cleanSelection(input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'بيانات الحجز غير صالحة');
  const out: Record<string, any> = { id: randomUUID() };
  for (const k of SELECTION_KEYS) if (input[k] !== undefined) out[k] = input[k];
  if (JSON.stringify(out).length > 40000) throw new HttpError(400, 'بيانات الحجز كبيرة جداً');
  out.offerId = typeof out.offerId === 'string' && out.offerId ? text(out.offerId, 140) : null; out.packageId = typeof out.packageId === 'string' && out.packageId ? text(out.packageId, 140) : null;
  if (!!out.offerId === !!out.packageId) throw new HttpError(400, 'اختر عرضاً أو باقة');
  out.cityId = text(out.cityId, 100, true); out.date = text(out.date, 10, true); out.time = text(out.time, 5, true);
  out.quantity = Math.max(1, integer(out.quantity, 1000, 1)); out.guestCount = Math.max(1, integer(out.guestCount, 100000, 1));
  if (out.durationMinutes !== undefined) out.durationMinutes = integer(out.durationMinutes, 525600) || undefined;
  out.notes = text(out.notes, 2000); out.venue = text(out.venue, 1000); out.options = out.options ?? []; out.fields = out.fields ?? {}; out.choices = out.choices ?? {};
  return out;
}
const phoneOk = (v: string) => /^\+?\d{9,15}$/.test(v);
function cleanContact(input: any, user: any) {
  const c = input && typeof input === 'object' ? input : {};
  const name = text(c.name, 120) || user.name, phone = text(c.phone, 20) || user.phone || '', email = (text(c.email, 254) || user.email || '').toLowerCase();
  if (!name) throw new HttpError(400, 'أدخل اسم التواصل'); if (!phoneOk(phone)) throw new HttpError(400, 'أدخل رقم جوال صالح للتواصل');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
  return { name, phone, email };
}
export async function uniqueNumber(tx: Tx, prefix: 'EX' | 'RS') {
  for (let i = 0; i < 6; i++) { const n = referenceNumber(prefix, new Date(), randomInt); if (!(await tx.$queryRaw<any[]>`SELECT 1 FROM "ExceptionRequest" WHERE "number"=${n}`).length) return n; }
  throw new HttpError(503, 'تعذر إنشاء رقم مرجعي؛ أعد المحاولة');
}

/** A customer asks for an exception to the minimum notice, or to move a confirmed booking to a time that does not meet it. */
export async function createException(input: any, meta: RequestMeta) {
  const user = await requireUser(); await rateLimit('exception-create:' + user.id, 20); await requireFeature('booking_exceptions');
  const kind: 'NOTICE' | 'RESCHEDULE' = input.kind === 'RESCHEDULE' ? 'RESCHEDULE' : 'NOTICE';
  const reason = text(input.reason, 2000, true), urgencyDetails = text(input.urgencyDetails, 4000, true), customerNotes = text(input.customerNotes, 2000);
  if (input.acknowledge !== true) throw new HttpError(400, 'يلزم الإقرار بقبول دراسة إمكانية تغيير السعر');
  const contact = cleanContact(input.contact, user);
  return atomic(async tx => {
    const cfg = await loadConfig(tx);
    let selection: any, bookingRow: any = null, date: string, time: string, cityId: string, offerId: string, packageId: string | null = null, originalStartAt: Date | null = null;
    const comps: any[] = []; let priceInfo: any = null;
    if (kind === 'RESCHEDULE') {
      bookingRow = await requestRow(tx, text(input.bookingRequestId, 100, true), true);
      if (bookingRow.customerId !== user.id) throw new HttpError(404, 'الحجز غير موجود');
      if (bookingRow.status !== 'CONFIRMED') throw new HttpError(409, 'تعديل الموعد متاح للحجز المؤكد فقط');
      date = text(input.date, 10, true); time = text(input.time, 5, true);
      // the same request again is the same request; a different time while one is still open is refused
      const sameKey = sha([user.id, kind, bookingRow.id, date, time].join('|'));
      const same = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "dedupKey"=${sameKey} AND "status" <> ALL(${FINALS_SQL as string[]})`)[0];
      if (same) return { request: same, duplicate: true };
      if ((await tx.$queryRaw<any[]>`SELECT 1 FROM "ExceptionRequest" WHERE "bookingRequestId"=${bookingRow.id} AND "kind"='RESCHEDULE' AND "status" <> ALL(${FINALS_SQL as string[]}) LIMIT 1`).length) throw new HttpError(409, 'يوجد طلب تعديل موعد نشط لهذا الحجز'); cityId = bookingRow.cityId; offerId = bookingRow.offeringId; originalStartAt = bookingRow.startAt;
      let newStart: Date; try { newStart = zonedInstant(date, time); } catch (e: any) { throw new HttpError(400, e.message); }
      if (+newStart === +bookingRow.startAt) throw new HttpError(400, 'اختر موعداً مختلفاً عن الموعد الحالي');
      const check = await checkNotice(tx, { offerId, cityId, date, time, extra: [{ source: 'policy-snapshot', minutes: (bookingRow.body.policy?.calendar?.minNoticeHours ?? 0) * 60 }] });
      if (check.evaluation.ok) throw new HttpError(409, 'الموعد الجديد يستوفي مدة الحجز المسبق؛ استخدم طلب تعديل الموعد المعتاد');
      if (!check.evaluation.canRequestException) throw new HttpError(409, check.evaluation.cutoffPassed ? 'انتهى وقت قبول الحجوزات لهذه الخدمة' : 'هذه الخدمة لا تقبل طلبات الاستثناء');
      // everything except the notice must pass for the new time: coverage, schedule, capacity, overlaps
      await calendarAndConflict(tx, { ...bookingRow.body, date, time, startAt: newStart.toISOString(), endAt: new Date(+newStart + (+bookingRow.endAt - +bookingRow.startAt)).toISOString() }, bookingRow.id, false, null, { intent: 'MODIFY', customerId: user.id, noticeChecked: true });
      comps.push({ offerId, serviceId: bookingRow.body.commerceServiceId ?? bookingRow.body.serviceId ?? null, titleAr: bookingRow.body.titleAr, vendorId: check.vendorId, managerIds: bookingRow.body.managerIds ?? [], requiredMinutes: check.evaluation.requiredMinutes, remainingMinutes: Math.max(0, check.evaluation.remainingMinutes) });
      selection = { bookingRequestId: bookingRow.id, offerId, cityId, date, time };
      priceInfo = { currentSubtotal: bookingRow.body.price.subtotal, currentTotal: bookingRow.body.price.total, taxBps: bookingRow.body.policy.taxBps, commissionBps: bookingRow.body.policy.commissionBps };
    } else {
      selection = cleanSelection(input.selection); date = selection.date; time = selection.time; cityId = selection.cityId;
      // the pricing preview runs every rule except the notice (coverage, availability, schedule, capacity), so the request can only be about the notice
      const quote = await quoteLines(tx, [selection], { userId: user.id, waiveNotice: true });
      const lines = quote.lines.filter((l: any) => l.requiresBooking);
      if (!lines.length) throw new HttpError(409, 'هذه الخدمة لا تحتاج إلى حجز بموعد');
      const items: PackageNoticeItem[] = [], infos: any[] = [];
      for (const line of lines) {
        const check = await checkNotice(tx, { offerId: line.offerId, cityId, date, time, offsetMinutes: line.selection.offsetMinutes || 0 });
        items.push({ label: line.titleAr, offerId: line.offerId, evaluation: check.evaluation });
        infos.push({ offerId: line.offerId, serviceId: line.serviceId, titleAr: line.titleAr, vendorId: line.vendorId ?? check.vendorId, managerIds: line.managers ?? [], requiredMinutes: check.evaluation.requiredMinutes, remainingMinutes: Math.max(0, check.evaluation.remainingMinutes), ok: check.evaluation.ok });
      }
      const verdict = evaluatePackageNotice(items);
      if (verdict.ok) throw new HttpError(409, 'الموعد يستوفي مدة الحجز المسبق؛ لا حاجة لطلب استثناء');
      if (!verdict.canRequestException) throw new HttpError(409, items.some(i => i.evaluation.cutoffPassed) ? 'انتهى وقت قبول الحجوزات لهذه الخدمة' : 'إحدى الخدمات لا تقبل طلبات الاستثناء أو أن الموعد قد فات');
      comps.push(...infos.filter(i => !i.ok).sort((a, b) => b.requiredMinutes - a.requiredMinutes).map(({ ok, ...c }) => c));
      offerId = comps[0].offerId; packageId = selection.packageId;
      priceInfo = { subtotal: quote.totals.subtotal, tax: quote.totals.tax, total: quote.totals.total };
    }
    // a component is run by a provider when one of its managers is an active vendor account; otherwise by the platform itself
    const vendorUsers = new Set((await tx.user.findMany({ where: { id: { in: Array.from(new Set(comps.flatMap(c => c.managerIds ?? []))) }, role: 'VENDOR', isActive: true }, select: { id: true } })).map(u => u.id));
    for (const c of comps) c.providerIds = (c.managerIds ?? []).filter((m: string) => vendorUsers.has(m));
    const limiting = comps[0], startAt = zonedInstant(date, time);
    const dedupKey = sha([user.id, kind, kind === 'RESCHEDULE' ? `${bookingRow.id}|${date}|${time}` : `${packageId ?? offerId}|${cityId}|${date}|${time}`].join('|'));
    await lock(tx, 'exception-dedup:' + dedupKey);
    const existing = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "dedupKey"=${dedupKey} AND "status" <> ALL(${FINALS_SQL as string[]})`)[0];
    if (existing) return { request: existing, duplicate: true };
    const id = randomUUID(), number = await uniqueNumber(tx, kind === 'RESCHEDULE' ? 'RS' : 'EX');
    const minutesToStart = Math.max(0, Math.floor((+startAt - Date.now()) / 60000)), priority = priorityFor(minutesToStart);
    const occasion = { date: text(input.occasionDate, 10), time: text(input.occasionTime, 5) };
    const body = { components: comps, titleAr: packageId ? 'باقة خدمات' : limiting.titleAr, priceInfo, occasion, ...(kind === 'RESCHEDULE' ? { originalDate: bookingRow.body.date, originalTime: bookingRow.body.time } : {}) };
    await tx.$executeRaw`INSERT INTO "ExceptionRequest" ("id","number","kind","status","customerId","vendorId","serviceId","offerId","packageId","cityId","bookingRequestId","requestedDate","requestedTime","startAt","originalStartAt","requiredNoticeMinutes","remainingNoticeMinutes","reason","urgencyDetails","customerNotes","contact","priority","dedupKey","selection","body")
      VALUES (${id},${number},${kind},'submitted',${user.id},${limiting.vendorId ?? null},${limiting.serviceId ?? ''},${offerId},${packageId},${cityId},${bookingRow?.id ?? null},${date},${time},${startAt},${originalStartAt},${limiting.requiredMinutes},${limiting.remainingMinutes},${reason},${urgencyDetails},${customerNotes},${JSON.stringify(contact)}::jsonb,${priority},${dedupKey},${JSON.stringify(selection)}::jsonb,${JSON.stringify(body)}::jsonb)`;
    let row = await load(tx, id, false);
    await record(tx, row, { id: user.id, role: 'customer' }, 'SUBMIT', null, 'submitted', { kind, requiredMinutes: limiting.requiredMinutes, remainingMinutes: limiting.remainingMinutes });
    const consentText = EXCEPTION_ACK_TEXT;
    await tx.$executeRaw`INSERT INTO "CustomerConsent" ("id","requestId","customerId","kind","textHash","text","ip","userAgent") VALUES (${randomUUID()},${id},${user.id},'EXCEPTION_ACK',${sha(consentText)},${consentText},${meta.ip},${meta.userAgent.slice(0, 300)})`;
    // who must approve feasibility: each vendor-managed component's own provider, the platform for platform-run services (and for vendors too if policy says so)
    for (const c of comps) if (c.providerIds.length) await addStep(tx, id, 'FEASIBILITY', 'PROVIDER', c.offerId);
    if (comps.some(c => !c.providerIds.length) || cfg.requirePlatformApprovalForVendorServices) await addStep(tx, id, 'FEASIBILITY', 'PLATFORM');
    row = await system(tx, row, 'REVIEW', cfg);
    row = await system(tx, row, 'REQUEST_PROVIDER', cfg);
    const path = `/exceptions/${id}`, titleAr = body.titleAr;
    await notify(tx, row, 'SUBMITTED', [user.id], { titleAr: 'استلمنا طلب الاستثناء', bodyAr: `طلبك لخدمة «${titleAr}» قيد المراجعة. رقمه المرجعي ${number}.`, path });
    await notify(tx, row, 'PROVIDER_REQUEST', comps.flatMap(c => c.providerIds), { titleAr: 'طلب استثناء بانتظار موافقتك', bodyAr: `يطلب عميل تنفيذ «${titleAr}» خلال ${describeMinutes(limiting.remainingMinutes)} بدلاً من ${describeMinutes(limiting.requiredMinutes)}. راجع إمكانية التنفيذ.`, path });
    await notify(tx, row, 'SUBMITTED', await platformUserIds(tx), { titleAr: 'طلب استثناء جديد', bodyAr: `${number}: «${titleAr}» — المتبقي ${describeMinutes(limiting.remainingMinutes)} من ${describeMinutes(limiting.requiredMinutes)} المطلوبة.`, path });
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'EXCEPTION_SUBMITTED', targetId: id, details: { number, kind } } });
    return { request: row, duplicate: false };
  });
}
