/*
 * The one pricing engine. Everything here is pure (no database, no clock except the one passed in) and works in integer halala, so a total is the
 * same number every time it is computed and no float ever touches money.
 *
 * Order of calculation (this is the documented, deterministic sequence):
 *   1. each selected offer is priced by offerPrice() (base, options, fees, the offer's own discount, tax, deposit, commission)
 *   2. a package's pricing policy is applied to its components: SUM | FIXED_PRICE | PERCENT | FIXED_AMOUNT | TIERED
 *   3. discount rules (promotions) are evaluated against what is left, under the stacking policy below
 *   4. tax is recomputed on the discounted amount, fees are never discounted, and the payable total is produced
 *
 * Stacking policy: rules are `stackable` (combine in priority order, one per stackingGroup) or not (apply alone).
 * A rule never combines with a package's own discount unless it says so (`conditions.allowWithPackageDiscount`); otherwise the engine also
 * prices the cart WITHOUT the package discount and keeps whichever outcome the customer pays least for (a higher configured `priority` wins first).
 */
import { amount } from '@/lib/booking/engine';
import { fixedPackagePrices } from './engine';

export const CALCULATION_VERSION = 1;
export type PackageModel = 'SUM' | 'FIXED_PRICE' | 'PERCENT' | 'FIXED_AMOUNT' | 'TIERED';
export type Funding = 'PLATFORM' | 'VENDOR' | 'SHARED';

export interface PackagePolicy {
  id?: string; version?: number; model: PackageModel;
  fixedPrice?: number | null; discountBps?: number | null; discountAmount?: number | null;
  config?: {
    eligibleOfferIds?: string[]; tiers?: { minCount: number; bps: number }[]; tierStrategy?: 'HIGHEST' | 'LOWEST'; countBy?: 'DISTINCT' | 'QUANTITY';
    allowOfferDiscount?: boolean; allowPromotions?: boolean; minComponents?: number; maxComponents?: number; funding?: Funding; vendorShareBps?: number;
  };
}
export interface RuleConditions { minQuantity?: number; maxQuantity?: number; minServices?: number; cityIds?: string[]; allowWithPackageDiscount?: boolean; customer?: { firstOrderOnly?: boolean; minCompletedOrders?: number; customerIds?: string[] } }
export interface Rule {
  id: string; version: number; name: string; kind: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number; maxDiscount: number | null; minSubtotal: number;
  priority: number; stackable: boolean; stackingGroup: string | null; funding: Funding; vendorShareBps: number; code: string | null;
  startsAt: string | null; endsAt: string | null; usageLimit: number | null; perCustomerLimit: number | null; ownerVendorId?: string | null; status: string;
  conditions: RuleConditions; targets: { packageIds: string[]; serviceIds: string[]; offerIds: string[]; vendorIds: string[] };
}
export interface Context { now: Date; customerId?: string | null; completedOrders?: number | null; promoCodes?: string[]; usage?: (ruleId: string) => { total: number; byCustomer: number } }
export interface Entry { entryId: string; packageId?: string | null; policy?: PackagePolicy | null; quantity: number; standalone: any[]; packaged: any[]; savings: number; adjustments: Adjustment[] }
export interface Adjustment { source: 'PACKAGE'; description: string; amount: number; eligibleBase: number; model: PackageModel; funding: Funding; allocation: Allocation }
export interface Allocation { platform: number; vendors: Record<string, number>; platformByVendor: Record<string, number> }
export interface AppliedRule { ruleId: string; version: number; name: string; kind: string; amount: number; eligibleBase: number; funding: Funding; allocation: Allocation; lineIds: string[]; snapshot: any }
export interface Rejected { ruleId: string | null; name: string; code: string; reasonAr: string }

export const discountable = (line: any) => Math.max(0, line.price.subtotal - line.price.fees);        // fees and tax are never discounted
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

/** Splits `total` over weights exactly (largest remainder, ties by position), never giving a line more than its cap. */
export function allocate(total: number, weights: number[], caps: number[]): number[] {
  const out = weights.map(() => 0);
  let remaining = Math.min(total, sum(caps)); if (remaining <= 0) return out;
  let open = weights.map((_, i) => i).filter(i => caps[i] > 0);
  while (remaining > 0 && open.length) {
    const w = sum(open.map(i => weights[i])) || open.length, shares = open.map(i => ({ i, exact: remaining * ((weights[i] || 1) / w) }));
    const floors = shares.map(s => Math.min(Math.floor(s.exact), caps[s.i] - out[s.i]));
    shares.forEach((s, k) => { out[s.i] += floors[k]; });
    let left = remaining - sum(floors);
    const byRemainder = shares.map((s, k) => ({ i: s.i, frac: s.exact - Math.floor(s.exact), k })).sort((a, b) => b.frac - a.frac || a.k - b.k);
    for (const r of byRemainder) { if (left <= 0) break; if (out[r.i] < caps[r.i]) { out[r.i]++; left--; } }
    const given = sum(out); remaining = Math.min(total, sum(caps)) - given;
    open = open.filter(i => out[i] < caps[i]);
    if (!floors.some(f => f > 0) && left > 0 && !open.length) break;
  }
  return out;
}

/** Takes `d` off a line's discountable amount and recomputes tax, total, deposit, milestones and commission from it. */
export function reprice(line: any, d: number, fund: { vendor: number; platform: number }): any {
  const p = line.price, take = Math.min(d, discountable(line));
  if (take <= 0) return line;
  const subtotal = p.subtotal - take, tax = Math.round(subtotal * line.policy.taxBps / 10000), total = subtotal + tax, deposit = Math.round(total * line.policy.depositBps / 10000);
  const vendor = (p.funding?.vendor ?? 0) + Math.min(fund.vendor, take), platform = (p.funding?.platform ?? 0) + Math.min(fund.platform, take - Math.min(fund.vendor, take));
  // The provider's commission is charged on what the provider agreed to be paid: the price after discounts THEY fund, plus any discount the platform funds.
  const commission = Math.round((subtotal + platform) * line.policy.commissionBps / 10000);
  let remain = total - deposit;
  const milestones = line.policy.paymentMilestones.map((m: any, i: number) => { const value = i === line.policy.paymentMilestones.length - 1 ? remain : Math.min(remain, Math.round(total * m.percentBps / 10000)); remain -= value; return { ...m, amount: value }; });
  return { ...line, price: { ...p, discount: p.discount + take, subtotal, tax, total, deposit, commission, milestones, funding: { vendor, platform } } };
}
const fundSplit = (funding: Funding, share: number, d: number) => (funding === 'PLATFORM' ? { vendor: 0, platform: d } : funding === 'VENDOR' ? { vendor: d, platform: 0 } : { vendor: Math.round(d * share / 10000), platform: d - Math.round(d * share / 10000) });

/** Which discount (in halala) a package policy gives these components, and how it is shared out. */
export function validatePolicy(policy: PackagePolicy, items: { optional?: boolean; hasSubstitutions?: boolean }[] = []): string | null {
  const c = policy.config ?? {};
  if (!['SUM', 'FIXED_PRICE', 'PERCENT', 'FIXED_AMOUNT', 'TIERED'].includes(policy.model)) return 'نموذج التسعير غير صالح';
  if (policy.model === 'FIXED_PRICE') { if (!Number.isSafeInteger(policy.fixedPrice) || (policy.fixedPrice as number) <= 0) return 'أدخل سعراً ثابتاً صالحاً'; if (items.some(i => i.optional || i.hasSubstitutions)) return 'السعر الثابت يتطلب باقة ثابتة دون عناصر اختيارية أو بدائل'; }
  if (policy.model === 'PERCENT' && (!Number.isInteger(policy.discountBps) || (policy.discountBps as number) <= 0 || (policy.discountBps as number) > 10000)) return 'نسبة الخصم يجب أن تكون بين 0 و100%';
  if (policy.model === 'FIXED_AMOUNT' && (!Number.isSafeInteger(policy.discountAmount) || (policy.discountAmount as number) <= 0)) return 'أدخل مبلغ خصم صالحاً';
  if (policy.model === 'TIERED') {
    const t = c.tiers ?? [];
    if (!t.length || t.length > 10) return 'أضف شرائح الخصم (من 1 إلى 10)';
    for (let i = 0; i < t.length; i++) { if (!Number.isInteger(t[i].minCount) || t[i].minCount < 1 || !Number.isInteger(t[i].bps) || t[i].bps < 0 || t[i].bps > 10000) return 'شريحة غير صالحة'; if (i && (t[i].minCount <= t[i - 1].minCount || t[i].bps < t[i - 1].bps)) return 'الشرائح يجب أن تتصاعد في العدد والنسبة'; }
  }
  if (c.minComponents !== undefined && (!Number.isInteger(c.minComponents) || c.minComponents < 0)) return 'الحد الأدنى للمكونات غير صالح';
  if (c.maxComponents !== undefined && (!Number.isInteger(c.maxComponents) || c.maxComponents < 1 || (c.minComponents ?? 0) > c.maxComponents)) return 'الحد الأقصى للمكونات غير صالح';
  if (c.funding && !['PLATFORM', 'VENDOR', 'SHARED'].includes(c.funding)) return 'جهة تمويل الخصم غير صالحة';
  if (c.vendorShareBps !== undefined && (!Number.isInteger(c.vendorShareBps) || c.vendorShareBps < 0 || c.vendorShareBps > 10000)) return 'حصة المورد من التمويل غير صالحة';
  return null;
}

/** Step 2: the package's own pricing. Returns the re-priced components and the adjustment it made (if any). */
export function applyPackagePolicy(lines: any[], policy: PackagePolicy, quantity: number): { lines: any[]; adjustments: Adjustment[] } {
  const c = policy.config ?? {}, funding = c.funding ?? 'VENDOR', share = c.vendorShareBps ?? 0;
  const standalone = lines.map(l => ({ ...l, price: { ...l.price, standaloneSubtotal: l.price.subtotal } }));
  const eligible = (l: any) => !c.eligibleOfferIds?.length || c.eligibleOfferIds.includes(l.offerId);
  const nonEmpty = lines.length;
  if (c.minComponents !== undefined && nonEmpty < c.minComponents) throw new Error('اختر ' + c.minComponents + ' مكونات على الأقل');
  if (c.maxComponents !== undefined && nonEmpty > c.maxComponents) throw new Error('الحد الأقصى ' + c.maxComponents + ' مكونات');
  if (policy.model === 'SUM') return { lines: standalone, adjustments: [] };
  if (policy.model === 'FIXED_PRICE') {
    const before = sum(standalone.map(l => l.price.subtotal)), out = fixedPackagePrices(standalone, amount((policy.fixedPrice ?? 0) * quantity));
    const after = sum(out.map(l => l.price.subtotal)), saved = Math.max(0, before - after);
    const withFunding = out.map(l => { const d = Math.max(0, l.price.standaloneSubtotal - l.price.subtotal); const f = fundSplit(funding, share, d); return { ...l, price: { ...l.price, funding: { vendor: f.vendor, platform: f.platform }, commission: Math.round((l.price.subtotal + f.platform) * l.policy.commissionBps / 10000) } }; });
    return { lines: withFunding, adjustments: saved ? [{ source: 'PACKAGE', description: 'سعر الباقة الثابت', amount: saved, eligibleBase: before, model: 'FIXED_PRICE', funding, allocation: allocationOf(withFunding, standalone, funding, share) }] : [] };
  }
  const allowOffer = c.allowOfferDiscount === true;
  if (!allowOffer && lines.some(l => eligible(l) && l.price.discount > 0)) throw new Error('لا يجمع خصم الباقة مع خصم العرض نفسه');
  const idx = lines.map((l, i) => i).filter(i => eligible(lines[i]) && !lines[i].price.needsQuote);
  const caps = idx.map(i => discountable(standalone[i])), base = sum(caps);
  let total = 0, label = '';
  if (policy.model === 'PERCENT') { total = Math.round(base * (policy.discountBps ?? 0) / 10000); label = `خصم الباقة ${(policy.discountBps ?? 0) / 100}%`; }
  if (policy.model === 'FIXED_AMOUNT') { total = Math.min(base, (policy.discountAmount ?? 0) * quantity); label = 'خصم الباقة بمبلغ ثابت'; }
  if (policy.model === 'TIERED') {
    const count = c.countBy === 'QUANTITY' ? sum(idx.map(i => lines[i].selection?.quantity ?? 1)) : new Set(idx.map(i => lines[i].offerId)).size;
    const tiers = c.tiers ?? [], hit = c.tierStrategy === 'LOWEST' ? tiers.find(t => count >= t.minCount && t.bps > 0) : [...tiers].reverse().find(t => count >= t.minCount);   // HIGHEST (default): the best tier that qualifies; LOWEST: the smallest one that gives any discount
    total = hit ? Math.round(base * hit.bps / 10000) : 0; label = hit ? `خصم الشريحة ${hit.bps / 100}% (${count} خدمات)` : '';
  }
  total = Math.min(total, base);
  if (!total) return { lines: standalone, adjustments: [] };
  const parts = allocate(total, caps, caps), out = standalone.slice();
  idx.forEach((i, k) => { const f = fundSplit(funding, share, parts[k]); out[i] = reprice(standalone[i], parts[k], f); });
  return { lines: out, adjustments: [{ source: 'PACKAGE', description: label, amount: total, eligibleBase: base, model: policy.model, funding, allocation: allocationOf(out, standalone, funding, share) }] };
}
function allocationOf(after: any[], before: any[], funding: Funding, share: number): Allocation {
  const out: Allocation = { platform: 0, vendors: {}, platformByVendor: {} };
  after.forEach((l, i) => { const d = Math.max(0, before[i].price.subtotal - l.price.subtotal), f = fundSplit(funding, share, d), v = l.vendorId ?? 'unknown'; out.platform += f.platform; if (f.platform) out.platformByVendor[v] = (out.platformByVendor[v] ?? 0) + f.platform; if (f.vendor) out.vendors[v] = (out.vendors[v] ?? 0) + f.vendor; });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- discount rules
const norm = (code: string) => code.trim().toUpperCase();
const ar = {
  INACTIVE: 'القاعدة غير مفعلة', NOT_STARTED: 'لم تبدأ بعد', EXPIRED: 'انتهت صلاحيتها', CODE_REQUIRED: 'تتطلب رمزاً ترويجياً', USAGE_LIMIT: 'استُنفد الحد الأقصى للاستخدام', CUSTOMER_LIMIT: 'استخدمتها بالحد الأقصى المسموح لك',
  NO_ELIGIBLE: 'لا توجد عناصر مؤهلة في سلتك', MIN_SUBTOTAL: 'المبلغ المؤهل أقل من الحد الأدنى', QUANTITY: 'الكمية خارج نطاق الخصم', SERVICES: 'عدد الخدمات أقل من المطلوب', CITY: 'غير متاحة في هذه المدينة',
  CUSTOMER: 'غير مؤهل لهذا الخصم', CUSTOMER_REQUIRED: 'سجّل الدخول للتحقق من أهليتك', PACKAGE_DISCOUNT: 'لا تجتمع مع خصم الباقة', NOT_BEST: 'اختير عرض أوفر لك', NOT_STACKABLE: 'لا تجتمع مع خصم آخر', GROUP: 'يوجد خصم أفضل من المجموعة نفسها', ZERO: 'لا قيمة للخصم على هذه السلة', PRIORITY: 'عرض بأولوية أعلى طُبّق',
};
type Check = { ok: true; lines: number[]; base: number } | { ok: false; code: string };
interface Blocked { soft: Set<number>; hard: Set<number> }       // soft: lines whose package already has a discount (a rule may say it combines); hard: the package excludes promotions outright
function eligibility(rule: Rule, lines: any[], ctx: Context, blockedLines: Blocked): Check {
  const now = +ctx.now;
  const blocked = rule.conditions.allowWithPackageDiscount ? blockedLines.hard : new Set([...Array.from(blockedLines.soft), ...Array.from(blockedLines.hard)]);
  if (rule.status !== 'ACTIVE') return { ok: false, code: 'INACTIVE' };
  if (rule.startsAt && now < Date.parse(rule.startsAt)) return { ok: false, code: 'NOT_STARTED' };
  if (rule.endsAt && now >= Date.parse(rule.endsAt)) return { ok: false, code: 'EXPIRED' };
  if (rule.code && !(ctx.promoCodes ?? []).some(c => norm(c) === norm(rule.code as string))) return { ok: false, code: 'CODE_REQUIRED' };
  const u = ctx.usage?.(rule.id);
  if (rule.usageLimit !== null && u && u.total >= rule.usageLimit) return { ok: false, code: 'USAGE_LIMIT' };
  if (rule.perCustomerLimit !== null && u && ctx.customerId && u.byCustomer >= rule.perCustomerLimit) return { ok: false, code: 'CUSTOMER_LIMIT' };
  const cu = rule.conditions.customer;
  if (cu) {
    if (!ctx.customerId) return { ok: false, code: 'CUSTOMER_REQUIRED' };
    if (cu.customerIds?.length && !cu.customerIds.includes(ctx.customerId)) return { ok: false, code: 'CUSTOMER' };
    if (cu.firstOrderOnly && (ctx.completedOrders ?? 0) > 0) return { ok: false, code: 'CUSTOMER' };
    if (cu.minCompletedOrders && (ctx.completedOrders ?? 0) < cu.minCompletedOrders) return { ok: false, code: 'CUSTOMER' };
  }
  const t = rule.targets, anyTarget = t.packageIds.length + t.serviceIds.length + t.offerIds.length + t.vendorIds.length > 0;
  const hit = (l: any) => (!rule.ownerVendorId || l.vendorId === rule.ownerVendorId) && (!anyTarget || (l.packageId && t.packageIds.includes(l.packageId)) || t.serviceIds.includes(l.serviceId) || t.offerIds.includes(l.offerId) || (l.vendorId && t.vendorIds.includes(l.vendorId)))
    && (!rule.conditions.cityIds?.length || rule.conditions.cityIds.includes(l.selection?.cityId));
  const idx = lines.map((l, i) => i).filter(i => !lines[i].price.needsQuote && !blocked.has(i) && hit(lines[i]) && discountable(lines[i]) > 0);
  if (!idx.length) return { ok: false, code: blocked.size && lines.some((l, i) => blocked.has(i) && hit(l)) ? 'PACKAGE_DISCOUNT' : 'NO_ELIGIBLE' };
  const base = sum(idx.map(i => discountable(lines[i])));
  if (base < rule.minSubtotal) return { ok: false, code: 'MIN_SUBTOTAL' };
  const qty = sum(idx.map(i => lines[i].selection?.quantity ?? 1));
  if ((rule.conditions.minQuantity && qty < rule.conditions.minQuantity) || (rule.conditions.maxQuantity && qty > rule.conditions.maxQuantity)) return { ok: false, code: 'QUANTITY' };
  if (rule.conditions.minServices && new Set(idx.map(i => lines[i].serviceId)).size < rule.conditions.minServices) return { ok: false, code: 'SERVICES' };
  return { ok: true, lines: idx, base };
}
function ruleAmount(rule: Rule, base: number): number {
  let d = rule.type === 'PERCENTAGE' ? Math.round(base * rule.value / 10000) : Math.min(base, rule.value);
  if (rule.maxDiscount !== null) d = Math.min(d, rule.maxDiscount);
  return Math.max(0, Math.min(d, base));
}
const snapshotOf = (r: Rule) => ({ id: r.id, version: r.version, name: r.name, kind: r.kind, type: r.type, value: r.value, maxDiscount: r.maxDiscount, minSubtotal: r.minSubtotal, priority: r.priority, stackable: r.stackable, stackingGroup: r.stackingGroup, funding: r.funding, vendorShareBps: r.vendorShareBps, code: r.code, startsAt: r.startsAt, endsAt: r.endsAt, conditions: r.conditions });

/** Applies rules one after another (each on what the previous left). A rule that no longer qualifies after the earlier ones is dropped with a reason. */
function runSequence(rules: Rule[], lines: any[], ctx: Context, blocked: Blocked) {
  let current = lines; const applied: AppliedRule[] = [], dropped: Rejected[] = [];
  for (const rule of rules) {
    const check = eligibility(rule, current, ctx, blocked);
    if (!check.ok) { dropped.push({ ruleId: rule.id, name: rule.name, code: check.code, reasonAr: ar[check.code as keyof typeof ar] }); continue; }
    const total = ruleAmount(rule, check.base);
    if (!total) { dropped.push({ ruleId: rule.id, name: rule.name, code: 'ZERO', reasonAr: ar.ZERO }); continue; }
    const caps = check.lines.map(i => discountable(current[i])), parts = allocate(total, caps, caps), next = current.slice(), vendors: Record<string, number> = {}, platformByVendor: Record<string, number> = {}; let platform = 0;
    check.lines.forEach((i, k) => { const f = fundSplit(rule.funding, rule.vendorShareBps, parts[k]); next[i] = reprice(current[i], parts[k], f); platform += f.platform; const v = current[i].vendorId ?? 'unknown'; if (f.platform) platformByVendor[v] = (platformByVendor[v] ?? 0) + f.platform; if (f.vendor) vendors[v] = (vendors[v] ?? 0) + f.vendor; });
    applied.push({ ruleId: rule.id, version: rule.version, name: rule.name, kind: rule.kind, amount: total, eligibleBase: check.base, funding: rule.funding, allocation: { platform, vendors, platformByVendor }, lineIds: check.lines.map(i => current[i].cartLineId), snapshot: snapshotOf(rule) });
    current = next;
  }
  return { lines: current, applied, dropped };
}

export interface Quote {
  calculationVersion: number; currency: 'SAR'; unit: 'HALALA'; mode: 'PACKAGE' | 'NO_PACKAGE';
  models: { entryId: string; packageId: string | null; model: PackageModel | 'SINGLE'; policyId: string | null; policyVersion: number | null }[];
  componentSubtotal: number; optionalExtras: number; fees: number; offerDiscount: number; packageDiscount: number; promotionDiscount: number; discountTotal: number; taxes: number; grandTotal: number;
  discounts: { source: 'PACKAGE' | 'RULE'; ruleId: string | null; ruleVersion: number | null; description: string; amount: number; eligibleBase: number; funding: Funding; allocation: Allocation; snapshot?: any }[];
  rejected: Rejected[]; funding: Allocation; quoteStatus: 'ESTIMATE' | 'FIRM'; requiresAcknowledgment: false;
  components: { lineId: string; offerId: string; packageId: string | null; packageItemId: string | null; vendorId: string | null; type: 'SERVICE' | 'PACKAGE_COMPONENT'; quantity: number; unitPrice: number; gross: number; discount: number; net: number; tax: number; vendorFunded: number; platformFunded: number; commission: number }[];
}

/** Step 3 and 4: promotions over the packaged lines, with the standalone lines as the alternative when a package discount and a promotion cannot be combined. */
export function calculate(entries: Entry[], rules: Rule[], ctx: Context): { lines: any[]; quote: Quote } {
  const hasPackageDiscount = entries.some(e => e.savings > 0);
  const packagedLines = entries.flatMap(e => e.packaged), standaloneLines = entries.flatMap(e => e.standalone);
  const blockedFor = (mode: 'PACKAGE' | 'NO_PACKAGE'): Blocked => {
    const blocked: Blocked = { soft: new Set<number>(), hard: new Set<number>() }; if (mode === 'NO_PACKAGE') return blocked;
    let offset = 0;
    for (const e of entries) { e.packaged.forEach((_, i) => { if (e.policy?.config?.allowPromotions === false) blocked.hard.add(offset + i); else if (e.savings > 0) blocked.soft.add(offset + i); }); offset += e.packaged.length; }
    return blocked;
  };
  // rules in a fixed order: priority (high first), then larger value, then id: the same input always gives the same result
  const ordered = [...rules].sort((a, b) => b.priority - a.priority || b.value - a.value || a.id.localeCompare(b.id));
  const rejected: Rejected[] = [];
  const modes: ("PACKAGE" | "NO_PACKAGE")[] = hasPackageDiscount ? ['PACKAGE', 'NO_PACKAGE'] : ['PACKAGE'];
  type Outcome = { mode: 'PACKAGE' | 'NO_PACKAGE'; lines: any[]; applied: AppliedRule[]; dropped: Rejected[]; payable: number; maxPriority: number };
  const outcomes: Outcome[] = [], qualifiedIds = new Set<string>();
  for (const mode of modes) {
    const base = mode === 'PACKAGE' ? packagedLines : standaloneLines, blocked = blockedFor(mode);
    // which rules qualify at all in this mode (the first check, before any other rule has changed the amounts)
    const qualifying = ordered.filter(r => eligibility(r, base, ctx, blocked).ok);
    qualifying.forEach(r => qualifiedIds.add(r.id));
    // one rule per stacking group: the best of the group (priority, then the larger discount)
    const groups = new Map<string, Rule[]>(), loose: Rule[] = [];
    for (const r of qualifying.filter(x => x.stackable)) { if (r.stackingGroup) groups.set(r.stackingGroup, [...(groups.get(r.stackingGroup) ?? []), r]); else loose.push(r); }
    const stack = [...loose];
    for (const [, members] of Array.from(groups.entries())) { const best = [...members].sort((a, b) => b.priority - a.priority || ruleAmount(b, (eligibility(b, base, ctx, blocked) as any).base) - ruleAmount(a, (eligibility(a, base, ctx, blocked) as any).base) || a.id.localeCompare(b.id))[0]; stack.push(best); }
    stack.sort((a, b) => b.priority - a.priority || b.value - a.value || a.id.localeCompare(b.id));
    const candidates: Rule[][] = [[]];
    if (stack.length) candidates.push(stack);
    for (const r of qualifying.filter(x => !x.stackable)) candidates.push([r]);
    for (const set of candidates) {
      const run = runSequence(set, base, ctx, blocked);
      // maxPriority 0 = no priority configured: only a configured (positive) priority can override "the customer pays least"
      outcomes.push({ mode, lines: run.lines, applied: run.applied, dropped: run.dropped, payable: sum(run.lines.map(l => l.price.total)), maxPriority: Math.max(0, ...set.filter(r => run.applied.some(a => a.ruleId === r.id)).map(r => r.priority)) });
    }
    // rules that do not qualify in the first mode are explained once, with the reason of the first mode that evaluated them
    if (mode === modes[0]) for (const r of ordered) { const c = eligibility(r, base, ctx, blocked); if (!c.ok && !(r.code && c.code === 'CODE_REQUIRED')) rejected.push({ ruleId: r.id, name: r.name, code: c.code, reasonAr: ar[c.code as keyof typeof ar] }); }
  }
  // the winner: a configured higher priority first, otherwise what the customer pays least, then the simpler outcome
  const best = [...outcomes].sort((a, b) => b.maxPriority - a.maxPriority || a.payable - b.payable || a.applied.length - b.applied.length || (a.mode === 'PACKAGE' ? -1 : 1))[0];
  const appliedIds = new Set(best.applied.map(a => a.ruleId));
  const appliedRules = ordered.filter(r => appliedIds.has(r.id));
  for (const d of best.dropped) if (!rejected.some(x => x.ruleId === d.ruleId)) rejected.push(d);    // dropped inside the winning outcome: the reason it stopped qualifying
  for (const id of Array.from(qualifiedIds)) {
    if (appliedIds.has(id) || rejected.some(x => x.ruleId === id)) continue;
    const rule = ordered.find(x => x.id === id) as Rule;
    const code = appliedRules.some(a => a.priority > rule.priority) ? 'PRIORITY' : rule.stackingGroup && appliedRules.some(a => a.stackingGroup === rule.stackingGroup) ? 'GROUP' : !rule.stackable || appliedRules.some(a => !a.stackable) ? 'NOT_STACKABLE' : 'NOT_BEST';
    rejected.push({ ruleId: id, name: rule.name, code, reasonAr: ar[code as keyof typeof ar] });
  }
  for (const o of outcomes) for (const d of o.dropped) if (!appliedIds.has(d.ruleId as string) && !rejected.some(x => x.ruleId === d.ruleId)) rejected.push(d);
  if (best.mode === 'NO_PACKAGE' && hasPackageDiscount) for (const e of entries) if (e.savings > 0) rejected.push({ ruleId: null, name: e.adjustments[0]?.description ?? 'خصم الباقة', code: 'PACKAGE_DISCOUNT', reasonAr: 'لم يُطبَّق خصم الباقة لأن العرض الترويجي أوفر لك ولا يجتمع معه' });

  const lines = best.lines, usePackage = best.mode === 'PACKAGE';
  const discounts: Quote['discounts'] = [
    ...(usePackage ? entries.flatMap(e => e.adjustments.map(a => ({ source: 'PACKAGE' as const, ruleId: null, ruleVersion: null, description: a.description, amount: a.amount, eligibleBase: a.eligibleBase, funding: a.funding, allocation: a.allocation }))) : []),
    ...best.applied.map(a => ({ source: 'RULE' as const, ruleId: a.ruleId, ruleVersion: a.version, description: a.name, amount: a.amount, eligibleBase: a.eligibleBase, funding: a.funding, allocation: a.allocation, snapshot: a.snapshot })),
  ];
  const packageDiscount = sum(discounts.filter(d => d.source === 'PACKAGE').map(d => d.amount)), promotionDiscount = sum(discounts.filter(d => d.source === 'RULE').map(d => d.amount));
  const funding: Allocation = { platform: 0, vendors: {}, platformByVendor: {} };
  for (const d of discounts) { funding.platform += d.allocation.platform; for (const [v, a] of Object.entries(d.allocation.vendors)) funding.vendors[v] = (funding.vendors[v] ?? 0) + a; for (const [v, a] of Object.entries(d.allocation.platformByVendor)) funding.platformByVendor[v] = (funding.platformByVendor[v] ?? 0) + a; }
  const subtotals = sum(lines.map(l => l.price.subtotal)), taxes = sum(lines.map(l => l.price.tax)), grandTotal = sum(lines.map(l => l.price.total));
  const quote: Quote = {
    calculationVersion: CALCULATION_VERSION, currency: 'SAR', unit: 'HALALA', mode: best.mode,
    models: entries.map(e => ({ entryId: e.entryId, packageId: e.packageId ?? null, model: e.policy?.model ?? 'SINGLE', policyId: e.policy?.id ?? null, policyVersion: e.policy?.version ?? null })),
    componentSubtotal: sum(lines.map(l => l.price.base)), optionalExtras: sum(lines.map(l => l.price.optionsAmount)), fees: sum(lines.map(l => l.price.fees)),
    offerDiscount: sum(lines.map(l => (l.price.offerDiscount ?? 0))), packageDiscount, promotionDiscount, discountTotal: sum(lines.map(l => l.price.discount)), taxes, grandTotal,
    discounts, rejected, funding, quoteStatus: lines.some(l => l.price.needsQuote) ? 'ESTIMATE' : 'FIRM', requiresAcknowledgment: false,
    components: lines.map(l => { const gross = l.price.standaloneSubtotal ?? (l.price.subtotal + l.price.discount - (l.price.packageFeeAdjust ?? 0)); const net = l.price.subtotal; return { lineId: l.cartLineId, offerId: l.offerId, packageId: l.packageId ?? null, packageItemId: l.selection?.itemKey ?? null, vendorId: l.vendorId ?? null, type: l.packageId ? 'PACKAGE_COMPONENT' : 'SERVICE', quantity: l.selection?.quantity ?? 1, unitPrice: Math.round((l.price.base) / Math.max(1, l.selection?.quantity ?? 1)), gross: Math.max(gross, net), discount: Math.max(gross, net) - net, net, tax: l.price.tax, vendorFunded: l.price.funding?.vendor ?? 0, platformFunded: l.price.funding?.platform ?? 0, commission: l.price.commission ?? 0 }; }),
  };
  void subtotals;
  return { lines, quote };
}
