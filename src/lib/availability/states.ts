import { BOOKING_MODES, ENTITY_TYPES, GEO_EFFECTS, PolicyGeoRule, PolicySchedule, Policy, Restrictions, SCHEDULE_KINDS, STATUSES, Status, SuspensionPolicy, VISIBILITY } from './types';

/** Allowed changes of the configured status. Everything can return to ACTIVE; a disabled or announced service must be restored
    (or launched) before it can be suspended or put into maintenance. */
export const TRANSITIONS: Record<Status, Status[]> = {
  ACTIVE: ['PARTIALLY_AVAILABLE', 'COMING_SOON', 'TEMPORARILY_SUSPENDED', 'DISABLED', 'MAINTENANCE'],
  PARTIALLY_AVAILABLE: ['ACTIVE', 'COMING_SOON', 'TEMPORARILY_SUSPENDED', 'DISABLED', 'MAINTENANCE'],
  COMING_SOON: ['ACTIVE', 'PARTIALLY_AVAILABLE', 'DISABLED'],
  TEMPORARILY_SUSPENDED: ['ACTIVE', 'PARTIALLY_AVAILABLE', 'DISABLED', 'MAINTENANCE'],
  DISABLED: ['ACTIVE', 'PARTIALLY_AVAILABLE', 'COMING_SOON'],
  MAINTENANCE: ['ACTIVE', 'PARTIALLY_AVAILABLE', 'TEMPORARILY_SUSPENDED', 'DISABLED'],
};
export const canTransition = (from: Status, to: Status) => from === to || TRANSITIONS[from].includes(to);

export class PolicyError extends Error { constructor(message: string) { super(message); } }
const fail = (message: string): never => { throw new PolicyError(message); };
const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/, SLOT = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
const validDate = (v: unknown) => typeof v === 'string' && DATE.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const stringList = (v: unknown, name: string, max = 200) => { if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || !x || x.length > 100)) fail(`${name} غير صالحة`); return v as string[]; };
const nonNegativeInt = (v: unknown, name: string, max: number) => { if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) fail(`${name} غير صالحة`); return v as number; };

export function validateRestrictions(value: unknown): Restrictions {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) return fail('القيود غير صالحة');
  const allowed = ['cities', 'vendorIds', 'offerIds', 'maxBookingsPerDay', 'allowedTimeSlots', 'maxQuantity', 'minLeadHours', 'launchDate'];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('قيد غير معروف: ' + key);
  const out: Restrictions = {};
  if (value.cities !== undefined) out.cities = stringList(value.cities, 'مدن القيد');
  if (value.vendorIds !== undefined) out.vendorIds = stringList(value.vendorIds, 'موردو القيد');
  if (value.offerIds !== undefined) out.offerIds = stringList(value.offerIds, 'عروض القيد');
  if (value.maxBookingsPerDay !== undefined) out.maxBookingsPerDay = nonNegativeInt(value.maxBookingsPerDay, 'الحد اليومي للحجوزات', 100000);
  if (value.maxQuantity !== undefined) out.maxQuantity = nonNegativeInt(value.maxQuantity, 'أقصى كمية', 100000);
  if (value.minLeadHours !== undefined) out.minLeadHours = nonNegativeInt(value.minLeadHours, 'أقل مهلة حجز', 8760);
  if (value.allowedTimeSlots !== undefined) { const slots = stringList(value.allowedTimeSlots, 'فترات الحجز', 24); if (slots.some(s => !SLOT.test(s))) fail('فترات الحجز بصيغة 16:00-20:00'); out.allowedTimeSlots = slots; }
  if (value.launchDate !== undefined) { if (!validDate(value.launchDate)) fail('تاريخ الإطلاق غير صالح'); out.launchDate = value.launchDate as string; }
  return out;
}
export const hasRestriction = (r: Restrictions) => Object.keys(r).some(k => k !== 'launchDate');

export function validateSchedule(value: unknown): PolicySchedule {
  if (!isObject(value)) return fail('الجدول غير صالح');
  const kind = value.kind ?? 'OPERATING';
  if (!SCHEDULE_KINDS.includes(kind)) fail('نوع الجدول غير صالح');
  for (const key of ['startTime', 'endTime']) if (value[key] != null && !(TIME.test(value[key]) || (key === 'endTime' && value[key] === '24:00'))) fail('وقت الجدول بصيغة HH:MM');
  if (value.dayOfWeek != null && (!Number.isInteger(value.dayOfWeek) || value.dayOfWeek < 0 || value.dayOfWeek > 6)) fail('يوم الأسبوع غير صالح');
  for (const key of ['startDate', 'endDate']) if (value[key] != null && !validDate(value[key])) fail('تاريخ الجدول غير صالح');
  if (value.startDate && value.endDate && value.endDate < value.startDate) fail('نهاية الفترة قبل بدايتها');
  if (value.maxBookings != null) nonNegativeInt(value.maxBookings, 'الحد الأقصى للحجوزات', 100000);
  if (value.timezone != null) { try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { fail('المنطقة الزمنية غير صالحة'); } }
  if ((kind === 'EXCEPTION' || kind === 'HOLIDAY') && !value.startDate) fail('الإغلاق يحتاج تاريخاً');
  if (kind === 'MAINTENANCE' && !value.startDate) fail('الصيانة المجدولة تحتاج تاريخ بداية');
  if (kind === 'OPERATING' && (value.startTime == null) !== (value.endTime == null)) fail('حدد وقت البداية والنهاية معاً');
  return { kind, timezone: value.timezone ?? 'Asia/Riyadh', startTime: value.startTime ?? null, endTime: value.endTime ?? null, dayOfWeek: value.dayOfWeek ?? null, startDate: value.startDate ?? null, endDate: value.endDate ?? null, maxBookings: value.maxBookings ?? null, isEnabled: value.isEnabled !== false };
}
export function validateGeoRule(value: unknown): PolicyGeoRule {
  if (!isObject(value)) return fail('القاعدة الجغرافية غير صالحة');
  const effect = value.geographicEffect ?? 'ALLOW';
  if (!GEO_EFFECTS.includes(effect)) fail('أثر القاعدة الجغرافية غير صالح');
  if (!value.countryCode && !value.regionId && !value.cityId) fail('حدد دولة أو منطقة أو مدينة');
  for (const key of ['countryCode', 'regionId', 'cityId']) if (value[key] != null && (typeof value[key] !== 'string' || value[key].length > 100)) fail('معرّف جغرافي غير صالح');
  if (value.statusOverride != null && !STATUSES.includes(value.statusOverride)) fail('حالة القاعدة الجغرافية غير صالحة');
  for (const key of ['effectiveFrom', 'effectiveUntil']) if (value[key] != null && !Number.isFinite(Date.parse(value[key]))) fail('تاريخ القاعدة الجغرافية غير صالح');
  if (value.effectiveFrom && value.effectiveUntil && Date.parse(value.effectiveUntil) <= Date.parse(value.effectiveFrom)) fail('نهاية القاعدة قبل بدايتها');
  return { countryCode: value.countryCode ?? null, regionId: value.regionId ?? null, cityId: value.cityId ?? null, geographicEffect: effect, statusOverride: value.statusOverride ?? null, restrictionConfig: validateRestrictions(value.restrictionConfig), effectiveFrom: value.effectiveFrom ?? null, effectiveUntil: value.effectiveUntil ?? null };
}
function validateSuspension(value: unknown): SuspensionPolicy {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) return fail('سياسة الإيقاف غير صالحة');
  for (const key of Object.keys(value)) if (!['existingBookings', 'expectedResumeDate'].includes(key)) fail('حقل غير معروف في سياسة الإيقاف');
  if (value.existingBookings !== undefined && !['CONTINUE', 'BLOCK', 'REVIEW'].includes(value.existingBookings)) fail('سياسة الحجوزات القائمة غير صالحة');
  if (value.expectedResumeDate !== undefined && !validDate(value.expectedResumeDate)) fail('تاريخ الاستئناف المتوقع غير صالح');
  return { ...(value.existingBookings ? { existingBookings: value.existingBookings } : {}), ...(value.expectedResumeDate ? { expectedResumeDate: value.expectedResumeDate } : {}) };
}
const message = (v: unknown, name: string) => { if (v === undefined || v === null || v === '') return undefined; if (typeof v !== 'string' || v.length > 300) fail(name + ' أطول من المسموح (300 حرف)'); return (v as string).trim(); };

export interface PolicyInput { entityType: string; entityId: string; configuredStatus?: string; visibilityMode?: string; bookingMode?: string; priority?: number; restrictionConfig?: unknown; suspensionPolicy?: unknown; publicMessage?: unknown; effectiveFrom?: string | null; effectiveUntil?: string | null; autoActivate?: boolean; reason?: string | null; geoRules?: unknown[]; schedules?: unknown[] }
/** Validates a policy as a whole, including the rules that depend on the chosen status. Throws PolicyError (Arabic message). */
export function validatePolicy(input: unknown, modules: string[] = []): Omit<Policy, 'id' | 'version'> {
  if (!isObject(input)) return fail('السياسة غير صالحة');
  const entityType = input.entityType, entityId = input.entityId;
  if (!ENTITY_TYPES.includes(entityType)) fail('نوع الكيان غير صالح');
  if (typeof entityId !== 'string' || !entityId.trim() || entityId.length > 140) fail('معرّف الكيان مطلوب');
  if (entityType === 'PLATFORM' && entityId !== 'platform') fail('سياسة المنصة معرّفها platform');
  if (entityType === 'MODULE' && modules.length && !modules.includes(entityId)) fail('الوحدة غير معروفة');
  const configuredStatus: Status = input.configuredStatus ?? 'ACTIVE';
  if (!STATUSES.includes(configuredStatus)) fail('حالة الإتاحة غير صالحة');
  const visibilityMode = input.visibilityMode ?? 'AUTO', bookingMode = input.bookingMode ?? 'ENABLED';
  if (!VISIBILITY.includes(visibilityMode)) fail('وضع الظهور غير صالح');
  if (!BOOKING_MODES.includes(bookingMode)) fail('وضع الحجز غير صالح');
  const priority = input.priority ?? 0;
  if (!Number.isInteger(priority) || priority < -100 || priority > 100) fail('الأولوية بين -100 و100');
  for (const key of ['effectiveFrom', 'effectiveUntil']) if (input[key] != null && !Number.isFinite(Date.parse(input[key]))) fail('تاريخ السريان غير صالح');
  if (input.effectiveFrom && input.effectiveUntil && Date.parse(input.effectiveUntil) <= Date.parse(input.effectiveFrom)) fail('نهاية السريان يجب أن تلي بدايته');
  const restrictionConfig = validateRestrictions(input.restrictionConfig);
  const suspensionPolicy = validateSuspension(input.suspensionPolicy);
  if (input.publicMessage !== undefined && !isObject(input.publicMessage)) fail('الرسالة العامة غير صالحة');
  const publicMessage = { ...(message(input.publicMessage?.ar, 'الرسالة العربية') ? { ar: message(input.publicMessage?.ar, 'الرسالة العربية') } : {}), ...(message(input.publicMessage?.en, 'الرسالة الإنجليزية') ? { en: message(input.publicMessage?.en, 'الرسالة الإنجليزية') } : {}) };
  const reason = input.reason == null ? null : typeof input.reason === 'string' && input.reason.length <= 500 ? input.reason.trim() || null : fail('السبب أطول من المسموح');
  const geoRules = (input.geoRules ?? []) as unknown[], schedules = (input.schedules ?? []) as unknown[];
  if (!Array.isArray(geoRules) || geoRules.length > 200 || !Array.isArray(schedules) || schedules.length > 100) fail('القواعد أو الجداول كثيرة');
  const rules = geoRules.map(validateGeoRule), sched = schedules.map(validateSchedule);
  const seen = new Set<string>();
  for (const r of rules) { const key = [r.countryCode ?? '', r.regionId ?? '', r.cityId ?? ''].join('|'); if (seen.has(key)) fail('قاعدة جغرافية مكررة لنفس المكان'); seen.add(key); }
  // state-dependent requirements
  if (configuredStatus === 'PARTIALLY_AVAILABLE' && !hasRestriction(restrictionConfig) && !rules.some(r => hasRestriction(r.restrictionConfig ?? {}) || r.statusOverride || r.geographicEffect === 'DENY')) fail('الإتاحة الجزئية تتطلب قيداً واحداً على الأقل');
  if (configuredStatus === 'TEMPORARILY_SUSPENDED' && !reason) fail('اكتب سبب الإيقاف المؤقت');
  if (configuredStatus === 'COMING_SOON' && input.autoActivate === true && !restrictionConfig.launchDate) fail('التفعيل التلقائي يتطلب تاريخ إطلاق');
  if (input.autoActivate === true && configuredStatus !== 'COMING_SOON') fail('التفعيل التلقائي خاص بحالة «قريباً»');
  if (configuredStatus === 'ACTIVE' && bookingMode === 'CONDITIONAL' && !hasRestriction(restrictionConfig) && !rules.some(r => hasRestriction(r.restrictionConfig ?? {}))) fail('الحجز المشروط يتطلب قيداً واحداً على الأقل');
  return { entityType, entityId: entityId.trim(), configuredStatus, visibilityMode, bookingMode, priority, restrictionConfig, suspensionPolicy, publicMessage, effectiveFrom: input.effectiveFrom ?? null, effectiveUntil: input.effectiveUntil ?? null, autoActivate: input.autoActivate === true, reason, geoRules: rules, schedules: sched };
}
