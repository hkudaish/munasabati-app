import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from '../http';
import { atomic } from '../booking/repository';
import { escalationLevel } from '@/lib/exceptions/machine';
import { loadConfig, load, platformUserIds, system } from './workflow';
import { notify, deliverQueued } from './notify';
import { exceptionsEnabled } from './notice';
import { clearChargeOf } from './actions';

/**
 * The time-driven part of the workflow, run every 15 minutes by the existing notifications cron (and on demand by an administrator):
 *  1. offers whose validity ran out are expired,
 *  2. approved requests whose payment window ran out are expired (a reschedule's original booking is untouched),
 *  3. expired offers nobody reopened are cancelled after the configured days,
 *  4. requests past their response target are escalated to the platform, one level at a time,
 *  5. queued messages are delivered.
 * Every step re-reads the row under its lock, so running it twice (or alongside a person's action) cannot do anything twice.
 */
export async function sweepExceptions() {
  const result = { offersExpired: 0, paymentWindowsExpired: 0, cancelled: 0, escalated: 0, delivered: { sent: 0, skipped: 0, failed: 0 } };
  if (!await exceptionsEnabled()) return { ...result, disabled: true };
  const cfg = await loadConfig(prisma), now = Date.now();

  for (const o of await prisma.$queryRaw<{ requestId: string }[]>`SELECT DISTINCT "requestId" FROM "ExceptionOffer" WHERE "status"='SENT' AND "expiresAt" < CURRENT_TIMESTAMP LIMIT 50`) {
    const done = await atomic(async tx => {
      const row = await load(tx, o.requestId);
      const stale = await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"='EXPIRED',"decidedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "status"='SENT' AND "expiresAt" < CURRENT_TIMESTAMP`;
      if (!stale || row.status !== 'awaiting_customer_approval') return false;
      await tx.$executeRaw`UPDATE "ExceptionApprovalStep" SET "status"='SUPERSEDED',"decidedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "stage"='CUSTOMER_PRICE' AND "status"='PENDING'`;
      const next = await system(tx, row, 'EXPIRE_OFFER', cfg, {}, { reason: 'offer_validity' });
      await notify(tx, next, 'OFFER_EXPIRED', [next.customerId, ...(next.assignedCoordinatorId ? [next.assignedCoordinatorId] : []), ...await platformUserIds(tx)], { titleAr: 'انتهت صلاحية عرض الاستثناء', bodyAr: `${next.number}: انتهت صلاحية العرض دون قرار. يمكن للمنسق إصدار عرض جديد عند الحاجة.`, path: `/exceptions/${next.id}` });
      return true;
    }).catch(e => { if (e instanceof HttpError) return false; throw e; });
    if (done) result.offersExpired++;
  }

  for (const r of await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ExceptionRequest" WHERE "status"='awaiting_payment' AND ("body"->>'paymentDueAt')::timestamptz < CURRENT_TIMESTAMP LIMIT 50`) {
    const done = await atomic(async tx => {
      const row = await load(tx, r.id);
      if (row.status !== 'awaiting_payment') return false;
      await tx.$executeRaw`UPDATE "ExceptionOffer" SET "status"='EXPIRED',"decidedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "status"='ACCEPTED'`;
      await clearChargeOf(tx, row);
      const next = await system(tx, row, 'EXPIRE_OFFER', cfg, {}, { reason: 'payment_window' });
      await notify(tx, next, 'OFFER_EXPIRED', [next.customerId, ...(next.assignedCoordinatorId ? [next.assignedCoordinatorId] : [])], { titleAr: 'انتهت مهلة إتمام الحجز', bodyAr: `${next.number}: لم يكتمل الدفع في المهلة المحددة، فانتهت صلاحية العرض.${next.kind === 'RESCHEDULE' ? ' حجزك الأصلي ما زال ساريًا.' : ''}`, path: `/exceptions/${next.id}` });
      return true;
    }).catch(e => { if (e instanceof HttpError) return false; throw e; });
    if (done) result.paymentWindowsExpired++;
  }

  for (const r of await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ExceptionRequest" WHERE "status"='offer_expired' AND "stateEnteredAt" < ${new Date(now - cfg.expiredOfferCancelDays * 86400000)} LIMIT 50`) {
    const done = await atomic(async tx => {
      const row = await load(tx, r.id);
      if (row.status !== 'offer_expired') return false;
      await tx.$executeRaw`UPDATE "CoordinatorTask" SET "status"='CANCELLED',"closedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "status" IN ('OPEN','IN_PROGRESS')`;
      const next = await system(tx, row, 'CANCEL', cfg, { body: { closingNote: 'انتهت مهلة إعادة فتح العرض' } }, { reason: 'expired_offer_not_reopened' });
      await notify(tx, next, 'CANCELLED', [next.customerId], { titleAr: 'أُغلق طلب الاستثناء', bodyAr: `${next.number}: أُغلق الطلب لانتهاء مهلة إعادة فتحه. يمكنك تقديم طلب جديد.`, path: `/exceptions/${next.id}` });
      return true;
    }).catch(e => { if (e instanceof HttpError) return false; throw e; });
    if (done) result.cancelled++;
  }

  const late = await prisma.$queryRaw<any[]>`SELECT "id","dueAt","body","status" FROM "ExceptionRequest" WHERE "dueAt" < CURRENT_TIMESTAMP AND "status" NOT IN ('completed','rejected','customer_declined','cancelled','execution_unavailable','confirmed') LIMIT 200`;
  for (const r of late) {
    const level = escalationLevel(+r.dueAt, now, cfg);
    if (level <= Number(r.body?.escalation ?? 0)) continue;
    await atomic(async tx => {
      const row = await load(tx, r.id);
      if (level <= Number(row.body?.escalation ?? 0) || !row.dueAt) return;
      // the escalation level is bookkeeping, not a decision: it does not change the version a person's screen holds
      await tx.$executeRaw`UPDATE "ExceptionRequest" SET "body"="body" || ${JSON.stringify({ escalation: level })}::jsonb WHERE "id"=${row.id}`;
      await tx.$executeRaw`UPDATE "CoordinatorTask" SET "escalationLevel"=${level},"escalatedAt"=CURRENT_TIMESTAMP WHERE "requestId"=${row.id} AND "status" IN ('OPEN','IN_PROGRESS')`;
      await notify(tx, row, 'ESCALATED', await platformUserIds(tx), { titleAr: 'طلب استثناء تجاوز مهلته', bodyAr: `${row.number}: «${row.body.titleAr}» تجاوز مهلة الاستجابة (المستوى ${level}).`, path: `/exceptions/${row.id}` }, { once: 'level' + level });
    }).catch(e => { if (!(e instanceof HttpError)) throw e; });
    result.escalated++;
  }
  result.delivered = await deliverQueued();
  return result;
}
