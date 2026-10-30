import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireUser, rateLimit } from '../auth';
import { HttpError, text, integer } from '../http';
import { requireFeature } from '../features';
import { atomic, lock, Tx, requestRow, saveRequest } from '../booking/repository';
import { calendarAndConflict, event as bookingEvent, reminders as bookingReminders } from '../booking/requests';
import { quoteLines, saveCart } from '../commerce-v2/cart';
import { notify } from './notify';
import { acceptedOffer } from './offers-read';
import { zonedInstant } from '@/lib/booking/advance-notice';
import { Actor, ACTIONS, ExceptionAction, ExceptionConfigBody, ExceptionStatus, RULES, STATUS_LABELS, TransitionError, finalConfirmationGuard, isFinal, offerTotals, priceWithCharge, transition } from '@/lib/exceptions/machine';
import { OFFER_ACCEPT_TEXT, OFFER_DECLINE_TEXT, OFFER_RENEGOTIATE_TEXT } from '@/lib/exceptions/texts';
import { RequestMeta, actorsFor, addStep, canSee, decide, load, loadConfig, move, pending, platformUserIds, providerScope, record, sha, staffOf, steps, system, managersOf } from './workflow';

const bad = (message: string, status = 409) => new HttpError(status, message);
const token = () => randomBytes(24).toString('base64url');
const FIVE_MIN = 5 * 60000;

async function closeTask(tx: Tx, requestId: string, status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED') {
  await tx.$executeRaw`UPDATE "CoordinatorTask" SET "status"=${status},"closedAt"=${status === 'IN_PROGRESS' ? null : new Date()} WHERE "requestId"=${requestId} AND "status" IN ('OPEN','IN_PROGRESS')`;
}
async function openTask(tx: Tx, row: any, coordinatorId: string, cfg: ExceptionConfigBody) {
  const due = new Date(Date.now() + cfg.coordinatorResponseHours[row.priority as 1 | 2 | 3 | 4] * 3600000);
  const changed = await tx.$executeRaw`UPDATE "CoordinatorTask" SET "coordinatorId"=${coordinatorId} WHERE "requestId"=${row.id} AND "status" IN ('OPEN','IN_PROGRESS')`;
  if (changed === 0) await tx.$executeRaw`INSERT INTO "CoordinatorTask" ("id","requestId","coordinatorId","priority","dueAt") VALUES (${randomUUID()},${row.id},${coordinatorId},${row.priority},${due})`;
}
async function withdrawOffers(tx: Tx, requestId: string, statuses: string[], to: 'WITHDRAWN' | 'SUPERSEDED' | 'EXPIRED' | 'DECLINED') {
  await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"=${to},"decidedAt"=COALESCE("decidedAt",CURRENT_TIMESTAMP) WHERE "requestId"=${requestId} AND "status"=ANY(${statuses})`;
}
async function eligibleCoordinator(tx: Tx, userId: string) {
  const u = (await tx.$queryRaw<any[]>`SELECT "id","role","isActive" FROM "User" WHERE "id"=${userId}`)[0];
  if (!u?.isActive) return false;
  return ['ADMIN', 'SUPER_ADMIN'].includes(u.role) || (await staffOf(tx, userId)).has('COORDINATOR');
}
/** The coordinator with the fewest open tasks, or null when nobody has the role. */
async function leastBusyCoordinator(tx: Tx): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT u."id" FROM "StaffRole" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "CoordinatorTask" t ON t."coordinatorId"=u."id" AND t."status" IN ('OPEN','IN_PROGRESS') WHERE s."role"='COORDINATOR' AND u."isActive"=true GROUP BY u."id" ORDER BY COUNT(t."id"), u."id" LIMIT 1`;
  return rows[0]?.id ?? null;
}
async function autoAssign(tx: Tx, row: any, cfg: ExceptionConfigBody) {
  const coordinatorId = await leastBusyCoordinator(tx);
  if (!coordinatorId) {
    await notify(tx, row, 'ASSIGNED', await platformUserIds(tx), { titleAr: 'طلب استثناء بلا منسق', bodyAr: `${row.number}: تمت الموافقة التشغيلية ولا يوجد منسق متاح. أسند الطلب إلى منسق.`, path: `/exceptions/${row.id}` }, { once: 'unassigned:' + row.version });
    return row;
  }
  const next = await system(tx, row, 'ASSIGN', cfg, { assignedCoordinatorId: coordinatorId }, { coordinatorId, auto: true });
  await openTask(tx, next, coordinatorId, cfg);
  await notify(tx, next, 'ASSIGNED', [coordinatorId], { titleAr: 'أُسند إليك طلب استثناء', bodyAr: `${next.number}: ${next.body.titleAr}. الأولوية: ${next.priority === 1 ? 'عاجل جداً' : next.priority === 2 ? 'عاجل' : 'عادي'}.`, path: `/exceptions/${next.id}` });
  return next;
}

// ---- the action dispatcher ------------------------------------------------------------------------------------------------------
/** Every step of every stage goes through here: version check, role check, the state machine, then the effect, all in one transaction. */
export async function exceptionAction(input: any, meta: RequestMeta) {
  const user = await requireUser(); await rateLimit('exception-action:' + user.id, 120); await requireFeature('booking_exceptions');
  const id = text(input.id, 100, true), action = text(input.action, 60, true), note = text(input.note, 2000);
  return atomic(async tx => {
    const cfg = await loadConfig(tx);
    let row = await load(tx, id);
    const staff = await staffOf(tx, user.id);
    if (!canSee(user, row, staff)) throw new HttpError(404, 'الطلب غير موجود');
    if (input.version !== row.version) throw bad('تغيّر الطلب؛ حدّث الصفحة');
    const actors = actorsFor(user, row, staff);
    const plain = ['LOG_CONTACT', 'SET_PRIORITY'];
    if (plain.includes(action)) return plainAction(tx, row, user, actors, action, input, cfg);
    if (!(ACTIONS as readonly string[]).includes(action)) throw new HttpError(400, 'إجراء غير معروف');
    if (isFinal(row.status)) throw bad('انتهى مسار هذا الطلب');
    if (!(RULES[action as ExceptionAction].from as readonly string[]).includes(row.status)) throw bad('هذا الإجراء غير متاح في الحالة الحالية');
    let actor: Actor | null = null, to: ExceptionStatus | null = null;
    for (const a of actors) { try { to = transition(row.status, action, a); actor = a; break; } catch (e) { if (!(e instanceof TransitionError)) throw e; } }
    if (!actor || !to) throw new HttpError(403, 'لا تملك صلاحية هذا الإجراء');
    const who = { id: user.id, role: actor };
    const log = (r: any, body: Record<string, unknown> = {}) => record(tx, r, who, action, row.status, r.status, body);
    const path = `/exceptions/${row.id}`, title = row.body.titleAr as string;
    const platformIds = () => platformUserIds(tx);
    const needNote = () => { if (!note) throw new HttpError(400, 'اكتب سبب الإجراء'); };

    switch (action as ExceptionAction) {
      case 'APPROVE_FEASIBILITY': {
        const open = pending(await steps(tx, id, 'FEASIBILITY'));
        const offerIds = providerScope(user, row).map((c: any) => c.offerId);
        const mine = actor === 'provider' ? open.filter(s => s.approverType === 'PROVIDER' && offerIds.includes(s.offerId)) : open.filter(s => s.approverType === 'PLATFORM');
        if (!mine.length) throw bad('لا توجد موافقة مطلوبة منك على هذا الطلب');
        for (const s of mine) await decide(tx, id, { stage: 'FEASIBILITY', approverType: s.approverType, offerId: s.offerId }, 'APPROVED', user.id, note);
        const left = pending(await steps(tx, id, 'FEASIBILITY'));
        if (left.length) { row = await move(tx, row, 'awaiting_provider_approval', cfg); await log(row, { remaining: left.length }); return row; }
        row = await move(tx, row, 'feasibility_approved', cfg); await log(row);
        await notify(tx, row, 'FEASIBILITY_APPROVED', [row.customerId], { titleAr: 'تمت الموافقة المبدئية على طلبك', bodyAr: `وافق مقدم الخدمة مبدئياً على إمكانية تنفيذ «${title}». لا يعني هذا تأكيد الحجز؛ سيتواصل معك منسق لتحديد السعر النهائي.`, path });
        return autoAssign(tx, row, cfg);
      }
      case 'REJECT': case 'MARK_UNAVAILABLE': {
        needNote();
        await tx.$executeRaw`UPDATE "ExceptionApprovalStep" SET "status"=${action === 'REJECT' ? 'REJECTED' : 'SUPERSEDED'},"decidedBy"=${user.id},"decidedAt"=CURRENT_TIMESTAMP,"note"=${note} WHERE "requestId"=${id} AND "status"='PENDING'`;
        await withdrawOffers(tx, id, ['DRAFT', 'SENT'], 'WITHDRAWN'); await closeTask(tx, id, 'CANCELLED');
        if (row.kind === 'RESCHEDULE') await clearCharge(tx, row);
        row = await move(tx, row, to, cfg, { body: { closingNote: note, closedBy: user.id } }); await log(row, { note });
        const reschedule = row.kind === 'RESCHEDULE' ? ' حجزك الأصلي ما زال ساريًا بموعده وسعره.' : '';
        await notify(tx, row, action === 'REJECT' ? 'REJECTED' : 'UNAVAILABLE', [row.customerId], { titleAr: action === 'REJECT' ? 'تعذر قبول طلب الاستثناء' : 'تعذر تنفيذ الخدمة في الموعد المطلوب', bodyAr: `«${title}»: ${note}.${reschedule}`, path });
        return row;
      }
      case 'PROPOSE_ALTERNATIVE': {
        const date = text(input.date, 10, true), time = text(input.time, 5, true); let startAt: Date;
        try { startAt = zonedInstant(date, time); } catch (e: any) { throw new HttpError(400, e.message); }
        if (+startAt <= Date.now() + FIVE_MIN) throw new HttpError(400, 'اقترح موعداً مستقبلياً'); if (date === row.requestedDate && time === row.requestedTime) throw new HttpError(400, 'الموعد المقترح هو نفسه الموعد المطلوب');
        row = await move(tx, row, 'alternative_proposed', cfg, { body: { alternative: { date, time, startAt: startAt.toISOString(), by: user.id, byRole: actor, note } } }); await log(row, { date, time, note });
        await notify(tx, row, 'ALTERNATIVE_PROPOSED', [row.customerId], { titleAr: 'موعد بديل مقترح لطلبك', bodyAr: `اقترح مقدم الخدمة تنفيذ «${title}» يوم ${date} الساعة ${time}. يمكنك القبول أو الرفض من صفحة الطلب.`, path });
        return row;
      }
      case 'ACCEPT_ALTERNATIVE': {
        const alt = row.body.alternative; if (!alt) throw bad('لا يوجد موعد بديل');
        const proposer = { id: alt.by as string, role: alt.byRole as string };
        // the one who proposed the new time has, by proposing it, approved feasibility for it
        const open = pending(await steps(tx, id, 'FEASIBILITY'));
        const proposerUser = (await tx.$queryRaw<any[]>`SELECT "id","role" FROM "User" WHERE "id"=${proposer.id}`)[0];
        const comps = (row.body.components ?? []).filter((c: any) => (c.managerIds ?? []).includes(proposer.id)).map((c: any) => c.offerId);
        for (const s of open) if ((s.approverType === 'PROVIDER' && comps.includes(s.offerId)) || (s.approverType === 'PLATFORM' && proposerUser && ['ADMIN', 'SUPER_ADMIN'].includes(proposerUser.role))) await decide(tx, id, { stage: 'FEASIBILITY', approverType: s.approverType, offerId: s.offerId }, 'APPROVED', proposer.id, 'الموعد البديل');
        const left = pending(await steps(tx, id, 'FEASIBILITY'));
        row = await move(tx, row, left.length ? 'awaiting_provider_approval' : 'feasibility_approved', cfg, { slot: { date: alt.date, time: alt.time, startAt: new Date(alt.startAt) }, body: { alternative: null, acceptedAlternative: alt } }); await log(row, { date: alt.date, time: alt.time });
        if (!left.length) { await notify(tx, row, 'FEASIBILITY_APPROVED', [row.customerId], { titleAr: 'تم اعتماد الموعد البديل', bodyAr: `سيتواصل معك منسق لتحديد السعر النهائي لـ«${title}».`, path }); return autoAssign(tx, row, cfg); }
        return row;
      }
      case 'DECLINE_ALTERNATIVE': case 'CANCEL': {
        if (action === 'CANCEL' && actor !== 'customer') needNote();
        await tx.$executeRaw`UPDATE "ExceptionApprovalStep" SET "status"='SUPERSEDED',"decidedBy"=${user.id},"decidedAt"=CURRENT_TIMESTAMP,"note"=${note} WHERE "requestId"=${id} AND "status"='PENDING'`;
        await withdrawOffers(tx, id, ['DRAFT', 'SENT'], 'WITHDRAWN'); await closeTask(tx, id, 'CANCELLED');
        if (row.kind === 'RESCHEDULE') await clearCharge(tx, row);
        row = await move(tx, row, to, cfg, { body: { closingNote: note, closedBy: user.id } }); await log(row, { note });
        await notify(tx, row, 'CANCELLED', [...(actor === 'customer' ? [...managersOf(row), ...(row.assignedCoordinatorId ? [row.assignedCoordinatorId] : [])] : [row.customerId])], { titleAr: 'أُلغي طلب الاستثناء', bodyAr: `${row.number}: «${title}»${note ? ' — ' + note : ''}`, path });
        return row;
      }
      case 'REQUEST_INFO': {
        needNote();
        row = await move(tx, row, 'information_required', cfg, { body: { infoRequest: { note, by: user.id, at: new Date().toISOString(), returnTo: row.status } } }); await log(row, { note });
        await notify(tx, row, 'INFO_REQUIRED', [row.customerId], { titleAr: 'نحتاج معلومات إضافية لطلبك', bodyAr: `«${title}»: ${note}`, path });
        return row;
      }
      case 'PROVIDE_INFO': {
        const info = text(input.info, 2000, true);
        row = await move(tx, row, 'under_review', cfg, { body: { infoReplies: [...(row.body.infoReplies ?? []), { info, at: new Date().toISOString() }], infoRequest: null } }); await log(row, { info });
        row = await system(tx, row, 'REQUEST_PROVIDER', cfg);
        await notify(tx, row, 'PROVIDER_REQUEST', [...managersOf(row), ...await platformIds()], { titleAr: 'أرسل العميل المعلومات المطلوبة', bodyAr: `${row.number}: «${title}» — ${info}`, path });
        return row;
      }
      case 'ASSIGN': case 'REASSIGN': {
        const coordinatorId = text(input.coordinatorId, 100, true);
        if (!await eligibleCoordinator(tx, coordinatorId)) throw bad('المنسق المختار غير مخول');
        row = await move(tx, row, to, cfg, { assignedCoordinatorId: coordinatorId }); await openTask(tx, row, coordinatorId, cfg); await log(row, { coordinatorId });
        await notify(tx, row, 'ASSIGNED', [coordinatorId], { titleAr: 'أُسند إليك طلب استثناء', bodyAr: `${row.number}: ${title}.`, path }, { once: 'assign:' + row.version });
        return row;
      }
      case 'START_NEGOTIATION': case 'REOPEN_NEGOTIATION': {
        row = await move(tx, row, 'negotiating', cfg); await closeTask(tx, id, 'IN_PROGRESS'); await log(row); return row;
      }
      case 'PREPARE_OFFER': return prepareOffer(tx, row, user, who, input, cfg);
      case 'APPROVE_OFFER': {
        const offer = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionOffer" WHERE "requestId"=${id} AND "status"='DRAFT' ORDER BY "version" DESC LIMIT 1`)[0];
        if (!offer) throw bad('لا يوجد عرض معد للاعتماد');
        await tx.$executeRaw`UPDATE "ExceptionOffer" SET "supervisorId"=${user.id} WHERE "id"=${offer.id}`;
        row = await move(tx, row, 'offer_prepared', cfg); await log(row, { offerVersion: offer.version }); return row;
      }
      case 'SEND_OFFER': return sendOffer(tx, row, user, who, actor, cfg, meta);
      case 'CUSTOMER_ACCEPT': case 'CUSTOMER_DECLINE': case 'CUSTOMER_RENEGOTIATE': return customerDecision(tx, row, user, who, action as ExceptionAction, input, cfg, meta);
      default: throw new HttpError(400, 'هذا الإجراء ينفذه النظام تلقائياً');
    }
  });
}

/** Actions that do not move a request: recording a contact attempt and changing the follow-up priority. */
async function plainAction(tx: Tx, row: any, user: any, actors: Actor[], action: string, input: any, cfg: ExceptionConfigBody) {
  if (isFinal(row.status)) throw bad('انتهى مسار هذا الطلب');
  const staffActor = actors.find(a => ['coordinator', 'supervisor', 'platform'].includes(a));
  if (!staffActor) throw new HttpError(403, 'لا تملك صلاحية هذا الإجراء');
  if (action === 'LOG_CONTACT') {
    const channel = text(input.channel, 20, true), party = text(input.party, 20, true), outcome = text(input.outcome, 2000, true);
    if (!['PHONE', 'WHATSAPP', 'SMS', 'EMAIL', 'NOTE'].includes(channel) || !['CUSTOMER', 'VENDOR', 'INTERNAL'].includes(party)) throw new HttpError(400, 'بيانات التواصل غير صالحة');
    const task = (await tx.$queryRaw<any[]>`SELECT "id" FROM "CoordinatorTask" WHERE "requestId"=${row.id} ORDER BY "createdAt" DESC LIMIT 1`)[0];
    await tx.$executeRaw`INSERT INTO "NegotiationLog" ("id","requestId","taskId","actorId","channel","party","outcome") VALUES (${randomUUID()},${row.id},${task?.id ?? null},${user.id},${channel},${party},${outcome})`;
    await record(tx, row, { id: user.id, role: staffActor }, 'LOG_CONTACT', row.status, row.status, { channel, party });
    return row;
  }
  if (!actors.some(a => ['supervisor', 'platform'].includes(a))) throw new HttpError(403, 'تغيير الأولوية للمشرف أو الإدارة');
  const priority = integer(input.priority, 4, 3); if (![1, 2, 3, 4].includes(priority)) throw new HttpError(400, 'أولوية غير صالحة');
  const next = await move(tx, row, row.status, cfg, { priority: priority as 1 | 2 | 3 | 4 });
  await tx.$executeRaw`UPDATE "CoordinatorTask" SET "priority"=${priority} WHERE "requestId"=${row.id} AND "status" IN ('OPEN','IN_PROGRESS')`;
  await record(tx, next, { id: user.id, role: 'supervisor' }, 'SET_PRIORITY', row.status, row.status, { from: row.priority, to: priority });
  return next;
}

// ---- offers ---------------------------------------------------------------------------------------------------------------------
async function prepareOffer(tx: Tx, row: any, user: any, who: { id: string; role: string }, input: any, cfg: ExceptionConfigBody) {
  const date = text(input.date, 10) || row.requestedDate, time = text(input.time, 5) || row.requestedTime; let startAt: Date;
  try { startAt = zonedInstant(date, time); } catch (e: any) { throw new HttpError(400, e.message); }
  if (+startAt <= Date.now() + FIVE_MIN) throw new HttpError(400, 'موعد العرض يجب أن يكون في المستقبل');
  const exceptionFee = integer(input.exceptionFee, 2_000_000_000, 0), discount = integer(input.discount, 2_000_000_000, 0);
  if (discount > exceptionFee) throw new HttpError(400, 'الخصم لا يتجاوز رسوم الاستثناء');
  let baseAmount: number, previousTotal = 0, vatBps = 1500;
  if (row.kind === 'RESCHEDULE') {
    const booking = await requestRow(tx, row.bookingRequestId, true);
    if (booking.status !== 'CONFIRMED' || +booking.startAt !== +row.originalStartAt) throw bad('تغيّر الحجز الأصلي؛ ألغِ هذا الطلب وأنشئ طلباً جديداً');
    baseAmount = booking.body.price.subtotal; previousTotal = booking.body.price.total; vatBps = booking.body.policy.taxBps;
  } else {
    const quote = await quoteLines(tx, [{ ...row.selection, date, time }], { userId: row.customerId, waiveNotice: true });
    baseAmount = quote.totals.subtotal; vatBps = quote.lines[0]?.policy?.taxBps ?? 1500;
  }
  let totals; try { totals = offerTotals({ baseAmount, exceptionFee, discount, vatBps }); } catch (e: any) { throw new HttpError(400, e.message); }
  const terms = { date, time, paymentAr: text(input.paymentAr, 2000) || 'الدفعة المقدمة والرصيد وفق سياسة الخدمة الأصلية، ويستحق السعر الجديد كاملاً عند التأكيد.', cancellationAr: text(input.cancellationAr, 2000) || 'تطبق سياسة الإلغاء المعتمدة للخدمة.', modificationAr: text(input.modificationAr, 2000) || 'أي تغيير في الموعد أو السعر بعد الاعتماد يتطلب عرضاً جديداً وموافقة جديدة.', noteAr: text(input.noteAr, 2000) };
  const version = Number((await tx.$queryRaw<{ v: number }[]>`SELECT COALESCE(MAX("version"),0)::int AS v FROM "ExceptionOffer" WHERE "requestId"=${row.id}`)[0].v) + 1;
  await withdrawOffers(tx, row.id, ['DRAFT'], 'SUPERSEDED');
  await tx.$executeRaw`UPDATE "ExceptionApprovalStep" SET "status"='SUPERSEDED',"decidedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "stage"='CUSTOMER_PRICE' AND "status"='PENDING'`;
  await tx.$executeRaw`INSERT INTO "ExceptionOffer" ("id","requestId","version","startAt","baseAmount","exceptionFee","discount","vatAmount","total","previousTotal","terms","createdBy") VALUES (${randomUUID()},${row.id},${version},${startAt},${totals.baseAmount},${totals.exceptionFee},${totals.discount},${totals.vatAmount},${totals.total},${previousTotal},${JSON.stringify(terms)}::jsonb,${user.id})`;
  const next = await move(tx, row, 'offer_prepared', cfg, { body: { currentOfferVersion: version } });
  await record(tx, next, who, 'PREPARE_OFFER', row.status, next.status, { version, total: totals.total, exceptionFee, discount });
  return next;
}

async function sendOffer(tx: Tx, row: any, user: any, who: { id: string; role: string }, actor: Actor, cfg: ExceptionConfigBody, meta: RequestMeta) {
  const offer = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionOffer" WHERE "requestId"=${row.id} AND "status"='DRAFT' ORDER BY "version" DESC LIMIT 1`)[0];
  if (!offer) throw bad('أعد العرض أولاً');
  if (cfg.supervisorApprovalAboveAmount > 0 && offer.total > cfg.supervisorApprovalAboveAmount && !offer.supervisorId && !['platform', 'supervisor'].includes(actor)) {
    await notify(tx, row, 'OFFER_APPROVAL_NEEDED', await platformUserIds(tx), { titleAr: 'عرض استثناء يحتاج اعتمادك', bodyAr: `${row.number}: قيمة العرض تتجاوز حد موافقة المشرف.`, path: `/exceptions/${row.id}` }, { once: 'approve:' + offer.version });
    throw bad('يتجاوز العرض الحد المسموح للمنسق؛ أُرسل طلب اعتماد إلى المشرف');
  }
  if (+offer.startAt <= Date.now() + 2 * FIVE_MIN) throw bad('اقترب موعد العرض؛ أعد إعداده بموعد لاحق');
  const expiresAt = new Date(Math.min(Date.now() + cfg.offerValidityHours * 3600000, +offer.startAt - FIVE_MIN)), secret = token();
  await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"='SENT',"sentAt"=CURRENT_TIMESTAMP,"expiresAt"=${expiresAt},"tokenHash"=${sha(secret)} WHERE "id"=${offer.id}`;
  await addStep(tx, row.id, 'CUSTOMER_PRICE', 'CUSTOMER', offer.id);
  let next = await move(tx, row, 'awaiting_customer_approval', cfg);
  const target = next.dueAt && +next.dueAt > +expiresAt ? expiresAt : next.dueAt;
  if (target && +target !== +next.dueAt) await tx.$executeRaw`UPDATE "ExceptionRequest" SET "dueAt"=${target} WHERE "id"=${row.id}`;
  next = await load(tx, row.id, false);
  await record(tx, next, who, 'SEND_OFFER', row.status, next.status, { version: offer.version, total: offer.total, expiresAt: expiresAt.toISOString() });
  const total = (offer.total / 100).toFixed(2);
  await notify(tx, next, 'OFFER_SENT', [row.customerId], { titleAr: 'عرض السعر النهائي لطلبك جاهز', bodyAr: `السعر الإجمالي ${total} ر.س شامل الضريبة. العرض صالح حتى ${expiresAt.toISOString().slice(0, 16).replace('T', ' ')} (UTC). راجعه ثم اعتمده أو ارفضه.`, path: `/exceptions/${row.id}`, link: `${meta.origin}/exceptions/offer/${secret}` });
  return next;
}

export async function clearChargeOf(tx: Tx, row: any) { return clearCharge(tx, row); }
async function clearCharge(tx: Tx, row: any) {
  if (!row.bookingRequestId) return;
  const booking = await requestRow(tx, row.bookingRequestId, true);
  if (booking.body.rescheduleCharge?.exceptionId === row.id) { const data = { ...booking.body }; delete data.rescheduleCharge; await saveRequest(tx, booking, data, booking.status); }
}

async function customerDecision(tx: Tx, row: any, user: any, who: { id: string; role: string }, action: ExceptionAction, input: any, cfg: ExceptionConfigBody, meta: RequestMeta) {
  const offer = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionOffer" WHERE "requestId"=${row.id} AND "status"='SENT' ORDER BY "version" DESC LIMIT 1`)[0];
  if (!offer) throw bad('لا يوجد عرض بانتظار قرارك');
  if (input.offerVersion !== offer.version) throw bad('صدر عرض أحدث؛ حدّث الصفحة وراجعه');
  if (+offer.expiresAt <= Date.now()) throw bad('انتهت صلاحية العرض');
  const kind = action === 'CUSTOMER_ACCEPT' ? 'OFFER_ACCEPT' : action === 'CUSTOMER_DECLINE' ? 'OFFER_DECLINE' : 'OFFER_RENEGOTIATE';
  const wording = action === 'CUSTOMER_ACCEPT' ? OFFER_ACCEPT_TEXT : action === 'CUSTOMER_DECLINE' ? OFFER_DECLINE_TEXT : OFFER_RENEGOTIATE_TEXT;
  if (action === 'CUSTOMER_ACCEPT' && input.confirm !== true) throw new HttpError(400, 'أكد موافقتك الصريحة على العرض');
  await tx.$executeRaw`INSERT INTO "CustomerConsent" ("id","requestId","offerId","customerId","kind","offerVersion","textHash","text","ip","userAgent") VALUES (${randomUUID()},${row.id},${offer.id},${user.id},${kind},${offer.version},${sha(wording)},${wording},${meta.ip},${meta.userAgent.slice(0, 300)})`;
  const title = row.body.titleAr as string, path = `/exceptions/${row.id}`, staffIds = [...(row.assignedCoordinatorId ? [row.assignedCoordinatorId] : []), ...await platformUserIds(tx)];
  if (action !== 'CUSTOMER_ACCEPT') {
    await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"='DECLINED',"decidedAt"=CURRENT_TIMESTAMP WHERE "id"=${offer.id}`;
    await decide(tx, row.id, { stage: 'CUSTOMER_PRICE', offerId: offer.id }, 'REJECTED', user.id, text(input.note, 2000));
    const to = action === 'CUSTOMER_DECLINE' ? 'customer_declined' : 'negotiating';
    if (action === 'CUSTOMER_DECLINE') { await closeTask(tx, row.id, 'CANCELLED'); if (row.kind === 'RESCHEDULE') await clearCharge(tx, row); }
    const next = await move(tx, row, to, cfg, { body: { customerNote: text(input.note, 2000) } });
    await record(tx, next, who, action, row.status, to, { offerVersion: offer.version });
    await notify(tx, next, action === 'CUSTOMER_DECLINE' ? 'OFFER_DECLINED' : 'OFFER_RENEGOTIATE', staffIds, { titleAr: action === 'CUSTOMER_DECLINE' ? 'رفض العميل العرض' : 'يطلب العميل إعادة التفاوض', bodyAr: `${row.number}: «${title}»${input.note ? ' — ' + text(input.note, 500) : ''}`, path });
    return next;
  }
  // accepted: this exact version of the offer is what was agreed
  await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"='ACCEPTED',"decidedAt"=CURRENT_TIMESTAMP WHERE "id"=${offer.id}`;
  await decide(tx, row.id, { stage: 'CUSTOMER_PRICE', offerId: offer.id }, 'APPROVED', user.id);
  const slot = { date: offer.terms.date as string, time: offer.terms.time as string, startAt: new Date(offer.startAt) };
  const paymentDueAt = new Date(Math.min(Date.now() + cfg.paymentWindowHours * 3600000, +offer.startAt - FIVE_MIN));
  let next = await move(tx, row, 'customer_approved', cfg, { slot, body: { paymentDueAt: paymentDueAt.toISOString(), acceptedOfferId: offer.id, acceptedOfferVersion: offer.version } });
  await record(tx, next, who, action, row.status, 'customer_approved', { offerVersion: offer.version, total: offer.total });
  next = await system(tx, next, 'REQUEST_PAYMENT', cfg, { body: {} });
  if (next.kind === 'RESCHEDULE') {
    const booking = await requestRow(tx, next.bookingRequestId, true);
    if (booking.status !== 'CONFIRMED' || +booking.startAt !== +next.originalStartAt) throw bad('تغيّر الحجز الأصلي؛ لا يمكن اعتماد العرض');
    const due = Math.max(0, offer.total - offer.previousTotal);
    await saveRequest(tx, booking, { ...booking.body, rescheduleCharge: { exceptionId: next.id, offerId: offer.id, amountDue: due, paidBaseline: booking.body.paid, newStartAt: new Date(offer.startAt).toISOString() } }, booking.status);
    if (due === 0) return finalizeReschedule(tx, next, cfg, { id: user.id, role: 'customer' });
  }
  await notify(tx, next, 'PAYMENT_REQUESTED', [row.customerId], { titleAr: next.kind === 'RESCHEDULE' ? 'أكمل دفع فرق السعر لتأكيد الموعد الجديد' : 'أكمل الحجز والدفع لتأكيد الموعد', bodyAr: `اعتمدت عرض «${title}». ${next.kind === 'RESCHEDULE' ? 'سيبقى حجزك على موعده الحالي حتى يكتمل الدفع.' : 'أضف الحجز إلى السلة وأكمل الدفع'} قبل ${paymentDueAt.toISOString().slice(0, 16).replace('T', ' ')} (UTC)، وإلا انتهت صلاحية العرض.`, path });
  await notify(tx, next, 'OFFER_ACCEPTED', staffIds, { titleAr: 'اعتمد العميل عرض الاستثناء', bodyAr: `${row.number}: «${title}» — بانتظار الدفع.`, path });
  return next;
}

// ---- the booking itself: hooks called by the booking, order and finance code --------------------------------------------------------
/** A booking was created from an exception's approved offer. */
export async function linkBooking(tx: Tx, exceptionId: string, requestId: string, orderId: string) {
  const row = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${exceptionId}`)[0];
  if (!row || row.kind !== 'NOTICE') return;
  await tx.$executeRaw`UPDATE "ExceptionRequest" SET "bookingRequestId"=${requestId},"body"="body" || ${JSON.stringify({ orderId })}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${exceptionId}`;
  await record(tx, row, { id: row.customerId, role: 'customer' }, 'BOOKING_CREATED', row.status, row.status, { requestId, orderId });
}
async function guardInputs(tx: Tx, row: any) {
  const offer = await acceptedOffer(tx, row.id);
  return { steps: (await steps(tx, row.id)).map(s => ({ stage: s.stage, approverType: s.approverType, status: s.status })), offer: offer ? { id: offer.id, version: offer.version, status: 'ACCEPTED', total: offer.total, startAt: offer.startAt } : null };
}
/** The final confirmation. Called from inside the booking's own confirming transaction, after its availability re-check and payment rules: if any approval is missing, it throws and the confirmation does not happen. */
export async function onBookingConfirmed(tx: Tx, booking: any) {
  const exceptionId = booking.body.exceptionId; if (!exceptionId) return;
  let row = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${exceptionId}`)[0];
  if (!row || row.kind !== 'NOTICE') return;
  await lock(tx, 'exception:' + row.id); row = await load(tx, row.id, false);
  if (row.status === 'completed') return;
  const cfg = await loadConfig(tx), inputs = await guardInputs(tx, row);
  const guard = finalConfirmationGuard({ ...inputs, requestStartAt: booking.startAt, availabilityRechecked: true, paymentSatisfied: true });
  if (row.status !== 'awaiting_payment' || !guard.ok) throw bad('لا يمكن تأكيد الحجز: ' + (guard.ok ? STATUS_LABELS[row.status as ExceptionStatus] : guard.missing.join('، ')));
  row = await system(tx, row, 'CONFIRM', cfg, { body: { confirmedAt: new Date().toISOString() } });
  row = await system(tx, row, 'COMPLETE', cfg); await closeTask(tx, row.id, 'DONE');
  await notify(tx, row, 'CONFIRMED', [row.customerId, ...managersOf(row), ...(row.assignedCoordinatorId ? [row.assignedCoordinatorId] : [])], { titleAr: 'تم تأكيد حجزك بالاستثناء المعتمد', bodyAr: `${row.number}: «${row.body.titleAr}» مؤكد بالموعد والسعر المعتمدين.`, path: `/exceptions/${row.id}` });
  await tx.systemAuditLog.create({ data: { actorId: row.customerId, action: 'EXCEPTION_BOOKING_CONFIRMED', targetId: row.id, details: { requestId: booking.id } } });
}

/**
 * Applies an approved reschedule: the time, the price, the calendar reservation and the reminders change together, or nothing changes.
 * Needs the customer's approval of the price, the operational approval, a fresh availability check and the extra payment (if any).
 */
export async function finalizeReschedule(tx: Tx, row: any, cfg: ExceptionConfigBody, actor: { id: string | null; role: string }) {
  const offer = await acceptedOffer(tx, row.id); if (!offer) throw bad('لا يوجد عرض معتمد');
  const booking = await requestRow(tx, row.bookingRequestId, true), data = { ...booking.body } as any;
  if (booking.status !== 'CONFIRMED' || +booking.startAt !== +row.originalStartAt) throw bad('تغيّر الحجز الأصلي');
  const charge = data.rescheduleCharge, due = charge?.exceptionId === row.id ? charge.amountDue : null;
  if (due === null) throw bad('لا يوجد التزام مالي معتمد لهذا التعديل');
  const paidEnough = (data.paid ?? 0) - (charge.paidBaseline ?? 0) >= due;
  const inputs = await guardInputs(tx, row), end = new Date(+offer.startAt + (+booking.endAt - +booking.startAt));
  const guard = finalConfirmationGuard({ ...inputs, requestStartAt: offer.startAt, availabilityRechecked: true, paymentSatisfied: paidEnough });
  if (!guard.ok) throw bad('لا يمكن تعديل الموعد: ' + guard.missing.join('، '));
  const proposal = { ...data, date: offer.terms.date, time: offer.terms.time, startAt: new Date(offer.startAt).toISOString(), endAt: end.toISOString() };
  await calendarAndConflict(tx, proposal, booking.id, true, null, { intent: 'MODIFY', customerId: row.customerId, exception: { id: row.id, kind: 'RESCHEDULE' } });
  const netFee = Math.max(0, offer.exceptionFee - offer.discount);
  const price = priceWithCharge(data.price, { taxBps: data.policy.taxBps, commissionBps: data.policy.commissionBps }, netFee);
  if (price.total !== offer.total) throw bad('اختلف سعر الحجز عن العرض المعتمد؛ أعد إعداد العرض');
  const next = { ...proposal, price, rescheduleCharge: null, rescheduledFrom: { startAt: new Date(booking.startAt).toISOString(), date: data.date, time: data.time, exceptionId: row.id } };
  await saveRequest(tx, booking, next, 'CONFIRMED');
  await tx.$executeRaw`UPDATE "CommerceBooking" SET "body"="body" || ${JSON.stringify({ startAt: next.startAt, endAt: next.endAt })}::jsonb WHERE "requestId"=${booking.id}`;
  const fresh = await requestRow(tx, booking.id);
  await bookingReminders(tx, fresh);
  await bookingEvent(tx, fresh, actor.id ?? row.customerId, 'RESCHEDULE_EXCEPTION_APPLIED', 'CONFIRMED', { exceptionId: row.id, from: booking.startAt, to: next.startAt });
  let done = await system(tx, row, 'CONFIRM', cfg, { body: { confirmedAt: new Date().toISOString() } });
  done = await system(tx, done, 'COMPLETE', cfg); await closeTask(tx, done.id, 'DONE');
  await notify(tx, done, 'RESCHEDULE_APPLIED', [done.customerId, ...managersOf(done), ...(done.assignedCoordinatorId ? [done.assignedCoordinatorId] : [])], { titleAr: 'تم اعتماد تعديل موعد الحجز', bodyAr: `${done.number}: «${done.body.titleAr}» أصبح يوم ${offer.terms.date} الساعة ${offer.terms.time}.`, path: `/exceptions/${done.id}` });
  await tx.systemAuditLog.create({ data: { actorId: actor.id ?? row.customerId, action: 'EXCEPTION_RESCHEDULE_APPLIED', targetId: row.id, details: { requestId: booking.id, total: offer.total } } });
  return done;
}
/** A payment against a booking was verified: if it completes the charge of an approved reschedule, apply it. A failed re-check never undoes the verified payment. */
export async function onPaymentVerified(tx: Tx, booking: any) {
  const charge = booking.body.rescheduleCharge; if (!charge) return;
  let row = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${charge.exceptionId}`)[0];
  if (!row || row.status !== 'awaiting_payment' || (booking.body.paid ?? 0) - (charge.paidBaseline ?? 0) < charge.amountDue) return;
  await lock(tx, 'exception:' + row.id); row = await load(tx, row.id, false); const cfg = await loadConfig(tx);
  try { await finalizeReschedule(tx, row, cfg, { id: null, role: 'system' }); }
  catch (e) {
    if (!(e instanceof HttpError)) throw e;
    const fresh = await load(tx, row.id, false);
    if (isFinal(fresh.status)) return;
    const next = await system(tx, fresh, 'EXPIRE_OFFER', cfg, { body: { failure: e.message } }, { reason: e.message });
    await notify(tx, next, 'OFFER_EXPIRED', [next.customerId, ...(next.assignedCoordinatorId ? [next.assignedCoordinatorId] : []), ...await platformUserIds(tx)], { titleAr: 'تعذر تطبيق تعديل الموعد', bodyAr: `${next.number}: ${e.message}. حجزك الأصلي ما زال ساريًا. يمكن إعادة التفاوض.`, path: `/exceptions/${next.id}` });
  }
}

// ---- from the approved exception to the cart -----------------------------------------------------------------------------------------
/** Puts the approved booking in the customer's cart with the exception attached; the cart then prices it with the agreed fee and checks the waiver on the server. */
export async function addApprovedToCart(id: string) {
  const user = await requireUser(); await rateLimit('exception-cart:' + user.id, 30); await requireFeature('booking_exceptions');
  const row = (await prisma.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${id}`)[0];
  if (!row || row.customerId !== user.id) throw new HttpError(404, 'الطلب غير موجود');
  if (row.kind !== 'NOTICE' || row.status !== 'awaiting_payment') throw bad('الطلب ليس بانتظار الحجز والدفع');
  if (row.body.paymentDueAt && Date.parse(row.body.paymentDueAt) < Date.now()) throw bad('انتهت مهلة إتمام الحجز');
  const cart = (await prisma.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0] ?? { version: 0, body: { lines: [] } };
  const kept = (cart.body.lines ?? []).filter((l: any) => l.exceptionId !== id);
  const line = { ...row.selection, id: randomUUID(), date: row.requestedDate, time: row.requestedTime, exceptionId: id };
  await saveCart({ version: cart.version, lines: [...kept, line] });
  return { added: true };
}
