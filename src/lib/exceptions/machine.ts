// The exception-request state machine, approval guards, priorities and offer arithmetic.
// Pure and deterministic: the server calls it inside a transaction, the tests call it directly, and the screens use the same labels.
// Nothing here reads a database or a clock unless a value is passed in.

export const STATUSES = [
  'submitted', 'under_review', 'awaiting_provider_approval', 'feasibility_approved', 'assigned_to_coordinator', 'negotiating', 'offer_prepared',
  'awaiting_customer_approval', 'customer_approved', 'awaiting_payment', 'confirmed', 'completed',
  'information_required', 'alternative_proposed', 'rejected', 'customer_declined', 'offer_expired', 'cancelled', 'execution_unavailable',
] as const;
export type ExceptionStatus = typeof STATUSES[number];
/** No action can leave these. */
export const FINAL_STATUSES: readonly ExceptionStatus[] = ['completed', 'rejected', 'customer_declined', 'cancelled', 'execution_unavailable'];
export const isFinal = (s: string) => (FINAL_STATUSES as readonly string[]).includes(s);

export const STATUS_LABELS: Record<ExceptionStatus, string> = {
  submitted: 'تم تقديم الطلب', under_review: 'قيد المراجعة', awaiting_provider_approval: 'بانتظار موافقة مقدم الخدمة', feasibility_approved: 'تمت الموافقة التشغيلية',
  assigned_to_coordinator: 'أُسند إلى منسق', negotiating: 'قيد التفاوض', offer_prepared: 'تم إعداد العرض', awaiting_customer_approval: 'بانتظار اعتماد العميل',
  customer_approved: 'وافق العميل', awaiting_payment: 'بانتظار الدفع', confirmed: 'تم تأكيد الحجز', completed: 'مكتمل ومؤكد',
  information_required: 'مطلوب استكمال معلومات', alternative_proposed: 'اقتُرح موعد بديل', rejected: 'مرفوض', customer_declined: 'رفض العميل العرض',
  offer_expired: 'انتهت صلاحية العرض', cancelled: 'ملغى', execution_unavailable: 'تعذر التنفيذ',
};

export type Actor = 'customer' | 'provider' | 'platform' | 'coordinator' | 'supervisor' | 'system';
export const ACTIONS = [
  'REVIEW', 'REQUEST_PROVIDER', 'APPROVE_FEASIBILITY', 'REJECT', 'PROPOSE_ALTERNATIVE', 'ACCEPT_ALTERNATIVE', 'DECLINE_ALTERNATIVE', 'REQUEST_INFO', 'PROVIDE_INFO',
  'ASSIGN', 'REASSIGN', 'START_NEGOTIATION', 'PREPARE_OFFER', 'APPROVE_OFFER', 'SEND_OFFER', 'CUSTOMER_ACCEPT', 'CUSTOMER_DECLINE', 'CUSTOMER_RENEGOTIATE', 'EXPIRE_OFFER', 'REOPEN_NEGOTIATION',
  'REQUEST_PAYMENT', 'CONFIRM', 'COMPLETE', 'MARK_UNAVAILABLE', 'CANCEL',
] as const;
export type ExceptionAction = typeof ACTIONS[number];

export const ACTION_LABELS: Record<ExceptionAction, string> = {
  REVIEW: 'بدء المراجعة', REQUEST_PROVIDER: 'إحالة إلى مقدم الخدمة', APPROVE_FEASIBILITY: 'موافقة مبدئية على إمكانية التنفيذ', REJECT: 'رفض', PROPOSE_ALTERNATIVE: 'اقتراح موعد بديل',
  ACCEPT_ALTERNATIVE: 'قبول الموعد البديل', DECLINE_ALTERNATIVE: 'رفض الموعد البديل', REQUEST_INFO: 'طلب معلومات إضافية', PROVIDE_INFO: 'إرسال المعلومات المطلوبة',
  ASSIGN: 'إسناد إلى منسق', REASSIGN: 'تغيير المنسق', START_NEGOTIATION: 'بدء التفاوض', PREPARE_OFFER: 'إعداد عرض', APPROVE_OFFER: 'اعتماد المشرف للعرض', SEND_OFFER: 'إرسال العرض إلى العميل',
  CUSTOMER_ACCEPT: 'قبول العرض', CUSTOMER_DECLINE: 'رفض العرض', CUSTOMER_RENEGOTIATE: 'طلب إعادة التفاوض', EXPIRE_OFFER: 'انتهاء صلاحية العرض', REOPEN_NEGOTIATION: 'إعادة فتح التفاوض',
  REQUEST_PAYMENT: 'طلب الدفع', CONFIRM: 'تأكيد الحجز', COMPLETE: 'إغلاق الطلب', MARK_UNAVAILABLE: 'تعذر التنفيذ', CANCEL: 'إلغاء الطلب',
};

interface Rule { from: readonly ExceptionStatus[]; to: ExceptionStatus; actors: readonly Actor[]; /** the action may repeat without leaving its state (re-assigning, revising a draft) */ stays?: boolean }
const OPEN: ExceptionStatus[] = ['submitted', 'under_review', 'awaiting_provider_approval', 'feasibility_approved', 'assigned_to_coordinator', 'negotiating', 'offer_prepared', 'awaiting_customer_approval', 'customer_approved', 'awaiting_payment', 'information_required', 'alternative_proposed', 'offer_expired'];
const STAFF: Actor[] = ['platform', 'supervisor'];
export const RULES: Record<ExceptionAction, Rule> = {
  REVIEW: { from: ['submitted'], to: 'under_review', actors: ['system', 'platform', 'supervisor', 'coordinator'] },
  REQUEST_PROVIDER: { from: ['under_review'], to: 'awaiting_provider_approval', actors: ['system', ...STAFF] },
  APPROVE_FEASIBILITY: { from: ['awaiting_provider_approval'], to: 'feasibility_approved', actors: ['provider', 'platform'] },
  REJECT: { from: ['under_review', 'awaiting_provider_approval'], to: 'rejected', actors: ['provider', 'platform', 'supervisor'] },
  PROPOSE_ALTERNATIVE: { from: ['awaiting_provider_approval'], to: 'alternative_proposed', actors: ['provider', 'platform', 'coordinator'] },
  ACCEPT_ALTERNATIVE: { from: ['alternative_proposed'], to: 'feasibility_approved', actors: ['customer'] },
  DECLINE_ALTERNATIVE: { from: ['alternative_proposed'], to: 'customer_declined', actors: ['customer'] },
  REQUEST_INFO: { from: ['under_review', 'awaiting_provider_approval'], to: 'information_required', actors: ['provider', 'platform', 'coordinator', 'supervisor'] },
  PROVIDE_INFO: { from: ['information_required'], to: 'under_review', actors: ['customer'] },
  ASSIGN: { from: ['feasibility_approved'], to: 'assigned_to_coordinator', actors: ['system', ...STAFF] },
  REASSIGN: { from: ['assigned_to_coordinator', 'negotiating', 'offer_prepared'], to: 'assigned_to_coordinator', actors: STAFF, stays: true },
  START_NEGOTIATION: { from: ['assigned_to_coordinator'], to: 'negotiating', actors: ['coordinator', ...STAFF] },
  PREPARE_OFFER: { from: ['assigned_to_coordinator', 'negotiating', 'offer_prepared'], to: 'offer_prepared', actors: ['coordinator', ...STAFF], stays: true },
  APPROVE_OFFER: { from: ['offer_prepared'], to: 'offer_prepared', actors: STAFF, stays: true },
  SEND_OFFER: { from: ['offer_prepared'], to: 'awaiting_customer_approval', actors: ['coordinator', ...STAFF] },
  CUSTOMER_ACCEPT: { from: ['awaiting_customer_approval'], to: 'customer_approved', actors: ['customer'] },
  CUSTOMER_DECLINE: { from: ['awaiting_customer_approval'], to: 'customer_declined', actors: ['customer'] },
  CUSTOMER_RENEGOTIATE: { from: ['awaiting_customer_approval'], to: 'negotiating', actors: ['customer'] },
  EXPIRE_OFFER: { from: ['awaiting_customer_approval', 'awaiting_payment'], to: 'offer_expired', actors: ['system'] },
  REOPEN_NEGOTIATION: { from: ['offer_expired'], to: 'negotiating', actors: ['coordinator', ...STAFF] },
  REQUEST_PAYMENT: { from: ['customer_approved'], to: 'awaiting_payment', actors: ['system'] },
  CONFIRM: { from: ['awaiting_payment'], to: 'confirmed', actors: ['system'] },
  COMPLETE: { from: ['confirmed'], to: 'completed', actors: ['system', 'platform'] },
  MARK_UNAVAILABLE: { from: ['under_review', 'awaiting_provider_approval', 'feasibility_approved', 'assigned_to_coordinator', 'negotiating', 'offer_prepared', 'awaiting_customer_approval', 'awaiting_payment', 'alternative_proposed', 'offer_expired'], to: 'execution_unavailable', actors: ['provider', 'coordinator', ...STAFF] },
  CANCEL: { from: OPEN, to: 'cancelled', actors: ['customer', 'system', ...STAFF] },
};

export class TransitionError extends Error { constructor(message: string, readonly code: 'FINAL' | 'ILLEGAL_STATE' | 'FORBIDDEN' | 'UNKNOWN') { super(message); } }

/** The state an action leads to, or a TransitionError saying why not. This is the only place that decides. */
export function transition(status: string, action: string, actor: Actor): ExceptionStatus {
  const rule = (RULES as Record<string, Rule | undefined>)[action];
  if (!rule) throw new TransitionError('إجراء غير معروف', 'UNKNOWN');
  if (isFinal(status)) throw new TransitionError('انتهى مسار هذا الطلب', 'FINAL');
  if (!(rule.from as readonly string[]).includes(status)) throw new TransitionError('هذا الإجراء غير متاح في الحالة الحالية', 'ILLEGAL_STATE');
  if (!rule.actors.includes(actor)) throw new TransitionError('لا تملك صلاحية هذا الإجراء', 'FORBIDDEN');
  return rule.to;
}
/** Actions the given actors may take now (used to show only the buttons a person can really press). */
export function allowedActions(status: string, actors: readonly Actor[]): ExceptionAction[] {
  if (isFinal(status)) return [];
  return ACTIONS.filter(a => (RULES[a].from as readonly string[]).includes(status) && RULES[a].actors.some(x => actors.includes(x)) && !['EXPIRE_OFFER', 'REQUEST_PAYMENT', 'CONFIRM'].includes(a));
}

// ---- the three mandatory stages -------------------------------------------------------------------------------------------------
export const STAGES = ['FEASIBILITY', 'CUSTOMER_PRICE', 'FINAL_CONFIRMATION'] as const;
export type Stage = typeof STAGES[number];
export const STAGE_LABELS: Record<Stage, string> = { FEASIBILITY: 'الموافقة التشغيلية', CUSTOMER_PRICE: 'اعتماد السعر النهائي', FINAL_CONFIRMATION: 'التأكيد النهائي للحجز' };
/** Which stage a status belongs to, for the step-by-step view. 0 = before the first stage. */
export function stageOf(status: string): 0 | 1 | 2 | 3 {
  switch (status) {
    case 'submitted': case 'under_review': case 'awaiting_provider_approval': case 'information_required': case 'alternative_proposed': return 1;
    case 'feasibility_approved': case 'assigned_to_coordinator': case 'negotiating': case 'offer_prepared': case 'awaiting_customer_approval': case 'offer_expired': return 2;
    case 'customer_approved': case 'awaiting_payment': case 'confirmed': case 'completed': return 3;
    default: return 0;
  }
}

export interface StepView { stage: Stage; approverType: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' }
export interface OfferView { id: string; version: number; status: string; total: number; startAt: string | Date; expiresAt?: string | Date | null }
/** The final gate. Nothing confirms a booking unless every one of these holds; the server evaluates this inside the confirming transaction. */
export function finalConfirmationGuard(input: { steps: StepView[]; offer: OfferView | null; requestStartAt: string | Date; availabilityRechecked: boolean; paymentSatisfied: boolean; now?: number }): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const feasibility = input.steps.filter(s => s.stage === 'FEASIBILITY' && s.status !== 'SUPERSEDED');
  if (!feasibility.length || feasibility.some(s => s.status !== 'APPROVED')) missing.push('الموافقة التشغيلية');
  const price = input.steps.filter(s => s.stage === 'CUSTOMER_PRICE' && s.status !== 'SUPERSEDED');
  if (!input.offer || input.offer.status !== 'ACCEPTED' || !price.some(s => s.status === 'APPROVED' && s.approverType === 'CUSTOMER')) missing.push('اعتماد العميل للسعر النهائي');
  else if (+new Date(input.offer.startAt) !== +new Date(input.requestStartAt)) missing.push('تطابق الموعد مع العرض المعتمد');
  if (!input.availabilityRechecked) missing.push('إعادة التحقق من التوفر');
  if (!input.paymentSatisfied) missing.push('الدفعة المطلوبة');
  return { ok: missing.length === 0, missing };
}

// ---- priority and response targets ----------------------------------------------------------------------------------------------
export type Priority = 1 | 2 | 3 | 4;
export const PRIORITY_LABELS: Record<Priority, string> = { 1: 'عاجل جداً', 2: 'عاجل', 3: 'عادي', 4: 'منخفض' };
/** Priority from how close the event is: the sooner, the more urgent. */
export function priorityFor(minutesToStart: number): Priority { return minutesToStart < 1440 ? 1 : minutesToStart < 4320 ? 2 : minutesToStart < 10080 ? 3 : 4; }

export interface ExceptionConfigBody {
  /** Hours allowed to respond, by priority (1..4), for each waiting party. */
  providerResponseHours: Record<Priority, number>;
  coordinatorResponseHours: Record<Priority, number>;
  customerResponseHours: Record<Priority, number>;
  /** How long an offer stays valid, and how long the customer has to pay after accepting. */
  offerValidityHours: number;
  paymentWindowHours: number;
  /** A new request nobody opened within this many hours is escalated. */
  unreviewedEscalationHours: number;
  /** Each further level is reached after this many extra hours past the target. */
  escalationStepHours: number;
  /** Offers above this amount (halalas) need a supervisor's approval before they are sent. 0 turns it off. */
  supervisorApprovalAboveAmount: number;
  /** Vendor-provided services also need the platform's own approval of feasibility. */
  requirePlatformApprovalForVendorServices: boolean;
  /** An expired offer that nobody reopened is cancelled after this many days. */
  expiredOfferCancelDays: number;
}
export const defaultExceptionConfig = (): ExceptionConfigBody => ({
  providerResponseHours: { 1: 2, 2: 4, 3: 12, 4: 24 }, coordinatorResponseHours: { 1: 2, 2: 6, 3: 24, 4: 48 }, customerResponseHours: { 1: 6, 2: 12, 3: 24, 4: 48 },
  offerValidityHours: 24, paymentWindowHours: 24, unreviewedEscalationHours: 4, escalationStepHours: 6, supervisorApprovalAboveAmount: 0, requirePlatformApprovalForVendorServices: false, expiredOfferCancelDays: 7,
});
const hoursMap = (v: any, fallback: Record<Priority, number>, label: string): Record<Priority, number> => {
  const out = { ...fallback };
  for (const p of [1, 2, 3, 4] as const) { if (v?.[p] === undefined) continue; const n = Number(v[p]); if (!Number.isFinite(n) || n <= 0 || n > 720) throw new Error(label); out[p] = n; }
  return out;
};
/** Validates an administrator's edit of the escalation settings. Unknown fields are ignored; missing ones keep their defaults. */
export function normalizeExceptionConfig(input: any): ExceptionConfigBody {
  const d = defaultExceptionConfig();
  if (!input || typeof input !== 'object') return d;
  const hours = (v: any, fallback: number, label: string) => { if (v === undefined) return fallback; const n = Number(v); if (!Number.isFinite(n) || n <= 0 || n > 8760) throw new Error(label); return n; };
  const amount = (v: any) => { if (v === undefined) return d.supervisorApprovalAboveAmount; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 2_000_000_000) throw new Error('حد موافقة المشرف غير صالح'); return n; };
  return {
    providerResponseHours: hoursMap(input.providerResponseHours, d.providerResponseHours, 'مهلة استجابة المورد غير صالحة'),
    coordinatorResponseHours: hoursMap(input.coordinatorResponseHours, d.coordinatorResponseHours, 'مهلة استجابة المنسق غير صالحة'),
    customerResponseHours: hoursMap(input.customerResponseHours, d.customerResponseHours, 'مهلة استجابة العميل غير صالحة'),
    offerValidityHours: hours(input.offerValidityHours, d.offerValidityHours, 'مدة صلاحية العرض غير صالحة'),
    paymentWindowHours: hours(input.paymentWindowHours, d.paymentWindowHours, 'مهلة الدفع غير صالحة'),
    unreviewedEscalationHours: hours(input.unreviewedEscalationHours, d.unreviewedEscalationHours, 'مهلة المراجعة غير صالحة'),
    escalationStepHours: hours(input.escalationStepHours, d.escalationStepHours, 'مدة مستوى التصعيد غير صالحة'),
    supervisorApprovalAboveAmount: amount(input.supervisorApprovalAboveAmount),
    requirePlatformApprovalForVendorServices: input.requirePlatformApprovalForVendorServices === undefined ? d.requirePlatformApprovalForVendorServices : input.requirePlatformApprovalForVendorServices === true,
    expiredOfferCancelDays: hours(input.expiredOfferCancelDays, d.expiredOfferCancelDays, 'مهلة إلغاء العرض المنتهي غير صالحة'),
  };
}

/** Who a request is waiting on, which target applies, and the deadline for it. */
export function responseTarget(status: string, config: ExceptionConfigBody, priority: Priority, enteredAt: number): { waitingOn: 'platform' | 'provider' | 'coordinator' | 'customer' | null; dueAt: number | null } {
  const at = (h: number) => enteredAt + h * 3600000;
  switch (status) {
    case 'submitted': case 'under_review': return { waitingOn: 'platform', dueAt: at(config.unreviewedEscalationHours) };
    case 'awaiting_provider_approval': return { waitingOn: 'provider', dueAt: at(config.providerResponseHours[priority]) };
    case 'feasibility_approved': return { waitingOn: 'platform', dueAt: at(config.unreviewedEscalationHours) };
    case 'assigned_to_coordinator': case 'negotiating': case 'offer_prepared': case 'offer_expired': return { waitingOn: 'coordinator', dueAt: at(config.coordinatorResponseHours[priority]) };
    case 'awaiting_customer_approval': case 'information_required': case 'alternative_proposed': return { waitingOn: 'customer', dueAt: at(config.customerResponseHours[priority]) };
    case 'customer_approved': case 'awaiting_payment': return { waitingOn: 'customer', dueAt: at(config.paymentWindowHours) };
    default: return { waitingOn: null, dueAt: null };
  }
}
/** Escalation level reached: 0 on time, 1 once the target passed, then one more level per `escalationStepHours`. */
export function escalationLevel(dueAt: number | null, now: number, config: ExceptionConfigBody): number {
  if (dueAt === null || now <= dueAt) return 0;
  return 1 + Math.min(2, Math.floor((now - dueAt) / (config.escalationStepHours * 3600000)));
}

// ---- offer arithmetic -----------------------------------------------------------------------------------------------------------
export const VAT_BPS = 1500;
export interface OfferAmounts { baseAmount: number; exceptionFee: number; discount: number; vatAmount: number; total: number }
/** Totals in halalas. VAT is on base + fee − discount, rounded the way the booking engine rounds it, so the offer and the order agree. */
export function offerTotals(input: { baseAmount: number; exceptionFee?: number; discount?: number; vatBps?: number }): OfferAmounts {
  const int = (n: unknown, label: string) => { const v = Number(n ?? 0); if (!Number.isInteger(v) || v < 0 || v > 2_000_000_000) throw new Error(label); return v; };
  const baseAmount = int(input.baseAmount, 'السعر الأساسي غير صالح'), exceptionFee = int(input.exceptionFee, 'رسوم الاستثناء غير صالحة'), discount = int(input.discount, 'الخصم غير صالح');
  if (discount > baseAmount + exceptionFee) throw new Error('الخصم أكبر من قيمة العرض');
  const subtotal = baseAmount + exceptionFee - discount, vatAmount = Math.round(subtotal * (input.vatBps ?? VAT_BPS) / 10000);
  return { baseAmount, exceptionFee, discount, vatAmount, total: subtotal + vatAmount };
}

/** A reference number such as EX-20261030-4F9K2: date plus a random suffix without look-alike characters. */
export function referenceNumber(prefix: 'EX' | 'RS', now: Date, random: (n: number) => number): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = ''; for (let i = 0; i < 6; i++) suffix += letters[random(letters.length)];
  return `${prefix}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${suffix}`;
}

/**
 * A confirmed booking's price after an agreed exception charge, using the same arithmetic as the booking engine (tax on the subtotal, commission on the subtotal).
 * The deposit that was already due stays as it is; the extra amount is added to the last payment milestone (or to the deposit if there are none),
 * so deposit + milestones still add up to the total.
 */
export function priceWithCharge<T extends { fees: number; subtotal: number; tax: number; total: number; deposit: number; commission: number; milestones: { amount: number }[] }>(price: T, rates: { taxBps: number; commissionBps: number }, netFee: number): T {
  if (!Number.isInteger(netFee) || netFee < 0) throw new Error('رسوم الاستثناء غير صالحة');
  const subtotal = price.subtotal + netFee, tax = Math.round(subtotal * rates.taxBps / 10000), total = subtotal + tax, extra = total - price.total;
  const milestones = price.milestones.map(m => ({ ...m }));
  if (milestones.length) milestones[milestones.length - 1].amount += extra;
  return { ...price, fees: price.fees + netFee, subtotal, tax, total, commission: Math.round(subtotal * rates.commissionBps / 10000), deposit: milestones.length ? price.deposit : price.deposit + extra, milestones };
}
