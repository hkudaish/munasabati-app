// Advance-booking rules: how much notice a service needs, and whether a requested time respects it.
// Pure and deterministic (no database, no clock unless passed in), so the same function decides in the storefront, the cart,
// checkout, confirmation and the exception workflow. Money is not involved here.

export const NOTICE_UNITS = ['minute', 'hour', 'day', 'week'] as const;
export type NoticeUnit = typeof NOTICE_UNITS[number];
export const UNIT_MINUTES: Record<NoticeUnit, number> = { minute: 1, hour: 60, day: 1440, week: 10080 };
export const UNIT_LABELS_AR: Record<NoticeUnit, [string, string, string]> = { minute: ['دقيقة', 'دقيقتان', 'دقائق'], hour: ['ساعة', 'ساعتان', 'ساعات'], day: ['يوم', 'يومان', 'أيام'], week: ['أسبوع', 'أسبوعان', 'أسابيع'] };
export const DEFAULT_TIMEZONE = 'Asia/Riyadh';
const MAX_NOTICE_MINUTES = 365 * 1440;

export interface AdvanceNoticeRule {
  /** Whether the rule applies at all. */
  enabled: boolean;
  value: number;
  unit: NoticeUnit;
  /** Customers may ask for an exception when the notice is not met. */
  allowExceptionRequests: boolean;
  /** Time the provider needs to prepare before the event. The required notice is never shorter than this. */
  preparationMinutes: number;
  /** How long the service itself takes (informational for the request form and the calendar). */
  serviceDurationMinutes: number;
  /** IANA zone in which the service's dates and times are read. */
  timezone: string;
  /** After this instant the service takes no new bookings at all (no exception either). */
  cutoffAt: string | null;
}
export const defaultAdvanceNotice = (): AdvanceNoticeRule => ({ enabled: false, value: 0, unit: 'hour', allowExceptionRequests: true, preparationMinutes: 0, serviceDurationMinutes: 0, timezone: DEFAULT_TIMEZONE, cutoffAt: null });

const whole = (v: unknown, max: number, label: string) => { const n = v === undefined || v === null || v === '' ? 0 : Number(v); if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(label); return n; };
export function validTimezone(tz: string) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } }

/** Validates and normalises a rule coming from a form or an API body. Throws an Arabic message for the first problem. */
export function normalizeAdvanceNotice(input: any): AdvanceNoticeRule {
  const base = defaultAdvanceNotice();
  if (input === undefined || input === null) return base;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('قاعدة الحجز المسبق غير صالحة');
  const unit = (input.unit ?? base.unit) as NoticeUnit;
  if (!NOTICE_UNITS.includes(unit)) throw new Error('وحدة مدة الحجز المسبق غير صالحة');
  const timezone = String(input.timezone ?? base.timezone);
  if (!validTimezone(timezone)) throw new Error('المنطقة الزمنية غير صالحة');
  let cutoffAt: string | null = null;
  if (input.cutoffAt) { const t = Date.parse(String(input.cutoffAt)); if (!Number.isFinite(t)) throw new Error('وقت إغلاق الحجز غير صالح'); cutoffAt = new Date(t).toISOString(); }
  const rule: AdvanceNoticeRule = {
    enabled: input.enabled === true,
    value: whole(input.value, MAX_NOTICE_MINUTES, 'مدة الحجز المسبق غير صالحة'),
    unit,
    allowExceptionRequests: input.allowExceptionRequests !== false,
    preparationMinutes: whole(input.preparationMinutes, MAX_NOTICE_MINUTES, 'مدة التجهيز غير صالحة'),
    serviceDurationMinutes: whole(input.serviceDurationMinutes, MAX_NOTICE_MINUTES, 'مدة التنفيذ غير صالحة'),
    timezone,
    cutoffAt,
  };
  if (rule.value * UNIT_MINUTES[unit] > MAX_NOTICE_MINUTES) throw new Error('مدة الحجز المسبق تتجاوز سنة');
  return rule;
}

/** Minutes of notice the rule demands: the stated minimum, or the preparation time if that is longer. 0 when the rule is off. */
export function requiredMinutes(rule: AdvanceNoticeRule | null | undefined): number {
  if (!rule || !rule.enabled) return 0;
  return Math.max(rule.value * UNIT_MINUTES[rule.unit], rule.preparationMinutes);
}

/** Reads a local date (YYYY-MM-DD) and time (HH:MM) in an IANA time zone and returns the instant. Invalid input throws. */
export function zonedInstant(date: string, time: string, timezone = DEFAULT_TIMEZONE): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('التاريخ أو الوقت غير صالح');
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  if (new Date(asUtc).getUTCMonth() !== m - 1) throw new Error('التاريخ غير صالح');
  // offset of the zone at that wall-clock time (two passes settle around daylight-saving changes)
  const offsetAt = (instant: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant;
  };
  let guess = asUtc - offsetAt(asUtc);
  guess = asUtc - offsetAt(guess);
  return new Date(guess);
}

/** One source of a notice requirement: the service rule, the offer's calendar, the vendor's availability, and so on. */
export interface NoticeRequirement { source: string; minutes: number; }
export interface NoticeEvaluation {
  ok: boolean;
  requiredMinutes: number;
  remainingMinutes: number;
  /** Earliest start that satisfies every requirement, measured from `now`. */
  earliestAt: Date;
  /** Which requirement is the longest. */
  limitingSource: string | null;
  cutoffPassed: boolean;
  /** An exception may be requested: not satisfied, the service accepts exceptions, and the booking is not closed. */
  canRequestException: boolean;
}
/** Compares the time left until `start` with the longest requirement. */
export function evaluateNotice(input: { start: Date; now?: number; requirements: NoticeRequirement[]; allowExceptionRequests?: boolean; cutoffAt?: string | null }): NoticeEvaluation {
  const now = input.now ?? Date.now();
  const longest = input.requirements.reduce<NoticeRequirement | null>((best, r) => (r.minutes > (best?.minutes ?? 0) ? r : best), null);
  const required = longest?.minutes ?? 0;
  const remaining = Math.floor((+input.start - now) / 60000);
  const cutoffPassed = !!input.cutoffAt && now >= Date.parse(input.cutoffAt);
  const ok = !cutoffPassed && remaining >= required;
  return { ok, requiredMinutes: required, remainingMinutes: remaining, earliestAt: new Date(now + required * 60000), limitingSource: longest?.source ?? null, cutoffPassed, canRequestException: !ok && !cutoffPassed && (input.allowExceptionRequests ?? true) && remaining > 0 };
}

export interface PackageNoticeItem { label: string; offerId: string; evaluation: NoticeEvaluation; optional?: boolean }
export interface PackageNoticeResult {
  /** True when every mandatory component is satisfied. */
  ok: boolean;
  /** Mandatory components that fail. */
  blocking: PackageNoticeItem[];
  /** Optional components that fail (they can be dropped). */
  droppable: PackageNoticeItem[];
  /** The component that needs the longest preparation. */
  longest: PackageNoticeItem | null;
  /** An exception is possible only if every failing mandatory component allows one. */
  canRequestException: boolean;
}
/** A package is judged component by component; components do not share one lead time. */
export function evaluatePackageNotice(items: PackageNoticeItem[]): PackageNoticeResult {
  const failing = items.filter(i => !i.evaluation.ok);
  const blocking = failing.filter(i => !i.optional), droppable = failing.filter(i => i.optional);
  const longest = items.reduce<PackageNoticeItem | null>((b, i) => (i.evaluation.requiredMinutes > (b?.evaluation.requiredMinutes ?? -1) ? i : b), null);
  return { ok: blocking.length === 0, blocking, droppable, longest, canRequestException: blocking.length > 0 && blocking.every(i => i.evaluation.canRequestException) };
}

/** A short phrase for a number of minutes: "يومان", "3 ساعات", "ساعة و30 دقيقة" (or "2 days", "3 hours", "1 hour 30 minutes"). */
export function describeMinutes(total: number, lang: 'ar' | 'en' = 'ar'): string {
  const m = Math.max(0, Math.round(total));
  if (lang === 'en') {
    const en = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    if (m === 0) return 'less than a minute';
    for (const [unit, size] of [['week', 10080], ['day', 1440], ['hour', 60]] as const) if (m % size === 0) return en(m / size, unit);
    if (m >= 1440) { const d = Math.floor(m / 1440), h = Math.round((m % 1440) / 60); return h ? `${en(d, 'day')} ${en(h, 'hour')}` : en(d, 'day'); }
    if (m >= 60) { const h = Math.floor(m / 60), r = m % 60; return r ? `${en(h, 'hour')} ${en(r, 'minute')}` : en(h, 'hour'); }
    return en(m, 'minute');
  }
  const phrase = (n: number, unit: NoticeUnit) => { const [one, two, many] = UNIT_LABELS_AR[unit]; return n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${many}` : `${n} ${one}`; };
  if (m === 0) return 'أقل من دقيقة';
  for (const unit of ['week', 'day', 'hour'] as const) if (m % UNIT_MINUTES[unit] === 0) return phrase(m / UNIT_MINUTES[unit], unit);
  if (m >= 1440) { const d = Math.floor(m / 1440), h = Math.round((m % 1440) / 60); return h ? `${phrase(d, 'day')} و${phrase(h, 'hour')}` : phrase(d, 'day'); }
  if (m >= 60) { const h = Math.floor(m / 60), r = m % 60; return r ? `${phrase(h, 'hour')} و${phrase(r, 'minute')}` : phrase(h, 'hour'); }
  return phrase(m, 'minute');
}
