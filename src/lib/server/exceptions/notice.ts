import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from '../http';
import { effectiveOffering } from '../booking/config';
import { Tx } from '../booking/repository';
import { decideOffering } from '../availability/enforce';
import { featureStates } from '../features';
import { AdvanceNoticeRule, NoticeEvaluation, NoticeRequirement, evaluateNotice, normalizeAdvanceNotice, requiredMinutes, zonedInstant, DEFAULT_TIMEZONE } from '@/lib/booking/advance-notice';

export async function exceptionsEnabled(): Promise<boolean> {
  try { return !!(await featureStates()).find(f => f.id === 'booking_exceptions')?.enabled; } catch { return false; }
}

export interface NoticeCheck {
  offerId: string; serviceId: string | null; vendorId: string | null; titleAr: string; cityId: string;
  rule: AdvanceNoticeRule; requirements: NoticeRequirement[]; start: Date; evaluation: NoticeEvaluation;
}

/**
 * Every source of "how far ahead must this be booked" for one offer, in one place:
 *  - the service's own advance-notice rule (service form),
 *  - the offer's booking calendar (minimum notice hours),
 *  - the vendor's and legacy service's availability (minimum notice days),
 *  - an availability policy's minimum lead time.
 * The longest one decides. Used by the storefront check, the cart, checkout, confirmation and the exception request itself.
 */
export async function checkNotice(db: Tx | typeof prisma, input: { offerId: string; cityId: string; date: string; time: string; now?: number; /** a component that starts later than the booking start (package items) */ offsetMinutes?: number; /** requirements recorded on an existing request (its policy snapshot) */ extra?: NoticeRequirement[]; /** the offering the caller has already loaded, to avoid reading it again */ effective?: Awaited<ReturnType<typeof effectiveOffering>> }): Promise<NoticeCheck> {
  const tx = db as Tx;
  const effective = input.effective ?? await effectiveOffering(tx, input.offerId);
  const serviceId: string | null = effective.offering.commerceServiceId ?? null;
  const commerce = serviceId ? (await tx.$queryRaw<any[]>`SELECT "id","vendorId","body" FROM "CommerceService" WHERE "id"=${serviceId}`)[0] : null;
  const rule = normalizeAdvanceNotice(commerce?.body?.advanceNotice);
  const requirements: NoticeRequirement[] = [];
  const add = (source: string, minutes: number) => { if (minutes > 0) requirements.push({ source, minutes }); };
  add('service', requiredMinutes(rule));
  add('offer', (effective.policy.calendar.minNoticeHours ?? 0) * 60);
  for (const e of input.extra ?? []) add(e.source, e.minutes);
  for (const person of effective.people) add('person', (person.body.calendar?.minNoticeHours ?? 0) * 60);
  for (const [source, availability] of [['service-availability', effective.service?.availability], ['vendor-availability', effective.vendor?.availability]] as const) add(source, (availability?.minNoticeDays ?? 0) * 1440);
  let start: Date;
  try { start = new Date(+zonedInstant(input.date, input.time, rule.timezone || DEFAULT_TIMEZONE) + (input.offsetMinutes ?? 0) * 60000); } catch (e: any) { throw new HttpError(400, e.message); }
  const loaded = await decideOffering(tx, { offeringId: input.offerId, cityId: input.cityId, date: input.date, time: input.time, quantity: 1, intent: 'VIEW', noLock: true, waiveLeadTime: true });
  add('availability-policy', (loaded?.decision.restrictions?.minLeadHours ?? 0) * 60);
  const evaluation = evaluateNotice({ start, now: input.now, requirements, allowExceptionRequests: rule.allowExceptionRequests, cutoffAt: rule.cutoffAt });
  return { offerId: input.offerId, serviceId, vendorId: commerce?.vendorId ?? null, titleAr: effective.offering.titleAr, cityId: input.cityId, rule, requirements, start, evaluation };
}

/** What a customer may be told about a check (no internal sources or rule details beyond what the dialog needs). */
export function publicNotice(check: NoticeCheck, exceptionsOn: boolean) {
  const e = check.evaluation;
  return {
    ok: e.ok, requiredMinutes: e.requiredMinutes, remainingMinutes: Math.max(0, e.remainingMinutes), earliestAt: e.earliestAt.toISOString(),
    cutoffPassed: e.cutoffPassed, canRequestException: exceptionsOn && e.canRequestException, exceptionsOn, startAt: check.start.toISOString(),
  };
}
