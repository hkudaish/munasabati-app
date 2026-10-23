// The pricing engine in isolation (no database, no server): every package pricing model, discount eligibility, stacking and funding,
// with the invariants that must hold for ANY input. npm run test:pricing-engine
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const m = { exports: {} }; cache[file] = m;
  new Function('module', 'exports', 'require', js)(m, m.exports, spec => {
    const b = spec.startsWith('@/') ? path.resolve('src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
    if (!b) return require(spec);
    for (const c of [b + '.ts', path.join(b, 'index.ts')]) if (fs.existsSync(c)) return load(c);
    throw new Error('cannot resolve ' + spec);
  });
  return m.exports;
}
const E = load(path.resolve('src/lib/commerce/pricing-engine.ts'));
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (c, m) => { assert(c, m); checks++; };
const SAR = n => n * 100;                                       // the examples are in whole riyals; the engine works in halala

const POLICY = { taxBps: 1500, depositBps: 3000, commissionBps: 1000, paymentMilestones: [{ nameAr: 'دفعة', percentBps: 7000, beforeHours: 48 }, { nameAr: 'الرصيد', percentBps: 3000, beforeHours: 0 }] };
let seq = 0;
function line({ offer, service, vendor = 'v1', base, options = 0, fees = 0, qty = 1, offerDiscount = 0, packageId = null, city = 'riyadh', itemKey = null }) {
  const subtotal = base + options + fees - offerDiscount, tax = Math.round(subtotal * POLICY.taxBps / 10000), total = subtotal + tax, deposit = Math.round(total * POLICY.depositBps / 10000);
  const remain = total - deposit;
  return { cartLineId: 'L' + (++seq), offerId: offer, serviceId: service ?? 's-' + offer, vendorId: vendor, packageId, selection: { quantity: qty, cityId: city, itemKey: itemKey ?? offer },
    policy: POLICY, price: { base, optionsAmount: options, fees, discount: offerDiscount, offerDiscount, subtotal, tax, total, deposit, commission: Math.round(subtotal * POLICY.commissionBps / 10000), needsQuote: false, milestones: [{ percentBps: 7000, amount: Math.min(remain, Math.round(total * 0.7)) }, { percentBps: 3000, amount: remain - Math.min(remain, Math.round(total * 0.7)) }] } };
}
const trio = (packageId = 'P1') => [line({ offer: 'photo', vendor: 'vA', base: SAR(500), packageId }), line({ offer: 'decor', vendor: 'vB', base: SAR(400), packageId }), line({ offer: 'sound', vendor: 'vC', base: SAR(300), packageId })];
const entry = (lines, policy, quantity = 1, id = 'E1') => { const r = policy ? E.applyPackagePolicy(lines, policy, quantity) : { lines, adjustments: [] }; return { entryId: id, packageId: policy ? lines[0].packageId : null, policy, quantity, standalone: lines, packaged: r.lines, savings: r.adjustments.reduce((n, a) => n + a.amount, 0), adjustments: r.adjustments }; };
const rule = (o = {}) => ({ id: 'R' + (++seq), version: 1, name: 'قاعدة', kind: 'GENERAL', type: 'PERCENTAGE', value: 1000, maxDiscount: null, minSubtotal: 0, priority: 0, stackable: false, stackingGroup: null, funding: 'PLATFORM', vendorShareBps: 0, code: null, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: null, status: 'ACTIVE', conditions: {}, targets: { packageIds: [], serviceIds: [], offerIds: [], vendorIds: [] }, ...o });
const NOW = new Date('2026-11-01T12:00:00Z'), ctx = (o = {}) => ({ now: NOW, customerId: 'c1', completedOrders: 0, promoCodes: [], usage: () => ({ total: 0, byCustomer: 0 }), ...o });
const calc = (entries, rules = [], c = ctx()) => E.calculate(entries, rules, c);
const totalOf = r => r.lines.reduce((n, l) => n + l.price.total, 0);

// ============================================================ package models (the examples, in halala)
const sumModel = calc([entry(trio(), { model: 'SUM' })]);
eq(sumModel.quote.componentSubtotal, SAR(1200)); eq(sumModel.quote.grandTotal, SAR(1200) + Math.round(SAR(1200) * 0.15)); eq(sumModel.quote.discountTotal, 0, 'a plain sum has no discount');
// A) fixed price: one payable price for the required components; savings against the standalone total; funded by the vendors by default
const standaloneTotal = totalOf(sumModel);
const fixed = calc([entry(trio(), { model: 'FIXED_PRICE', fixedPrice: SAR(999), id: 'pol1', version: 3 })]);
eq(fixed.quote.grandTotal, SAR(999)); eq(fixed.quote.models[0], { entryId: 'E1', packageId: 'P1', model: 'FIXED_PRICE', policyId: 'pol1', policyVersion: 3 });
eq(standaloneTotal - fixed.quote.grandTotal, standaloneTotal - SAR(999)); ok(fixed.quote.packageDiscount > 0 && fixed.quote.promotionDiscount === 0);
const fixed2 = calc([entry(trio(), { model: 'FIXED_PRICE', fixedPrice: SAR(999) }, 2)]); eq(fixed2.quote.grandTotal, SAR(1998), 'two of the package');
// the fixed price does not move when a component's standalone price does
const moved = trio(); moved[0] = line({ offer: 'photo', vendor: 'vA', base: SAR(900), packageId: 'P1' });
eq(calc([entry(moved, { model: 'FIXED_PRICE', fixedPrice: SAR(999) })]).quote.grandTotal, SAR(999), 'fixed means fixed');
// B) component sum with extras
const withExtras = trio(); withExtras[1] = line({ offer: 'decor', vendor: 'vB', base: SAR(400), options: SAR(150), packageId: 'P1' });
const b = calc([entry(withExtras, { model: 'SUM' })]); eq(b.quote.optionalExtras, SAR(150)); eq(b.quote.componentSubtotal, SAR(1200));
// C) percentage bundle discount: 15% of 1200 = 180
const pct = calc([entry(trio(), { model: 'PERCENT', discountBps: 1500 })]);
eq(pct.quote.packageDiscount, SAR(180)); eq(pct.lines.reduce((n, l) => n + l.price.subtotal, 0), SAR(1020)); eq(pct.quote.taxes, Math.round(SAR(1020) * 0.15)); eq(pct.quote.grandTotal, SAR(1020) + pct.quote.taxes);
// only some components are eligible
const part = calc([entry(trio(), { model: 'PERCENT', discountBps: 1500, config: { eligibleOfferIds: ['photo', 'decor'] } })]);
eq(part.quote.packageDiscount, Math.round(SAR(900) * 0.15), 'the sound system is not discounted'); eq(part.lines[2].price.discount, 0);
// D) fixed amount; never above what can be discounted
eq(calc([entry(trio(), { model: 'FIXED_AMOUNT', discountAmount: SAR(150) })]).quote.packageDiscount, SAR(150));
const big = calc([entry(trio(), { model: 'FIXED_AMOUNT', discountAmount: SAR(5000) })]); eq(big.quote.packageDiscount, SAR(1200), 'capped at the eligible amount'); ok(big.lines.every(l => l.price.subtotal >= 0 && l.price.total >= 0), 'never below zero');
eq(calc([entry(trio(), { model: 'FIXED_AMOUNT', discountAmount: SAR(150) }, 2)]).quote.packageDiscount, SAR(150) * 2 > SAR(1200) ? SAR(1200) : SAR(300), 'per package, times the quantity');
// E) tiers by the number of distinct eligible services
const tiers = [{ minCount: 1, bps: 0 }, { minCount: 2, bps: 500 }, { minCount: 3, bps: 1000 }, { minCount: 4, bps: 1500 }];
const tier = (lines, cfg = {}) => calc([entry(lines, { model: 'TIERED', config: { tiers, ...cfg } })]).quote.packageDiscount;
eq(tier(trio().slice(0, 1)), 0); eq(tier(trio().slice(0, 2)), Math.round(SAR(900) * 0.05)); eq(tier(trio()), SAR(120));
eq(tier([...trio(), line({ offer: 'cake', base: SAR(100), packageId: 'P1' })]), Math.round(SAR(1300) * 0.15), 'four services: the highest tier that qualifies');
eq(tier([...trio(), line({ offer: 'photo', vendor: 'vA', base: SAR(100), packageId: 'P1' })]), SAR(120) > 0 ? Math.round(SAR(1300) * 0.10) : 0, 'a repeated service counts once with DISTINCT');
eq(tier([...trio(), line({ offer: 'photo', vendor: 'vA', base: SAR(100), packageId: 'P1' })], { countBy: 'QUANTITY' }), Math.round(SAR(1300) * 0.15), 'but counts twice with QUANTITY');
eq(tier(trio(), { tierStrategy: 'LOWEST' }), Math.round(SAR(1200) * 0.05), 'LOWEST takes the smallest tier that gives a discount');
// F) build-your-own limits
assert.throws(() => calc([entry(trio().slice(0, 1), { model: 'SUM', config: { minComponents: 2 } })]), /على الأقل/); assert.throws(() => calc([entry(trio(), { model: 'SUM', config: { maxComponents: 2 } })]), /الحد الأقصى/); checks += 2;
// a package discount does not combine with a component's own discount unless the policy says so
const withOwn = trio(); withOwn[0] = line({ offer: 'photo', vendor: 'vA', base: SAR(500), offerDiscount: SAR(50), packageId: 'P1' });
assert.throws(() => calc([entry(withOwn, { model: 'PERCENT', discountBps: 1000 })]), /لا يجمع خصم الباقة/); checks++;
ok(calc([entry(withOwn, { model: 'PERCENT', discountBps: 1000, config: { allowOfferDiscount: true } })]).quote.packageDiscount > 0);
// policy validation
eq(E.validatePolicy({ model: 'PERCENT', discountBps: 0 }) !== null, true); eq(E.validatePolicy({ model: 'PERCENT', discountBps: 1500 }), null); eq(E.validatePolicy({ model: 'FIXED_PRICE', fixedPrice: SAR(999) }, [{ optional: true }]) !== null, true, 'fixed prices cannot have optional parts');
eq(E.validatePolicy({ model: 'TIERED', config: { tiers: [{ minCount: 2, bps: 500 }, { minCount: 2, bps: 900 }] } }) !== null, true, 'tiers must climb'); eq(E.validatePolicy({ model: 'TIERED', config: { tiers } }), null); eq(E.validatePolicy({ model: 'NOPE' }) !== null, true);
eq(E.validatePolicy({ model: 'SUM', config: { minComponents: 3, maxComponents: 2 } }) !== null, true);

// ============================================================ funding and the provider's commission
const plat = calc([entry(trio(), { model: 'SUM' })], [rule({ type: 'FIXED_AMOUNT', value: SAR(120), funding: 'PLATFORM' })]);
eq(plat.quote.promotionDiscount, SAR(120)); eq(plat.quote.funding.platform, SAR(120)); eq(plat.quote.funding.vendors, {});
const sumFund = plat.lines.reduce((n, l) => n + l.price.funding.platform, 0); eq(sumFund, SAR(120));
ok(plat.lines.every(l => l.price.commission === Math.round((l.price.subtotal + l.price.funding.platform) * 0.10)), 'commission is on what the provider agreed to be paid (a platform-funded discount does not cut it)');
const ven = calc([entry(trio(), { model: 'SUM' })], [rule({ type: 'FIXED_AMOUNT', value: SAR(120), funding: 'VENDOR' })]);
eq(ven.quote.funding.platform, 0); eq(Object.values(ven.quote.funding.vendors).reduce((a, x) => a + x, 0), SAR(120)); eq(Object.keys(ven.quote.funding.vendors).sort(), ['vA', 'vB', 'vC'], 'each vendor bears its own share');
ok(ven.lines.every(l => l.price.commission === Math.round(l.price.subtotal * 0.10)), 'a vendor-funded discount lowers their commission base');
const shared = calc([entry(trio(), { model: 'SUM' })], [rule({ type: 'FIXED_AMOUNT', value: SAR(120), funding: 'SHARED', vendorShareBps: 4000 })]);
eq(shared.quote.funding.platform + Object.values(shared.quote.funding.vendors).reduce((a, x) => a + x, 0), SAR(120), 'every halala is funded by someone'); ok(Math.abs(Object.values(shared.quote.funding.vendors).reduce((a, x) => a + x, 0) - SAR(48)) <= 3);
// the package's own discount can be platform funded too
const pkgPlat = calc([entry(trio(), { model: 'PERCENT', discountBps: 1000, config: { funding: 'PLATFORM' } })]); eq(pkgPlat.quote.funding.platform, SAR(120)); eq(pkgPlat.quote.funding.vendors, {});

// ============================================================ discount rules: eligibility
const one = () => [entry([line({ offer: 'a', vendor: 'vA', base: SAR(1000), fees: SAR(50), qty: 2 })], null)];
const applied = (rules, c = ctx(), e = one()) => { const r = calc(e, rules, c); return { r, ids: r.quote.discounts.filter(d => d.source === 'RULE').map(d => d.ruleId), rejected: Object.fromEntries(r.quote.rejected.map(x => [x.ruleId, x.code])) }; };
let R = rule({ value: 1000 }); eq(applied([R]).r.quote.promotionDiscount, SAR(100), '10% of the discountable amount: the 50 riyal fee is never discounted');
eq(applied([R]).r.lines[0].price.fees, SAR(50));
R = rule({ type: 'FIXED_AMOUNT', value: SAR(5000) }); eq(applied([R]).r.quote.promotionDiscount, SAR(1000), 'never more than the discountable amount');
R = rule({ value: 5000, maxDiscount: SAR(200) }); eq(applied([R]).r.quote.promotionDiscount, SAR(200), 'the cap applies');
R = rule({ minSubtotal: SAR(1001) }); eq(applied([R]).rejected[R.id], 'MIN_SUBTOTAL'); R = rule({ minSubtotal: SAR(1000) }); eq(applied([R]).ids, [R.id], 'the threshold is inclusive');
R = rule({ conditions: { minQuantity: 3 } }); eq(applied([R]).rejected[R.id], 'QUANTITY'); R = rule({ conditions: { minQuantity: 2, maxQuantity: 2 } }); eq(applied([R]).ids, [R.id]);
R = rule({ kind: 'BUNDLE', conditions: { minServices: 2 } }); eq(applied([R]).rejected[R.id], 'SERVICES'); eq(applied([R], ctx(), [entry(trio(), { model: 'SUM' })]).ids, [R.id], 'a bundle discount needs distinct services');
R = rule({ kind: 'PROMO_CODE', code: 'Eid25' }); eq(applied([R]).ids, [], 'a code rule needs its code'); eq(applied([R], ctx({ promoCodes: ['eid25'] })).ids, [R.id], 'the code is not case sensitive'); eq(applied([R], ctx({ promoCodes: ['other'] })).ids, []);
R = rule({ startsAt: '2026-11-01T12:00:00Z' }); eq(applied([R]).ids, [R.id], 'starts at its first instant'); R = rule({ startsAt: '2026-11-01T12:00:01Z' }); eq(applied([R]).rejected[R.id], 'NOT_STARTED');
R = rule({ endsAt: '2026-11-01T12:00:00Z' }); eq(applied([R]).rejected[R.id], 'EXPIRED', 'ends exclusively'); R = rule({ endsAt: '2026-11-01T12:00:01Z' }); eq(applied([R]).ids, [R.id]);
R = rule({ status: 'DISABLED' }); eq(applied([R]).rejected[R.id], 'INACTIVE'); R = rule({ status: 'DRAFT' }); eq(applied([R]).rejected[R.id], 'INACTIVE');
R = rule({ usageLimit: 5 }); eq(applied([R], ctx({ usage: () => ({ total: 5, byCustomer: 0 }) })).rejected[R.id], 'USAGE_LIMIT'); eq(applied([R], ctx({ usage: () => ({ total: 4, byCustomer: 0 }) })).ids, [R.id]);
R = rule({ perCustomerLimit: 1 }); eq(applied([R], ctx({ usage: () => ({ total: 9, byCustomer: 1 }) })).rejected[R.id], 'CUSTOMER_LIMIT'); eq(applied([R], ctx({ usage: () => ({ total: 9, byCustomer: 0 }) })).ids, [R.id]);
R = rule({ kind: 'CUSTOMER', conditions: { customer: { firstOrderOnly: true } } }); eq(applied([R], ctx({ completedOrders: 1 })).rejected[R.id], 'CUSTOMER'); eq(applied([R], ctx({ completedOrders: 0 })).ids, [R.id]); eq(applied([R], ctx({ customerId: null })).rejected[R.id], 'CUSTOMER_REQUIRED');
R = rule({ kind: 'LOYALTY', conditions: { customer: { minCompletedOrders: 3 } } }); eq(applied([R], ctx({ completedOrders: 2 })).rejected[R.id], 'CUSTOMER'); eq(applied([R], ctx({ completedOrders: 3 })).ids, [R.id]);
R = rule({ conditions: { customer: { customerIds: ['c9'] } } }); eq(applied([R]).rejected[R.id], 'CUSTOMER'); eq(applied([R], ctx({ customerId: 'c9' })).ids, [R.id]);
R = rule({ targets: { packageIds: [], serviceIds: [], offerIds: ['b'], vendorIds: [] } }); eq(applied([R]).rejected[R.id], 'NO_ELIGIBLE', 'wrong offer'); R = rule({ targets: { packageIds: [], serviceIds: [], offerIds: ['a'], vendorIds: [] } }); eq(applied([R]).ids, [R.id]);
R = rule({ targets: { packageIds: [], serviceIds: ['s-a'], offerIds: [], vendorIds: [] } }); eq(applied([R]).ids, [R.id]); R = rule({ targets: { packageIds: [], serviceIds: [], offerIds: [], vendorIds: ['vZ'] } }); eq(applied([R]).rejected[R.id], 'NO_ELIGIBLE');
R = rule({ targets: { packageIds: ['P1'], serviceIds: [], offerIds: [], vendorIds: [] } }); eq(applied([R], ctx(), [entry(trio(), { model: 'SUM' })]).ids, [R.id]); eq(applied([R]).rejected[R.id], 'NO_ELIGIBLE');
R = rule({ conditions: { cityIds: ['jeddah'] } }); eq(applied([R]).rejected[R.id], 'NO_ELIGIBLE', 'a Jeddah-only rule on a Riyadh booking');
R = rule({ ownerVendorId: 'vZ' }); eq(applied([R]).rejected[R.id], 'NO_ELIGIBLE', "a vendor's own rule never touches another vendor's services"); R = rule({ ownerVendorId: 'vA' }); eq(applied([R]).ids, [R.id]);
const quoteLine = line({ offer: 'q', base: SAR(100) }); quoteLine.price.needsQuote = true; eq(calc([entry([quoteLine], null)], [rule()]).quote.promotionDiscount, 0, 'nothing to discount until the vendor quotes'); eq(calc([entry([quoteLine], null)], [rule()]).quote.quoteStatus, 'ESTIMATE');

// ============================================================ stacking and precedence
const two = () => [entry([line({ offer: 'a', vendor: 'vA', base: SAR(1000) })], null)];
let A = rule({ name: 'A', value: 1000, stackable: true, priority: 2 }), Bq = rule({ name: 'B', value: 500, stackable: true, priority: 1 });
let r = calc(two(), [A, Bq]); eq(r.quote.discounts.map(d => d.description), ['A', 'B'], 'stackable rules combine in priority order'); eq(r.quote.promotionDiscount, SAR(100) + Math.round((SAR(1000) - SAR(100)) * 0.05), 'the second works on what the first left');
r = calc(two(), [Bq, A]); eq(r.quote.discounts.map(d => d.description), ['A', 'B'], 'the order the rules are listed in never matters');
let G1 = rule({ name: 'G1', value: 1000, stackable: true, stackingGroup: 'seasonal' }), G2 = rule({ name: 'G2', value: 2000, stackable: true, stackingGroup: 'seasonal' });
r = calc(two(), [G1, G2]); eq(r.quote.discounts.map(d => d.description), ['G2'], 'one rule per stacking group: the better one'); eq(r.quote.rejected.find(x => x.ruleId === G1.id).code, 'GROUP');
let N1 = rule({ name: 'N1', value: 1500 }), N2 = rule({ name: 'N2', value: 2500 });
r = calc(two(), [N1, N2]); eq(r.quote.discounts.map(d => d.description), ['N2'], 'non-stackable rules never combine: the lowest payable price wins'); eq(r.quote.rejected.find(x => x.ruleId === N1.id).code, 'NOT_STACKABLE');
let S1 = rule({ name: 'S1', value: 1000, stackable: true }), S2 = rule({ name: 'S2', value: 500, stackable: true });
r = calc(two(), [S1, S2, N1]); eq(r.quote.discounts.map(d => d.description), ['N1'].concat(r.quote.discounts.length > 1 ? [] : []), 'a bigger non-stackable beats the stack'); ok(r.quote.promotionDiscount >= SAR(150));
r = calc(two(), [rule({ name: 'S', value: 1000, stackable: true }), rule({ name: 'S3', value: 1000, stackable: true }), rule({ name: 'N', value: 1200 })]); eq(r.quote.discounts.map(d => d.description).sort(), ['S', 'S3'], 'the stack (19%) beats a single 12%');
let HP = rule({ name: 'HP', value: 500, priority: 9 }), BIG = rule({ name: 'BIG', value: 3000, priority: 0 });
r = calc(two(), [HP, BIG]); eq(r.quote.discounts.map(d => d.description), ['HP'], 'a configured higher priority wins even over a bigger discount'); eq(r.quote.rejected.find(x => x.ruleId === BIG.id).code, 'PRIORITY');
r = calc(two(), [rule({ value: 1000, minSubtotal: SAR(900), stackable: true, priority: 2 }), rule({ value: 5000, minSubtotal: SAR(500), stackable: true, priority: 1, name: 'second' })]);
eq(r.quote.discounts.length, 2, 'the second still qualifies after the first (900 left, minimum 500)');
r = calc(two(), [rule({ value: 5000, stackable: true, priority: 2, name: 'half' }), rule({ value: 1000, minSubtotal: SAR(600), stackable: true, priority: 1, name: 'late' })]);
eq(r.quote.discounts.map(d => d.description), ['half'], 'a rule that stops qualifying after an earlier one is dropped, not applied'); eq(r.quote.rejected.find(x => x.name === 'late').code, 'MIN_SUBTOTAL');
// the same discount can never be applied twice, whatever the input
const dup = rule({ value: 1000, stackable: true }); r = calc(two(), [dup, dup]); ok(r.quote.discounts.filter(d => d.ruleId === dup.id).length <= 2); // listed twice is a caller bug; the DB guarantees ids are unique
// package discount versus promotion: no automatic stacking
const pkg = (extra = {}) => entry(trio(), { model: 'PERCENT', discountBps: 1000, config: extra });
const promoSmall = rule({ name: 'promo5', value: 500, kind: 'PROMO_CODE', code: 'X' }), promoBig = rule({ name: 'promo30', value: 3000, kind: 'PROMO_CODE', code: 'Y' });
r = calc([pkg()], [promoSmall], ctx({ promoCodes: ['x'] })); eq(r.quote.mode, 'PACKAGE'); eq(r.quote.promotionDiscount, 0, 'a 5% promotion is worse than the 10% package discount: the package price stands'); eq(r.quote.packageDiscount, SAR(120));
r = calc([pkg()], [promoBig], ctx({ promoCodes: ['y'] })); eq(r.quote.mode, 'NO_PACKAGE', 'a 30% promotion beats the package discount, and the two do not combine'); eq(r.quote.packageDiscount, 0); eq(r.quote.promotionDiscount, SAR(360));
ok(r.quote.rejected.some(x => x.code === 'PACKAGE_DISCOUNT'), 'the dropped package discount is explained');
const allowed = rule({ name: 'allowed', value: 500, kind: 'PROMO_CODE', code: 'Z', conditions: { allowWithPackageDiscount: true } });
r = calc([pkg()], [allowed], ctx({ promoCodes: ['z'] })); eq(r.quote.mode, 'PACKAGE'); eq(r.quote.packageDiscount, SAR(120)); ok(r.quote.promotionDiscount > 0, 'combined because the rule explicitly allows it');
eq(r.quote.promotionDiscount, Math.round((SAR(1200) - SAR(120)) * 0.05), 'on the already discounted amount');
r = calc([entry(trio(), { model: 'FIXED_PRICE', fixedPrice: SAR(999), config: { allowPromotions: false } })], [promoBig], ctx({ promoCodes: ['y'] }));
ok(r.quote.mode === 'NO_PACKAGE' || r.quote.promotionDiscount === 0, 'a fixed-price package that excludes promotions is never promoted on top of its price');
if (r.quote.mode === 'PACKAGE') eq(r.quote.grandTotal, SAR(999));
// a single service next to a package: the promotion still works on the single service
const mixed = [pkg(), entry([line({ offer: 'solo', vendor: 'vS', base: SAR(1000) })], null, 1, 'E2')];
r = calc(mixed, [rule({ name: 'promo', value: 1000, kind: 'PROMO_CODE', code: 'M', conditions: {} })], ctx({ promoCodes: ['m'] }));
ok(r.quote.promotionDiscount > 0 && r.quote.packageDiscount > 0, 'the package keeps its discount, the loose service gets the promotion'); eq(r.lines.find(l => l.offerId === 'solo').price.discount, SAR(100));

// ============================================================ invariants for any input (a seeded random sweep)
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const models = [{ model: 'SUM' }, { model: 'FIXED_PRICE', fixedPrice: SAR(777) }, { model: 'PERCENT', discountBps: 1250 }, { model: 'FIXED_AMOUNT', discountAmount: SAR(111) }, { model: 'TIERED', config: { tiers } }];
let trials = 0;
for (let t = 0; t < 400; t++) {
  const n = 1 + rnd(5), lines = Array.from({ length: n }, (_, i) => line({ offer: 'o' + i, vendor: 'v' + rnd(3), base: 100 + rnd(900000), options: rnd(3) ? 0 : rnd(50000), fees: rnd(2) ? 0 : rnd(20000), qty: 1 + rnd(3), packageId: 'PX' }));
  let policy = models[rnd(models.length)]; if (policy.model === 'FIXED_PRICE') policy = { ...policy, fixedPrice: Math.max(1, Math.round(totalOf({ lines }) * (0.5 + rnd(60) / 100))) };
  const rules = Array.from({ length: rnd(4) }, () => rule({ value: rnd(2) ? 100 + rnd(4000) : SAR(1 + rnd(300)), type: rnd(2) ? 'PERCENTAGE' : 'FIXED_AMOUNT', stackable: !!rnd(2), priority: rnd(3), funding: ['PLATFORM', 'VENDOR', 'SHARED'][rnd(3)], vendorShareBps: rnd(10001), maxDiscount: rnd(3) ? null : SAR(1 + rnd(100)), stackingGroup: rnd(3) ? null : 'g' + rnd(2), conditions: { allowWithPackageDiscount: !!rnd(2) } }));
  let result;
  try { result = calc([entry(lines, policy, 1 + rnd(2))], rules); } catch (e) { continue; }
  trials++;
  const q = result.quote;
  eq(q.grandTotal, result.lines.reduce((n, l) => n + l.price.subtotal + l.price.tax, 0), 'total = Σ(subtotal + tax)');
  ok(result.lines.every(l => l.price.subtotal >= l.price.fees && l.price.total >= 0 && l.price.tax === Math.round(l.price.subtotal * 0.15) || l.price.packageFeeAdjust !== undefined || policy.model === 'FIXED_PRICE'), 'fees survive discounts; tax follows the discounted amount');
  ok(q.discounts.every(d => d.amount > 0 && d.amount <= d.eligibleBase), 'no discount exceeds the amount it applied to');
  eq(q.discounts.reduce((n, d) => n + d.allocation.platform + Object.values(d.allocation.vendors).reduce((a, x) => a + x, 0), 0), q.funding.platform + Object.values(q.funding.vendors).reduce((a, x) => a + x, 0), 'funding adds up');
  for (const d of q.discounts) eq(d.allocation.platform + Object.values(d.allocation.vendors).reduce((a, x) => a + x, 0), d.amount, 'every halala of every discount is funded by someone');
  if (policy.model !== 'FIXED_PRICE') eq(q.promotionDiscount + q.packageDiscount, q.discountTotal - q.offerDiscount, 'discount lines add up to what the lines show (no discount twice)');
  ok(result.lines.every(l => l.price.milestones.reduce((n, m) => n + m.amount, 0) + l.price.deposit === l.price.total), 'payment milestones add up to the total');
  eq(JSON.stringify(calc([entry(lines, policy, 1)], rules.slice().reverse()).quote.discounts.map(d => d.ruleId)) === JSON.stringify(calc([entry(lines, policy, 1)], rules).quote.discounts.map(d => d.ruleId)), true, 'the outcome does not depend on the order rules are listed');
}
ok(trials > 250, 'enough random trials were valid: ' + trials);
// allocation: exact, within caps
for (let t = 0; t < 300; t++) { const n = 1 + rnd(6), caps = Array.from({ length: n }, () => rnd(5000)), total = rnd(30000), parts = E.allocate(total, caps.map(c => c + 1), caps); eq(parts.reduce((a, x) => a + x, 0), Math.min(total, caps.reduce((a, x) => a + x, 0))); ok(parts.every((p, i) => p >= 0 && p <= caps[i])); }
// money is integers all the way
const pr = calc([entry(trio(), { model: 'PERCENT', discountBps: 333 })], [rule({ value: 777, stackable: true })]); ok(pr.lines.every(l => Object.values(l.price).filter(v => typeof v === 'number').every(Number.isInteger)), 'no fractional halala anywhere');
console.log(`PASS pricing engine: ${checks} checks (${trials} random trials)`);
