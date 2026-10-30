// Pure rules of the exception workflow: advance-notice evaluation, the state machine, the final-confirmation guard, priorities, escalation and offer arithmetic.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const N = require('../src/lib/booking/advance-notice.ts'), M = require('../src/lib/exceptions/machine.ts');
const H = 3600000, now = Date.parse('2026-11-01T09:00:00Z');

// ---- advance notice
assert.equal(N.requiredMinutes(N.normalizeAdvanceNotice({ enabled: true, value: 2, unit: 'day' })), 2880);
assert.equal(N.requiredMinutes(N.normalizeAdvanceNotice({ enabled: true, value: 1, unit: 'hour', preparationMinutes: 300 })), 300, 'preparation longer than the notice wins');
assert.equal(N.requiredMinutes(N.normalizeAdvanceNotice({ enabled: false, value: 9, unit: 'week' })), 0, 'a disabled rule asks for nothing');
assert.equal(N.requiredMinutes(N.normalizeAdvanceNotice({ enabled: true, value: 1, unit: 'week' })), 10080);
assert.throws(() => N.normalizeAdvanceNotice({ enabled: true, value: -1, unit: 'day' })); assert.throws(() => N.normalizeAdvanceNotice({ enabled: true, value: 1, unit: 'year' }));
assert.throws(() => N.normalizeAdvanceNotice({ timezone: 'Mars/Base' })); assert.throws(() => N.normalizeAdvanceNotice({ enabled: true, value: 60, unit: 'week' }));
const req = [{ source: 'service', minutes: 2880 }, { source: 'offer', minutes: 1440 }];
let ev = N.evaluateNotice({ start: new Date(now + 72 * H), now, requirements: req }); assert.equal(ev.ok, true); assert.equal(ev.canRequestException, false);
ev = N.evaluateNotice({ start: new Date(now + 24 * H), now, requirements: req }); assert.equal(ev.ok, false); assert.equal(ev.requiredMinutes, 2880); assert.equal(ev.remainingMinutes, 1440); assert.equal(ev.limitingSource, 'service'); assert.equal(ev.canRequestException, true);
assert.equal(+ev.earliestAt, now + 48 * H);
assert.equal(N.evaluateNotice({ start: new Date(now + 48 * H), now, requirements: req }).ok, true, 'exactly the required notice is enough');
assert.equal(N.evaluateNotice({ start: new Date(now + 24 * H), now, requirements: req, allowExceptionRequests: false }).canRequestException, false, 'a service that refuses exceptions');
assert.equal(N.evaluateNotice({ start: new Date(now - H), now, requirements: req }).canRequestException, false, 'a time in the past cannot be an exception');
ev = N.evaluateNotice({ start: new Date(now + 200 * H), now, requirements: [], cutoffAt: new Date(now - 1000).toISOString() }); assert.equal(ev.ok, false); assert.equal(ev.cutoffPassed, true); assert.equal(ev.canRequestException, false, 'a closed booking takes no exception');
assert.equal(N.evaluateNotice({ start: new Date(now + 10 * H), now, requirements: [] }).ok, true, 'no requirement, no limit');
// packages are judged component by component
const item = (label, minutes, optional, allow = true) => ({ label, offerId: label, optional, evaluation: N.evaluateNotice({ start: new Date(now + 24 * H), now, requirements: [{ source: label, minutes }], allowExceptionRequests: allow }) });
let pk = N.evaluatePackageNotice([item('تصوير', 720), item('كوشة', 4320), item('ضيافة', 2880, true)]);
assert.equal(pk.ok, false); assert.deepEqual(pk.blocking.map(i => i.label), ['كوشة']); assert.deepEqual(pk.droppable.map(i => i.label), ['ضيافة']); assert.equal(pk.longest.label, 'كوشة'); assert.equal(pk.canRequestException, true);
pk = N.evaluatePackageNotice([item('تصوير', 720), item('كوشة', 4320, false, false)]); assert.equal(pk.canRequestException, false, 'one component refuses exceptions, so the package cannot ask');
assert.equal(N.evaluatePackageNotice([item('تصوير', 720)]).ok, true);
// time zones
assert.equal(N.zonedInstant('2026-11-01', '12:00', 'Asia/Riyadh').toISOString(), '2026-11-01T09:00:00.000Z');
assert.equal(N.zonedInstant('2026-07-01', '12:00', 'America/New_York').toISOString(), '2026-07-01T16:00:00.000Z');
assert.throws(() => N.zonedInstant('2026-02-30', '12:00')); assert.throws(() => N.zonedInstant('2026-11-01', '25:00'));
assert.equal(N.describeMinutes(2880, 'en'), '2 days'); assert.equal(N.describeMinutes(90, 'en'), '1 hour 30 minutes'); assert.equal(N.describeMinutes(60, 'en'), '1 hour'); assert.equal(N.describeMinutes(0, 'en'), 'less than a minute');
assert.equal(N.describeMinutes(2880), 'يومان'); assert.equal(N.describeMinutes(180), '3 ساعات'); assert.equal(N.describeMinutes(1440), 'يوم'); assert.equal(N.describeMinutes(10080), 'أسبوع'); assert.equal(N.describeMinutes(90), 'ساعة و30 دقيقة');

// ---- state machine: the happy path, in order
let s = 'submitted';
for (const [action, actor, to] of [['REVIEW', 'system', 'under_review'], ['REQUEST_PROVIDER', 'system', 'awaiting_provider_approval'], ['APPROVE_FEASIBILITY', 'provider', 'feasibility_approved'], ['ASSIGN', 'system', 'assigned_to_coordinator'], ['START_NEGOTIATION', 'coordinator', 'negotiating'], ['PREPARE_OFFER', 'coordinator', 'offer_prepared'], ['SEND_OFFER', 'coordinator', 'awaiting_customer_approval'], ['CUSTOMER_ACCEPT', 'customer', 'customer_approved'], ['REQUEST_PAYMENT', 'system', 'awaiting_payment'], ['CONFIRM', 'system', 'confirmed'], ['COMPLETE', 'system', 'completed']]) { s = M.transition(s, action, actor); assert.equal(s, to); }
// stages cannot be skipped
const bad = (status, action, actor, code) => assert.throws(() => M.transition(status, action, actor), e => e.code === code, `${status} ${action} ${actor}`);
bad('awaiting_provider_approval', 'CONFIRM', 'system', 'ILLEGAL_STATE'); bad('awaiting_provider_approval', 'CUSTOMER_ACCEPT', 'customer', 'ILLEGAL_STATE'); bad('feasibility_approved', 'REQUEST_PAYMENT', 'system', 'ILLEGAL_STATE');
bad('negotiating', 'CONFIRM', 'system', 'ILLEGAL_STATE'); bad('offer_prepared', 'CUSTOMER_ACCEPT', 'customer', 'ILLEGAL_STATE'); bad('awaiting_customer_approval', 'CONFIRM', 'system', 'ILLEGAL_STATE'); bad('customer_approved', 'CONFIRM', 'system', 'ILLEGAL_STATE');
bad('under_review', 'APPROVE_FEASIBILITY', 'provider', 'ILLEGAL_STATE');
// the provider's approval is not the final confirmation
bad('feasibility_approved', 'CONFIRM', 'provider', 'ILLEGAL_STATE'); bad('awaiting_payment', 'CONFIRM', 'provider', 'FORBIDDEN'); bad('awaiting_payment', 'CONFIRM', 'customer', 'FORBIDDEN'); bad('awaiting_payment', 'CONFIRM', 'platform', 'FORBIDDEN');
// who may do what
bad('awaiting_provider_approval', 'APPROVE_FEASIBILITY', 'customer', 'FORBIDDEN'); bad('awaiting_customer_approval', 'CUSTOMER_ACCEPT', 'provider', 'FORBIDDEN'); bad('awaiting_customer_approval', 'CUSTOMER_ACCEPT', 'platform', 'FORBIDDEN'); bad('offer_prepared', 'SEND_OFFER', 'customer', 'FORBIDDEN'); bad('feasibility_approved', 'ASSIGN', 'provider', 'FORBIDDEN');
// every final state is closed
for (const f of M.FINAL_STATUSES) for (const a of M.ACTIONS) for (const actor of ['customer', 'provider', 'platform', 'coordinator', 'supervisor', 'system']) bad(f, a, actor, 'FINAL');
bad('submitted', 'NOPE', 'system', 'UNKNOWN');
// alternatives, information, rejection, negotiation, expiry
assert.equal(M.transition('awaiting_provider_approval', 'REJECT', 'provider'), 'rejected'); assert.equal(M.transition('awaiting_provider_approval', 'PROPOSE_ALTERNATIVE', 'provider'), 'alternative_proposed');
assert.equal(M.transition('alternative_proposed', 'ACCEPT_ALTERNATIVE', 'customer'), 'feasibility_approved'); assert.equal(M.transition('alternative_proposed', 'DECLINE_ALTERNATIVE', 'customer'), 'customer_declined');
assert.equal(M.transition('awaiting_provider_approval', 'REQUEST_INFO', 'provider'), 'information_required'); assert.equal(M.transition('information_required', 'PROVIDE_INFO', 'customer'), 'under_review');
assert.equal(M.transition('awaiting_customer_approval', 'CUSTOMER_DECLINE', 'customer'), 'customer_declined'); assert.equal(M.transition('awaiting_customer_approval', 'CUSTOMER_RENEGOTIATE', 'customer'), 'negotiating');
assert.equal(M.transition('awaiting_customer_approval', 'EXPIRE_OFFER', 'system'), 'offer_expired'); assert.equal(M.transition('awaiting_payment', 'EXPIRE_OFFER', 'system'), 'offer_expired'); assert.equal(M.transition('offer_expired', 'REOPEN_NEGOTIATION', 'coordinator'), 'negotiating');
assert.equal(M.transition('offer_expired', 'CANCEL', 'system'), 'cancelled'); assert.equal(M.transition('negotiating', 'MARK_UNAVAILABLE', 'coordinator'), 'execution_unavailable'); assert.equal(M.transition('awaiting_payment', 'CANCEL', 'customer'), 'cancelled');
bad('confirmed', 'CANCEL', 'customer', 'ILLEGAL_STATE');
assert.deepEqual(M.allowedActions('awaiting_customer_approval', ['customer']).sort(), ['CANCEL', 'CUSTOMER_ACCEPT', 'CUSTOMER_DECLINE', 'CUSTOMER_RENEGOTIATE'].sort());
assert.deepEqual(M.allowedActions('awaiting_customer_approval', ['provider']), ['MARK_UNAVAILABLE'], 'while the customer decides, a provider can only report that it cannot deliver'); assert.deepEqual(M.allowedActions('completed', ['platform']), []);
assert.ok(!M.allowedActions('awaiting_payment', ['platform', 'supervisor', 'system']).includes('CONFIRM'), 'confirmation is never a button');

// ---- final confirmation guard
const steps = [{ stage: 'FEASIBILITY', approverType: 'PROVIDER', status: 'APPROVED' }, { stage: 'CUSTOMER_PRICE', approverType: 'CUSTOMER', status: 'APPROVED' }];
const offer = { id: 'o1', version: 1, status: 'ACCEPTED', total: 1150, startAt: '2026-11-02T10:00:00Z' };
const guard = o => M.finalConfirmationGuard({ steps, offer, requestStartAt: '2026-11-02T10:00:00Z', availabilityRechecked: true, paymentSatisfied: true, ...o });
assert.equal(guard({}).ok, true);
assert.deepEqual(guard({ steps: [steps[1]] }).missing, ['الموافقة التشغيلية']); assert.deepEqual(guard({ steps: [{ ...steps[0], status: 'PENDING' }, steps[1]] }).missing, ['الموافقة التشغيلية']);
assert.deepEqual(guard({ offer: { ...offer, status: 'SENT' } }).missing, ['اعتماد العميل للسعر النهائي']); assert.deepEqual(guard({ offer: null }).missing, ['اعتماد العميل للسعر النهائي']);
assert.deepEqual(guard({ requestStartAt: '2026-11-02T11:00:00Z' }).missing, ['تطابق الموعد مع العرض المعتمد'], 'a changed time needs a new offer');
assert.deepEqual(guard({ availabilityRechecked: false }).missing, ['إعادة التحقق من التوفر']); assert.deepEqual(guard({ paymentSatisfied: false }).missing, ['الدفعة المطلوبة']);
assert.equal(guard({ steps: [], offer: null, availabilityRechecked: false, paymentSatisfied: false }).missing.length, 4);

// ---- priority, targets, escalation
assert.equal(M.priorityFor(60), 1); assert.equal(M.priorityFor(2000), 2); assert.equal(M.priorityFor(5000), 3); assert.equal(M.priorityFor(20000), 4);
const cfg = M.defaultExceptionConfig();
assert.deepEqual(M.responseTarget('awaiting_provider_approval', cfg, 1, now), { waitingOn: 'provider', dueAt: now + 2 * H });
assert.equal(M.responseTarget('negotiating', cfg, 3, now).waitingOn, 'coordinator'); assert.equal(M.responseTarget('awaiting_customer_approval', cfg, 2, now).dueAt, now + 12 * H); assert.equal(M.responseTarget('completed', cfg, 2, now).waitingOn, null);
assert.equal(M.escalationLevel(now, now, cfg), 0); assert.equal(M.escalationLevel(now, now + 1, cfg), 1); assert.equal(M.escalationLevel(now, now + 7 * H, cfg), 2); assert.equal(M.escalationLevel(now, now + 100 * H, cfg), 3); assert.equal(M.escalationLevel(null, now, cfg), 0);
const tuned = M.normalizeExceptionConfig({ offerValidityHours: 6, providerResponseHours: { 1: 1 }, requirePlatformApprovalForVendorServices: true, supervisorApprovalAboveAmount: 500000 });
assert.equal(tuned.offerValidityHours, 6); assert.equal(tuned.providerResponseHours[1], 1); assert.equal(tuned.providerResponseHours[2], 4); assert.equal(tuned.requirePlatformApprovalForVendorServices, true);
assert.throws(() => M.normalizeExceptionConfig({ offerValidityHours: 0 })); assert.throws(() => M.normalizeExceptionConfig({ supervisorApprovalAboveAmount: -5 })); assert.throws(() => M.normalizeExceptionConfig({ providerResponseHours: { 1: 'x' } }));

// ---- offers
const t = M.offerTotals({ baseAmount: 100000, exceptionFee: 20000, discount: 10000 }); assert.deepEqual(t, { baseAmount: 100000, exceptionFee: 20000, discount: 10000, vatAmount: 16500, total: 126500 });
assert.equal(M.offerTotals({ baseAmount: 5 }).total, 6, 'VAT rounds to the nearest halala like the booking engine'); assert.equal(M.offerTotals({ baseAmount: 0 }).total, 0);
assert.throws(() => M.offerTotals({ baseAmount: 100, discount: 200 })); assert.throws(() => M.offerTotals({ baseAmount: 1.5 })); assert.throws(() => M.offerTotals({ baseAmount: 100, exceptionFee: -1 }));
const base = { fees: 0, subtotal: 100000, tax: 15000, total: 115000, deposit: 34500, commission: 10000, milestones: [{ amount: 80500 }] };
const charged = M.priceWithCharge(base, { taxBps: 1500, commissionBps: 1000 }, 20000); assert.equal(charged.subtotal, 120000); assert.equal(charged.tax, 18000); assert.equal(charged.total, 138000); assert.equal(charged.deposit, 34500); assert.equal(charged.milestones[0].amount, 103500); assert.equal(charged.deposit + charged.milestones.reduce((n, m) => n + m.amount, 0), charged.total, 'deposit + milestones still equal the total'); assert.equal(charged.commission, 12000);
assert.equal(M.priceWithCharge({ ...base, milestones: [] }, { taxBps: 1500, commissionBps: 1000 }, 0).total, 115000); assert.throws(() => M.priceWithCharge(base, { taxBps: 1500, commissionBps: 1000 }, -1));
assert.equal(M.priceWithCharge(base, { taxBps: 1500, commissionBps: 1000 }, 20000).total, M.offerTotals({ baseAmount: 100000, exceptionFee: 20000 }).total, 'the booking price and the offer total agree');
assert.match(M.referenceNumber('EX', new Date('2026-10-30T10:00:00Z'), () => 3), /^EX-20261030-[A-Z2-9]{6}$/);
console.log('PASS exception engine: notice rules, packages, time zones, state machine (no skipped stage, final states closed), final guard, escalation, offers.');
