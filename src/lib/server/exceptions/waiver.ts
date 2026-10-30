import 'server-only';
import { HttpError } from '../http';
import { Tx } from '../booking/repository';
import { NoticeRequirement } from '@/lib/booking/advance-notice';
import { checkNotice, exceptionsEnabled } from './notice';

/** A customer's exception that has been approved on price and is waiting for the booking itself (and its payment) to complete. */
const WAITING = ['customer_approved', 'awaiting_payment'];

export interface WaiverQuery {
  exceptionId?: string | null;
  customerId?: string | null;
  kind: 'NOTICE' | 'RESCHEDULE';
  offerId: string; date: string; time: string;
  /** the booking being moved (reschedule) */
  bookingRequestId?: string | null;
}

/**
 * The exception that excuses this booking from the minimum notice, or null. It must belong to this customer, cover this very offer, date and time,
 * be approved on price by the customer and not have run out of time. It never excuses anything except the notice period.
 */
export async function resolveWaiver(tx: Tx, q: WaiverQuery): Promise<any | null> {
  if (!q.exceptionId || !q.customerId) return null;
  const row = (await tx.$queryRaw<any[]>`SELECT * FROM "ExceptionRequest" WHERE "id"=${q.exceptionId}`)[0];
  if (!row || row.customerId !== q.customerId || row.kind !== q.kind || !WAITING.includes(row.status)) return null;
  if (row.requestedDate !== q.date || row.requestedTime !== q.time) return null;
  if (q.kind === 'RESCHEDULE' ? row.bookingRequestId !== q.bookingRequestId : !(row.body.components ?? []).some((c: any) => c.offerId === q.offerId)) return null;
  const due = row.body.paymentDueAt ? Date.parse(row.body.paymentDueAt) : null;
  if (due !== null && due < Date.now()) return null;
  return row;
}

/**
 * The server-side gate for the minimum notice, used by the cart, checkout, confirmation and every reschedule. Throws a structured 409 (code ADVANCE_NOTICE)
 * the storefront turns into the notice dialog. An approved exception passes; a closed booking (cutoff) never does.
 */
export async function assertNotice(tx: Tx, input: WaiverQuery & { cityId: string; offsetMinutes?: number; extra?: NoticeRequirement[]; now?: number; effective?: any }): Promise<{ waived: boolean; exception?: any }> {
  const check = await checkNotice(tx, { offerId: input.offerId, cityId: input.cityId, date: input.date, time: input.time, offsetMinutes: input.offsetMinutes, extra: input.extra, now: input.now, effective: input.effective });
  const e = check.evaluation;
  if (e.ok) return { waived: false };
  if (!e.cutoffPassed) {
    const exception = await resolveWaiver(tx, input);
    if (exception) return { waived: true, exception };
  }
  throw new HttpError(409, e.cutoffPassed ? 'انتهى وقت قبول الحجوزات لهذه الخدمة' : 'الموعد أقرب من الحد الأدنى للمدة اللازمة لتجهيز الخدمة أو توفيرها', {
    code: 'ADVANCE_NOTICE', offerId: input.offerId, requiredMinutes: e.requiredMinutes, remainingMinutes: Math.max(0, e.remainingMinutes), earliestAt: e.earliestAt.toISOString(),
    cutoffPassed: e.cutoffPassed, canRequestException: (await exceptionsEnabled()) && e.canRequestException,
  });
}
