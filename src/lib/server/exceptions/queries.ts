import 'server-only';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireUser } from '../auth';
import { HttpError, text } from '../http';
import { admin } from '../booking/repository';
import { ACTION_LABELS, ExceptionAction, FINAL_STATUSES, STATUSES, STATUS_LABELS, allowedActions, stageOf } from '@/lib/exceptions/machine';
import { actorsFor, canSee, providerScope, sha, staffOf } from './workflow';

const finalList = FINAL_STATUSES as readonly string[];
/** Actions in the history a customer or a provider should not see (internal bookkeeping). */
const INTERNAL_ACTIONS = ['LOG_CONTACT', 'SET_PRIORITY', 'REASSIGN', 'APPROVE_OFFER', 'ASSIGN'];

/** What a person may list: a customer their own, a provider the requests on their services, a coordinator their assignments, staff everything. */
async function scope(user: any): Promise<{ sql: Prisma.Sql; staff: Set<string>; wide: boolean }> {
  const staff = await staffOf(prisma, user.id);
  const wide = admin(user) || staff.has('BOOKING_SUPERVISOR') || staff.has('SUPPORT');
  const parts = [Prisma.sql`r."customerId"=${user.id}`];
  if (user.role === 'VENDOR') parts.push(Prisma.sql`EXISTS (SELECT 1 FROM jsonb_array_elements(r."body"->'components') c WHERE c->'providerIds' ? ${user.id})`);
  if (staff.has('COORDINATOR')) parts.push(Prisma.sql`r."assignedCoordinatorId"=${user.id}`);
  return { sql: wide ? Prisma.sql`TRUE` : Prisma.join(parts, ' OR '), staff, wide };
}

const money = (n: number | null | undefined) => (n === null || n === undefined ? null : n);
function summarize(r: any, now: number) {
  const feas = (r.steps ?? []).filter((s: any) => s.stage === 'FEASIBILITY' && s.status !== 'SUPERSEDED');
  const price = (r.steps ?? []).filter((s: any) => s.stage === 'CUSTOMER_PRICE' && s.status !== 'SUPERSEDED');
  const approval = (list: any[]) => !list.length ? 'NONE' : list.some(s => s.status === 'REJECTED') ? 'REJECTED' : list.every(s => s.status === 'APPROVED') ? 'APPROVED' : 'PENDING';
  const remaining = Math.floor((+new Date(r.startAt) - now) / 60000);
  return {
    id: r.id, number: r.number, kind: r.kind, status: r.status, statusAr: STATUS_LABELS[r.status as keyof typeof STATUS_LABELS], stage: stageOf(r.status),
    customerName: r.customerName, vendorName: r.vendorName, titleAr: r.body.titleAr, cityId: r.cityId, requestedDate: r.requestedDate, requestedTime: r.requestedTime, startAt: r.startAt, remainingMinutes: remaining,
    requiredNoticeMinutes: r.requiredNoticeMinutes, originalTotal: money(r.body.priceInfo?.currentTotal ?? r.body.priceInfo?.total), offerTotal: money(r.offerTotal), offerStatus: r.offerStatus ?? null,
    feasibilityStatus: approval(feas), customerApprovalStatus: approval(price), paymentStatus: r.status === 'awaiting_payment' ? 'PENDING' : ['confirmed', 'completed'].includes(r.status) ? 'DONE' : 'NONE',
    coordinatorId: r.assignedCoordinatorId, coordinatorName: r.coordinatorName ?? null, priority: r.priority, dueAt: r.dueAt, late: !!r.dueAt && +new Date(r.dueAt) < now && !finalList.includes(r.status),
    escalation: Number(r.body.escalation ?? 0), createdAt: r.createdAt, updatedAt: r.updatedAt, bookingRequestId: r.bookingRequestId, version: r.version,
  };
}

export async function listExceptions(search: URLSearchParams) {
  const user = await requireUser(); const { sql, wide, staff } = await scope(user), now = Date.now();
  const statuses = text(search.get('status'), 400).split(',').map(x => x.trim()).filter(Boolean), kind = text(search.get('kind'), 20), city = text(search.get('cityId'), 100), vendor = text(search.get('vendorId'), 100), coordinator = text(search.get('coordinatorId'), 100), q = text(search.get('q'), 80);
  const from = text(search.get('from'), 10), to = text(search.get('to'), 10), late = search.get('late') === '1', mine = search.get('mine') === '1';
  if (statuses.some(x => !(STATUSES as readonly string[]).includes(x))) throw new HttpError(400, 'مرشح غير صالح');
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) throw new HttpError(400, 'تاريخ غير صالح');
  const sorts: Record<string, Prisma.Sql> = { createdAt: Prisma.sql`r."createdAt" DESC`, updatedAt: Prisma.sql`r."updatedAt" DESC`, startAt: Prisma.sql`r."startAt" ASC`, dueAt: Prisma.sql`r."dueAt" ASC NULLS LAST`, priority: Prisma.sql`r."priority" ASC, r."dueAt" ASC NULLS LAST` };
  const order = sorts[search.get('sort') ?? ''] ?? sorts.createdAt, limit = Math.min(200, Math.max(1, Number(search.get('limit')) || 50)), offset = Math.max(0, Number(search.get('offset')) || 0);
  const where = Prisma.sql`(${sql}) ${statuses.length ? Prisma.sql`AND r."status"=ANY(${statuses})` : Prisma.empty} ${kind === 'NOTICE' || kind === 'RESCHEDULE' ? Prisma.sql`AND r."kind"=${kind}` : Prisma.empty} ${city ? Prisma.sql`AND r."cityId"=${city}` : Prisma.empty} ${vendor ? Prisma.sql`AND r."vendorId"=${vendor}` : Prisma.empty} ${coordinator ? Prisma.sql`AND r."assignedCoordinatorId"=${coordinator}` : Prisma.empty} ${mine ? Prisma.sql`AND r."assignedCoordinatorId"=${user.id}` : Prisma.empty} ${from ? Prisma.sql`AND r."createdAt" >= ${from}::date` : Prisma.empty} ${to ? Prisma.sql`AND r."createdAt" < (${to}::date + 1)` : Prisma.empty} ${late ? Prisma.sql`AND r."dueAt" < CURRENT_TIMESTAMP AND r."status" <> ALL(${finalList as string[]})` : Prisma.empty} ${q ? Prisma.sql`AND (r."number" ILIKE ${'%' + q + '%'} OR c."name" ILIKE ${'%' + q + '%'} OR r."body"->>'titleAr' ILIKE ${'%' + q + '%'})` : Prisma.empty}`;
  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT r.*, c."name" AS "customerName", v."businessName" AS "vendorName", co."name" AS "coordinatorName",
      (SELECT o."total" FROM "ExceptionOffer" o WHERE o."requestId"=r."id" AND o."status" <> 'SUPERSEDED' AND o."status" <> 'WITHDRAWN' ${wide || staff.size ? Prisma.empty : Prisma.sql`AND o."status" <> 'DRAFT'`} ORDER BY o."version" DESC LIMIT 1) AS "offerTotal",
      (SELECT o."status" FROM "ExceptionOffer" o WHERE o."requestId"=r."id" AND o."status" <> 'SUPERSEDED' ORDER BY o."version" DESC LIMIT 1) AS "offerStatus",
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('stage',s."stage",'status',s."status")), '[]'::jsonb) FROM "ExceptionApprovalStep" s WHERE s."requestId"=r."id") AS "steps"
    FROM "ExceptionRequest" r JOIN "User" c ON c."id"=r."customerId" LEFT JOIN "Vendor" v ON v."id"=r."vendorId" LEFT JOIN "User" co ON co."id"=r."assignedCoordinatorId"
    WHERE ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`);
  const result: any = { requests: rows.map(r => summarize(r, now)), serverTime: new Date(now).toISOString() };
  if (search.get('stats') === '1' && (wide || staff.has('COORDINATOR'))) result.stats = await statsFor(sql);
  result.staff = wide || staff.size > 0;
  return result;
}

async function statsFor(sql: Prisma.Sql) {
  const byStatus = await prisma.$queryRaw<{ status: string; kind: string; n: number }[]>(Prisma.sql`SELECT r."status", r."kind", COUNT(*)::int AS n FROM "ExceptionRequest" r WHERE ${sql} GROUP BY r."status", r."kind"`);
  const late = (await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n FROM "ExceptionRequest" r WHERE (${sql}) AND r."dueAt" < CURRENT_TIMESTAMP AND r."status" <> ALL(${finalList as string[]})`))[0].n;
  const sum = (pred: (r: { status: string; kind: string }) => boolean) => byStatus.filter(pred).reduce((n, r) => n + r.n, 0), is = (...s: string[]) => (r: { status: string }) => s.includes(r.status);
  return {
    total: sum(() => true), submitted: sum(is('submitted')), underReview: sum(is('under_review', 'information_required')), awaitingProvider: sum(is('awaiting_provider_approval')),
    feasibilityApproved: sum(is('feasibility_approved', 'assigned_to_coordinator', 'negotiating', 'offer_prepared', 'awaiting_customer_approval', 'customer_approved', 'awaiting_payment', 'confirmed', 'completed')),
    awaitingPrice: sum(is('feasibility_approved', 'assigned_to_coordinator', 'offer_prepared')), negotiating: sum(is('negotiating')), awaitingCustomer: sum(is('awaiting_customer_approval')), awaitingPayment: sum(is('awaiting_payment', 'customer_approved')),
    confirmed: sum(is('confirmed', 'completed')), rejected: sum(is('rejected', 'execution_unavailable', 'customer_declined')), cancelled: sum(is('cancelled')), expired: sum(is('offer_expired')), late,
    reschedule: sum(r => r.kind === 'RESCHEDULE'), byStatus: Object.fromEntries(STATUSES.map(s => [s, sum(is(s))])),
  };
}

export async function exceptionDetail(id: string) {
  const user = await requireUser(), staff = await staffOf(prisma, user.id), now = Date.now();
  const row = (await prisma.$queryRaw<any[]>`SELECT r.*, c."name" AS "customerName", c."phone" AS "customerPhone", c."email" AS "customerEmail", v."businessName" AS "vendorName", co."name" AS "coordinatorName" FROM "ExceptionRequest" r JOIN "User" c ON c."id"=r."customerId" LEFT JOIN "Vendor" v ON v."id"=r."vendorId" LEFT JOIN "User" co ON co."id"=r."assignedCoordinatorId" WHERE r."id"=${id}`)[0];
  if (!row || !canSee(user, row, staff)) throw new HttpError(404, 'الطلب غير موجود');
  const actors = actorsFor(user, row, staff), isStaff = actors.some(a => ['platform', 'supervisor', 'coordinator'].includes(a)) || staff.has('SUPPORT');
  const isCustomerOnly = !isStaff && !actors.includes('provider');
  const [steps, offers, events, tasks, negotiation, consents] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT "id","stage","approverType","status","offerId","decidedBy","decidedAt","note","createdAt" FROM "ExceptionApprovalStep" WHERE "requestId"=${id} ORDER BY "createdAt"`,
    prisma.$queryRaw<any[]>`SELECT "id","version","status","startAt","baseAmount","exceptionFee","discount","vatAmount","total","previousTotal","terms","expiresAt","sentAt","decidedAt","createdAt","supervisorId" FROM "ExceptionOffer" WHERE "requestId"=${id} ${isStaff ? Prisma.empty : Prisma.sql`AND "status" <> 'DRAFT'`} ORDER BY "version" DESC`,
    prisma.$queryRaw<any[]>`SELECT e."id",e."actorRole",e."action",e."fromStatus",e."toStatus",e."body",e."createdAt",u."name" AS "actorName" FROM "ExceptionEvent" e LEFT JOIN "User" u ON u."id"=e."actorId" WHERE e."requestId"=${id} ORDER BY e."createdAt"`,
    isStaff ? prisma.$queryRaw<any[]>`SELECT t.*, u."name" AS "coordinatorName" FROM "CoordinatorTask" t LEFT JOIN "User" u ON u."id"=t."coordinatorId" WHERE t."requestId"=${id} ORDER BY t."createdAt" DESC` : Promise.resolve([]),
    isStaff ? prisma.$queryRaw<any[]>`SELECT n."id",n."channel",n."party",n."outcome",n."createdAt",u."name" AS "actorName" FROM "NegotiationLog" n LEFT JOIN "User" u ON u."id"=n."actorId" WHERE n."requestId"=${id} ORDER BY n."createdAt"` : Promise.resolve([]),
    prisma.$queryRaw<any[]>`SELECT "id","kind","offerVersion","text","createdAt" FROM "CustomerConsent" WHERE "requestId"=${id} ORDER BY "createdAt"`,
  ]);
  const can = allowedActions(row.status, actors);
  const open = steps.filter(s => s.status === 'PENDING' && s.stage === 'FEASIBILITY'), mineOffers = providerScope(user, row).map((c: any) => c.offerId);
  const actions = can.filter(a => a !== 'APPROVE_FEASIBILITY' || (actors.includes('provider') ? open.some(s => s.approverType === 'PROVIDER' && mineOffers.includes(s.offerId)) : open.some(s => s.approverType === 'PLATFORM')));
  const shown = events.filter(e => isStaff || !INTERNAL_ACTIONS.includes(e.action)).map(e => ({ ...e, actionAr: ACTION_LABELS[e.action as ExceptionAction] ?? e.action, body: isStaff ? e.body : { note: e.body?.note, date: e.body?.date, time: e.body?.time } }));
  const { dedupKey, selection, contact, ...rest } = row;
  const body = { ...row.body }; if (isCustomerOnly) { delete body.components; delete body.escalation; }
  return {
    request: { ...rest, body, ...(isStaff || row.customerId === user.id ? { contact } : {}), customerPhone: isStaff ? row.customerPhone : undefined, customerEmail: isStaff ? row.customerEmail : undefined, ...(isStaff ? { selection } : {}) },
    summary: summarize({ ...row, steps, offerTotal: offers[0]?.total ?? null, offerStatus: offers[0]?.status ?? null }, now),
    steps: isCustomerOnly ? steps.map(s => ({ ...s, decidedBy: undefined })) : steps, offers, events: shown, tasks, negotiation, consents, actors, actions: actions.map(a => ({ action: a, label: ACTION_LABELS[a] })),
    isStaff, isProvider: actors.includes('provider'), isCustomer: actors.includes('customer'), serverTime: new Date(now).toISOString(),
  };
}

/** The offer link in a message: it only tells the page which request to open; the customer must still be signed in as the owner to see or decide anything. */
export async function requestForOfferToken(tokenValue: string) {
  const row = (await prisma.$queryRaw<any[]>`SELECT o."requestId", o."status", o."expiresAt", r."customerId" FROM "ExceptionOffer" o JOIN "ExceptionRequest" r ON r."id"=o."requestId" WHERE o."tokenHash"=${sha(tokenValue)}`)[0];
  if (!row) throw new HttpError(404, 'الرابط غير صالح');
  const expired = row.status !== 'SENT' || +row.expiresAt <= Date.now();
  return { requestId: row.requestId as string, expired, customerId: row.customerId as string };
}

export async function exceptionForBooking(bookingRequestId: string) {
  const user = await requireUser();
  const rows = await prisma.$queryRaw<any[]>`SELECT "id","number","kind","status","version","requestedDate","requestedTime" FROM "ExceptionRequest" WHERE "bookingRequestId"=${bookingRequestId} AND ("customerId"=${user.id} OR ${admin(user)}) ORDER BY "createdAt" DESC LIMIT 5`;
  return { exceptions: rows.map(r => ({ ...r, statusAr: STATUS_LABELS[r.status as keyof typeof STATUS_LABELS], active: !finalList.includes(r.status) })) };
}

export async function myNotifications(markRead: boolean) {
  const user = await requireUser();
  const rows = await prisma.$queryRaw<any[]>`SELECT "id","requestId","event","payload","readAt","createdAt" FROM "ExceptionNotification" WHERE "userId"=${user.id} AND "channel"='inbox' ORDER BY "createdAt" DESC LIMIT 30`;
  if (markRead) await prisma.$executeRaw`UPDATE "ExceptionNotification" SET "readAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id} AND "channel"='inbox' AND "readAt" IS NULL`;
  return { notifications: rows.map(r => ({ id: r.id, requestId: r.requestId, event: r.event, titleAr: r.payload.titleAr, bodyAr: r.payload.bodyAr, path: r.payload.path, read: !!r.readAt, createdAt: r.createdAt })), unread: rows.filter(r => !r.readAt).length };
}

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v).replace(/\r?\n/g, ' '); return /[",]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };
/** CSV for the administrators' dashboard. A cell that starts with = + - or @ is neutralised so a spreadsheet never runs it as a formula. */
export async function exportExceptionsCsv(search: URLSearchParams) {
  const user = await requireUser(); const { wide } = await scope(user);
  if (!wide) throw new HttpError(403, 'التصدير للإدارة والمشرفين');
  search.set('limit', '200'); const { requests } = await listExceptions(search);
  const head = ['الرقم', 'النوع', 'العميل', 'المورد', 'الخدمة', 'المدينة', 'الموعد المطلوب', 'المتبقي بالدقائق', 'السعر الأصلي (هللة)', 'سعر العرض (هللة)', 'الموافقة التشغيلية', 'اعتماد العميل', 'الدفع', 'المنسق', 'الحالة', 'تاريخ الإنشاء', 'آخر تحديث'];
  const lines = requests.map((r: any) => [r.number, r.kind === 'RESCHEDULE' ? 'تعديل موعد' : 'استثناء', r.customerName, r.vendorName ?? 'المنصة', r.titleAr, r.cityId, `${r.requestedDate} ${r.requestedTime}`, r.remainingMinutes, r.originalTotal, r.offerTotal, r.feasibilityStatus, r.customerApprovalStatus, r.paymentStatus, r.coordinatorName, r.statusAr, new Date(r.createdAt).toISOString(), new Date(r.updatedAt).toISOString()].map(csvCell).join(','));
  return '﻿' + [head.map(csvCell).join(','), ...lines].join('\r\n');
}
