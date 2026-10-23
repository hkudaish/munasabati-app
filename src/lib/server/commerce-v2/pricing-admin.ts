import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireUser, rateLimit } from '../auth';
import { HttpError, text, integer } from '../http';
import { atomic, lock, admin, Tx } from '../booking/repository';
import { validatePolicy, PackagePolicy, Rule } from '@/lib/commerce/pricing-engine';
import { mergePolicy } from '@/lib/booking/engine';
import { loadPolicy, loadRules, policyFromRow, policyView, ruleFromRow } from './pricing';
import { activate, mirrorToPackage } from './pricing-policy';
import { parseLines, parsePromoCodes, publicQuote, quoteLines } from './cart';

/** Administrators and supervisors manage everything; a vendor only what they own. */
async function actor() {
  const user = await requireUser();
  if (!admin(user) && user.role !== 'VENDOR') throw new HttpError(403, 'غير مخول');
  if (user.role === 'VENDOR' && user.vendorProfile?.status !== 'ACTIVE') throw new HttpError(403, 'يلزم اعتماد المورد');
  await rateLimit('pricing-admin:' + user.id, 240);
  return user;
}
const money = (value: unknown, max = 2_000_000_000) => integer(value, max);
async function ownedPackage(tx: Tx, user: any, id: string) {
  const row = (await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackage" WHERE "id"=${text(id, 140, true)}`)[0];
  if (!row || (!admin(user) && row.ownerId !== user.id)) throw new HttpError(404, 'الباقة غير موجودة');
  return row;
}

// ---------------------------------------------------------------------------------------------------------------- package policies
const FUNDINGS = ['PLATFORM', 'VENDOR', 'SHARED'];
function cleanConfig(input: any, user: any, itemOffers: Set<string>) {
  const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {}, out: Record<string, unknown> = {};
  if (Array.isArray(c.eligibleOfferIds) && c.eligibleOfferIds.length) { const ids = c.eligibleOfferIds.map((x: unknown) => text(x, 140, true)); if (ids.some((id: string) => !itemOffers.has(id))) throw new HttpError(400, 'مكون غير موجود في الباقة'); out.eligibleOfferIds = Array.from(new Set(ids)); }
  if (Array.isArray(c.tiers)) out.tiers = c.tiers.slice(0, 10).map((t: any) => ({ minCount: integer(t?.minCount, 1000, 0), bps: integer(t?.bps, 10000, 0) }));
  if (c.tierStrategy !== undefined) { if (!['HIGHEST', 'LOWEST'].includes(c.tierStrategy)) throw new HttpError(400, 'بيانات غير صالحة'); out.tierStrategy = c.tierStrategy; }
  if (c.countBy !== undefined) { if (!['DISTINCT', 'QUANTITY'].includes(c.countBy)) throw new HttpError(400, 'بيانات غير صالحة'); out.countBy = c.countBy; }
  for (const key of ['allowOfferDiscount', 'allowPromotions']) if (c[key] !== undefined) out[key] = c[key] === true;
  for (const key of ['minComponents', 'maxComponents']) if (c[key] !== undefined && c[key] !== null && c[key] !== '') out[key] = integer(c[key], 1000, 0);
  if (c.funding !== undefined) { if (!FUNDINGS.includes(c.funding)) throw new HttpError(400, 'جهة تمويل الخصم غير صالحة'); if (!admin(user) && c.funding !== 'VENDOR') throw new HttpError(403, 'تمويل الخصم من المنصة يحدده الإداريون'); out.funding = c.funding; }
  if (c.vendorShareBps !== undefined) out.vendorShareBps = integer(c.vendorShareBps, 10000, 0);
  return out;
}
async function countAffectedCarts(client: Tx | typeof prisma, filter: { packageId?: string; offerId?: string }) {
  const key = filter.packageId ? 'packageId' : 'offerId', value = filter.packageId ?? filter.offerId ?? '';
  return Number((await client.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "CommerceCart" c WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(c."body"->'lines') l WHERE l->>${key} = ${value})`)[0].n);
}

export async function listPolicies(packageId: string) {
  const user = await actor();
  const pack = await ownedPackage(prisma as any, user, packageId);
  const policies = await prisma.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "packageId"=${pack.id} ORDER BY "version" DESC LIMIT 100`;
  const current = await loadPolicy(prisma as any, pack, new Date());
  return { package: { id: pack.id, body: pack.body, version: pack.version }, current: policyView(current), policies: policies.map(r => ({ ...policyView(policyFromRow(r)), status: r.status, effectiveFrom: r.effectiveFrom, effectiveUntil: r.effectiveUntil, createdAt: r.createdAt, createdBy: r.createdBy })), affectedCarts: await countAffectedCarts(prisma as any, { packageId: pack.id }) };
}

export async function savePolicy(input: any) {
  const user = await actor();
  return atomic(async tx => {
    const pack = await ownedPackage(tx, user, input.packageId);
    await lock(tx, 'pricing-policy:' + pack.id);
    const items = await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackageItem" WHERE "packageId"=${pack.id}`;
    const model = text(input.model, 20, true) as PackagePolicy['model'];
    const percent = input.discountPercent === undefined || input.discountPercent === null || input.discountPercent === '' ? null : Number(input.discountPercent);
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.round(percent * 10000) !== percent * 10000)) throw new HttpError(400, 'نسبة الخصم يجب أن تكون بين 0 و100%');
    const policy: PackagePolicy = { model, fixedPrice: input.fixedPrice === undefined || input.fixedPrice === null ? null : money(input.fixedPrice), discountBps: percent === null ? null : Math.round(percent * 100), discountAmount: input.discountAmount === undefined || input.discountAmount === null ? null : money(input.discountAmount), config: cleanConfig(input.config, user, new Set(items.map(i => i.offerId))) as any };
    const problem = validatePolicy(policy, items.map(i => ({ optional: i.body.optional === true, hasSubstitutions: (i.body.substitutions ?? []).length > 0 })));
    if (problem) throw new HttpError(400, problem);
    if (model === 'FIXED_PRICE' && pack.body.kind !== 'FIXED') throw new HttpError(400, 'السعر الثابت يتطلب باقة من نوع «ثابتة»');
    if ((policy.config?.maxComponents ?? Infinity) > items.length + 0 && policy.config?.maxComponents !== undefined && (policy.config.minComponents ?? 0) > items.length) throw new HttpError(400, 'الحد الأدنى للمكونات أكبر من عناصر الباقة');
    const from = input.effectiveFrom ? new Date(text(input.effectiveFrom, 40, true)) : new Date(), until = input.effectiveUntil ? new Date(text(input.effectiveUntil, 40, true)) : null;
    if (!Number.isFinite(+from) || (until && (!Number.isFinite(+until) || +until <= +from))) throw new HttpError(400, 'تاريخ غير صالح');
    const version = (await tx.$queryRaw<any[]>`SELECT COALESCE(MAX("version"),0)::int AS v FROM "PackagePricingPolicy" WHERE "packageId"=${pack.id}`)[0].v + 1, id = randomUUID();
    await tx.$executeRaw`INSERT INTO "PackagePricingPolicy" ("id","packageId","pricingModel","currency","fixedPrice","discountPercentage","discountAmount","config","effectiveFrom","effectiveUntil","version","status","createdBy") VALUES (${id},${pack.id},${model},'SAR',${policy.fixedPrice},${percent},${policy.discountAmount},${JSON.stringify(policy.config ?? {})}::jsonb,${from},${until},${version},'DRAFT',${user.id})`;
    if (input.activate === true) await activate(tx, pack.id, id);
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'COMMERCE_PRICING_POLICY_SAVED', targetId: pack.id, details: { policyId: id, version, model, activated: input.activate === true } } });
    return { id, version, status: input.activate === true ? 'ACTIVE' : 'DRAFT', affectedCarts: await countAffectedCarts(tx, { packageId: pack.id }) };
  });
}
export async function policyAction(input: any) {
  const user = await actor(), action = text(input.action, 20, true);
  return atomic(async tx => {
    const row = (await tx.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "id"=${text(input.id, 140, true)}`)[0];
    if (!row) throw new HttpError(404, 'الباقة غير موجودة');
    await ownedPackage(tx, user, row.packageId); await lock(tx, 'pricing-policy:' + row.packageId);
    if (action === 'activate') { if (row.status === 'ARCHIVED') throw new HttpError(409, 'تغير الطلب'); await activate(tx, row.packageId, row.id); }
    else if (action === 'archive') {
      if (row.status !== 'ACTIVE') throw new HttpError(409, 'تغير الطلب');
      const others = (await tx.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "PackagePricingPolicy" WHERE "packageId"=${row.packageId} AND "status"='ACTIVE' AND "id" <> ${row.id}`)[0].n;
      if (!others && !input.confirmNoPolicy) throw new HttpError(409, 'لن تبقى سياسة نشطة؛ سيعود التسعير إلى مجموع المكونات');
      await tx.$executeRaw`UPDATE "PackagePricingPolicy" SET "status"='ARCHIVED' WHERE "id"=${row.id}`;
      if (!others) await mirrorToPackage(tx, row.packageId, { model: 'SUM' });
    } else throw new HttpError(400, 'إجراء غير صالح');
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'COMMERCE_PRICING_POLICY_' + action.toUpperCase(), targetId: row.packageId, details: { policyId: row.id, version: row.version } } });
    return { ok: true };
  });
}
// -------------------------------------------------------------------------------------------------------------- discount rules
const KINDS = ['GENERAL', 'PROMO_CODE', 'QUANTITY', 'BUNDLE', 'TIMED', 'CUSTOMER', 'LOYALTY'];
function parseRule(input: any, user: any, vendorId: string | null) {
  const type = text(input.discountType, 20, true), kind = text(input.kind || 'GENERAL', 20, true);
  if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(type) || !KINDS.includes(kind)) throw new HttpError(400, 'بيانات غير صالحة');
  const raw = Number(input.value);
  if (!Number.isFinite(raw) || raw <= 0 || (type === 'PERCENTAGE' ? raw > 100 || Math.round(raw * 10000) !== raw * 10000 : !Number.isSafeInteger(raw))) throw new HttpError(400, type === 'PERCENTAGE' ? 'نسبة الخصم يجب أن تكون بين 0 و100%' : 'أدخل مبلغ خصم صالحاً');
  const code = input.code ? text(input.code, 32, true).toUpperCase() : null;
  if (code && !/^[A-Z0-9_-]{2,32}$/.test(code)) throw new HttpError(400, 'رمز ترويجي غير صحيح');
  const c = input.conditions && typeof input.conditions === 'object' && !Array.isArray(input.conditions) ? input.conditions : {}, conditions: Record<string, unknown> = {};
  for (const key of ['minQuantity', 'maxQuantity', 'minServices']) if (c[key] !== undefined && c[key] !== null && c[key] !== '') conditions[key] = integer(c[key], 100000, 1);
  if (Array.isArray(c.cityIds) && c.cityIds.length) conditions.cityIds = c.cityIds.slice(0, 50).map((x: unknown) => text(x, 100, true));
  if (c.allowWithPackageDiscount !== undefined) conditions.allowWithPackageDiscount = c.allowWithPackageDiscount === true;
  if (c.customer && typeof c.customer === 'object') { const cu: Record<string, unknown> = {}; if (c.customer.firstOrderOnly) cu.firstOrderOnly = true; if (c.customer.minCompletedOrders) cu.minCompletedOrders = integer(c.customer.minCompletedOrders, 1000, 1); if (Array.isArray(c.customer.customerIds) && c.customer.customerIds.length) cu.customerIds = c.customer.customerIds.slice(0, 200).map((x: unknown) => text(x, 140, true)); if (Object.keys(cu).length) conditions.customer = cu; }
  if ((conditions.minQuantity as number) > (conditions.maxQuantity as number)) throw new HttpError(400, 'حدود الكمية غير صالحة');
  const startsAt = input.startsAt ? new Date(text(input.startsAt, 40, true)) : null, endsAt = input.endsAt ? new Date(text(input.endsAt, 40, true)) : null;
  if ((startsAt && !Number.isFinite(+startsAt)) || (endsAt && !Number.isFinite(+endsAt)) || (startsAt && endsAt && +endsAt <= +startsAt)) throw new HttpError(400, 'تاريخ غير صالح');
  if (kind === 'PROMO_CODE' && !code) throw new HttpError(400, 'اكتب الرمز الترويجي');
  if (kind === 'QUANTITY' && !conditions.minQuantity) throw new HttpError(400, 'حدد الحد الأدنى للكمية');
  if (kind === 'BUNDLE' && !conditions.minServices) throw new HttpError(400, 'حدد الحد الأدنى لعدد الخدمات');
  if (kind === 'TIMED' && (!startsAt || !endsAt)) throw new HttpError(400, 'حدد بداية الخصم ونهايته');
  if (['CUSTOMER', 'LOYALTY'].includes(kind) && !conditions.customer) throw new HttpError(400, 'حدد شرط أهلية العميل');
  let funding = text(input.fundingType || 'PLATFORM', 20, true), share = input.vendorShareBps === undefined ? 0 : integer(input.vendorShareBps, 10000, 0);
  if (!FUNDINGS.includes(funding)) throw new HttpError(400, 'جهة تمويل الخصم غير صالحة');
  if (vendorId) { funding = 'VENDOR'; share = 10000; }            // a vendor funds their own promotions; platform funding is an administrator's decision
  if (funding === 'SHARED' && !share) throw new HttpError(400, 'حدد حصة المورد من التمويل المشترك');
  return {
    name: text(input.name, 120, true), kind, type, value: raw, maximumDiscount: input.maximumDiscount ? money(input.maximumDiscount) : null, minimumSubtotal: input.minimumSubtotal ? money(input.minimumSubtotal) : 0,
    priority: integer(input.priority, 1000, 0), stackable: input.stackable === true, stackingGroup: input.stackingGroup ? text(input.stackingGroup, 60, true) : null, funding, share, code, startsAt, endsAt,
    usageLimit: input.usageLimit ? integer(input.usageLimit, 100000000, 1) : null, perCustomerLimit: input.perCustomerLimit ? integer(input.perCustomerLimit, 100000, 1) : null, campaign: input.campaign ? text(input.campaign, 80, true) : null, conditions,
  };
}
async function parseTargets(tx: Tx, user: any, vendorId: string | null, input: any) {
  const t = input.targets && typeof input.targets === 'object' ? input.targets : {}, list = (k: string): string[] => (Array.isArray(t[k]) ? t[k].slice(0, 200).map((x: unknown) => text(x, 140, true)) : []);
  const packageIds = list('packageIds'), serviceIds = list('serviceIds'), offerIds = list('offerIds'), vendorIds = list('vendorIds');
  for (const id of packageIds) { const r = (await tx.$queryRaw<any[]>`SELECT "ownerId" FROM "CommercePackage" WHERE "id"=${id}`)[0]; if (!r) throw new HttpError(400, 'مستهدف غير موجود'); if (vendorId && r.ownerId !== user.id) throw new HttpError(403, 'يمكنك استهداف خدماتك وباقاتك فقط'); }
  for (const id of serviceIds) { const r = (await tx.$queryRaw<any[]>`SELECT "ownerId","vendorId" FROM "CommerceService" WHERE "id"=${id}`)[0]; if (!r) throw new HttpError(400, 'مستهدف غير موجود'); if (vendorId && r.vendorId !== vendorId) throw new HttpError(403, 'يمكنك استهداف خدماتك وباقاتك فقط'); }
  for (const id of offerIds) { const r = (await tx.$queryRaw<any[]>`SELECT s."vendorId" FROM "CommerceOffer" o JOIN "CommerceService" s ON s."id"=o."serviceId" WHERE o."id"=${id}`)[0]; if (!r) throw new HttpError(400, 'مستهدف غير موجود'); if (vendorId && r.vendorId !== vendorId) throw new HttpError(403, 'يمكنك استهداف خدماتك وباقاتك فقط'); }
  for (const id of vendorIds) { if (vendorId && id !== vendorId) throw new HttpError(403, 'يمكنك استهداف خدماتك وباقاتك فقط'); if (!(await tx.$queryRaw<any[]>`SELECT 1 FROM "Vendor" WHERE "id"=${id}`).length) throw new HttpError(400, 'مستهدف غير موجود'); }
  // a vendor's own promotion with no target means "all of my services": the engine limits it to their vendor id, so nothing else is reachable
  return { packageIds, serviceIds, offerIds, vendorIds };
}
const vendorIdOf = (user: any): string | null => (user.role === 'VENDOR' && !admin(user) ? user.vendorProfile?.id ?? null : null);
const ruleView = (row: any, targets: any[], usage?: { total: number; mine?: number }) => ({ id: row.id, name: row.name, kind: row.kind, discountType: row.discountType, value: Number(row.value), maximumDiscount: row.maximumDiscount === null ? null : Number(row.maximumDiscount), minimumSubtotal: Number(row.minimumSubtotal), priority: row.priority, stackable: row.stackable, stackingGroup: row.stackingGroup, fundingType: row.fundingType, vendorShareBps: row.vendorShareBps, code: row.code, startsAt: row.startsAt, endsAt: row.endsAt, usageLimit: row.usageLimit, perCustomerLimit: row.perCustomerLimit, ownerVendorId: row.ownerVendorId, campaign: row.campaign, status: row.status, conditions: row.conditions, version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt, targets: { packageIds: targets.filter(t => t.packageId).map(t => t.packageId), serviceIds: targets.filter(t => t.serviceId).map(t => t.serviceId), offerIds: targets.filter(t => t.offerId).map(t => t.offerId), vendorIds: targets.filter(t => t.vendorId).map(t => t.vendorId) }, redeemed: usage?.total ?? 0 });

export async function listRules() {
  const user = await actor(), vendorId = vendorIdOf(user);
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "DiscountRule" WHERE (${vendorId}::text IS NULL OR "ownerVendorId"=${vendorId}) ORDER BY "createdAt" DESC LIMIT 300`;
  const ids = rows.map(r => r.id);
  const targets = ids.length ? await prisma.$queryRaw<any[]>`SELECT * FROM "DiscountRuleTarget" WHERE "ruleId" = ANY(${ids})` : [];
  const used = ids.length ? await prisma.$queryRaw<any[]>`SELECT "discountRuleId" AS id, COUNT(*)::int AS n FROM "DiscountRedemption" WHERE "discountRuleId" = ANY(${ids}) AND "status" IN ('RESERVED','REDEEMED') GROUP BY 1` : [];
  return { rules: rows.map(r => ruleView(r, targets.filter(t => t.ruleId === r.id), { total: used.find(u => u.id === r.id)?.n ?? 0 })) };
}
export async function saveRule(input: any) {
  const user = await actor(), vendorId = vendorIdOf(user);
  if (user.role === 'VENDOR' && !admin(user) && !vendorId) throw new HttpError(403, 'يلزم اعتماد المورد');
  return atomic(async tx => {
    const rule = parseRule(input, user, vendorId), targets = await parseTargets(tx, user, vendorId, input);
    const id = input.id ? text(input.id, 140, true) : randomUUID(), prev = input.id ? (await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRule" WHERE "id"=${id}`)[0] : null;
    if (input.id && !prev) throw new HttpError(404, 'العنصر غير موجود');
    if (prev && vendorId && prev.ownerVendorId !== vendorId) throw new HttpError(404, 'العنصر غير موجود');
    if (prev) await lock(tx, 'discount-rule:' + id);
    if (prev && input.version !== undefined && input.version !== prev.version) throw new HttpError(409, 'تغير الطلب');
    // administrators decide the status; a vendor's rule always waits for an administrator to switch it on
    const status = vendorId ? (prev?.status === 'ACTIVE' ? 'DRAFT' : prev?.status ?? 'DRAFT') : ['DRAFT', 'ACTIVE', 'DISABLED'].includes(input.status) ? input.status : prev?.status ?? 'DRAFT';
    try {
      if (prev) await tx.$executeRaw`UPDATE "DiscountRule" SET "name"=${rule.name},"kind"=${rule.kind},"discountType"=${rule.type},"value"=${rule.value},"maximumDiscount"=${rule.maximumDiscount},"minimumSubtotal"=${rule.minimumSubtotal},"priority"=${rule.priority},"stackable"=${rule.stackable},"stackingGroup"=${rule.stackingGroup},"fundingType"=${rule.funding},"vendorShareBps"=${rule.share},"code"=${rule.code},"startsAt"=${rule.startsAt},"endsAt"=${rule.endsAt},"usageLimit"=${rule.usageLimit},"perCustomerLimit"=${rule.perCustomerLimit},"campaign"=${rule.campaign},"status"=${status},"conditions"=${JSON.stringify(rule.conditions)}::jsonb,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`;
      else await tx.$executeRaw`INSERT INTO "DiscountRule" ("id","name","kind","discountType","value","maximumDiscount","minimumSubtotal","priority","stackable","stackingGroup","fundingType","vendorShareBps","code","startsAt","endsAt","usageLimit","perCustomerLimit","ownerVendorId","campaign","status","conditions","createdBy") VALUES (${id},${rule.name},${rule.kind},${rule.type},${rule.value},${rule.maximumDiscount},${rule.minimumSubtotal},${rule.priority},${rule.stackable},${rule.stackingGroup},${rule.funding},${rule.share},${rule.code},${rule.startsAt},${rule.endsAt},${rule.usageLimit},${rule.perCustomerLimit},${vendorId},${rule.campaign},${status},${JSON.stringify(rule.conditions)}::jsonb,${user.id})`;
    } catch (e: any) { if (/23505|DiscountRule_code_key|unique/i.test(String(e?.message))) throw new HttpError(409, 'الرمز مستخدم في قاعدة أخرى'); throw e; }
    await tx.$executeRaw`DELETE FROM "DiscountRuleTarget" WHERE "ruleId"=${id}`;
    for (const value of targets.packageIds) await tx.$executeRaw`INSERT INTO "DiscountRuleTarget" ("id","ruleId","packageId") VALUES (${randomUUID()},${id},${value})`;
    for (const value of targets.serviceIds) await tx.$executeRaw`INSERT INTO "DiscountRuleTarget" ("id","ruleId","serviceId") VALUES (${randomUUID()},${id},${value})`;
    for (const value of targets.offerIds) await tx.$executeRaw`INSERT INTO "DiscountRuleTarget" ("id","ruleId","offerId") VALUES (${randomUUID()},${id},${value})`;
    for (const value of targets.vendorIds) await tx.$executeRaw`INSERT INTO "DiscountRuleTarget" ("id","ruleId","vendorId") VALUES (${randomUUID()},${id},${value})`;
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: prev ? 'COMMERCE_DISCOUNT_RULE_UPDATED' : 'COMMERCE_DISCOUNT_RULE_CREATED', targetId: id, details: { name: rule.name, status, version: (prev?.version ?? 0) + (prev ? 1 : 1) } } });
    const row = (await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRule" WHERE "id"=${id}`)[0];
    return { rule: ruleView(row, (await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRuleTarget" WHERE "ruleId"=${id}`)) };
  });
}
export async function ruleAction(input: any) {
  const user = await actor(), vendorId = vendorIdOf(user), action = text(input.action, 20, true);
  return atomic(async tx => {
    const row = (await tx.$queryRaw<any[]>`SELECT * FROM "DiscountRule" WHERE "id"=${text(input.id, 140, true)}`)[0];
    if (!row || (vendorId && row.ownerVendorId !== vendorId)) throw new HttpError(404, 'العنصر غير موجود');
    await lock(tx, 'discount-rule:' + row.id);
    if (action === 'activate') { if (vendorId) throw new HttpError(403, 'يفعّل الإداري قواعد الموردين بعد مراجعتها'); await tx.$executeRaw`UPDATE "DiscountRule" SET "status"='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id}`; }
    else if (action === 'disable') await tx.$executeRaw`UPDATE "DiscountRule" SET "status"='DISABLED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id}`;
    else throw new HttpError(400, 'إجراء غير صالح');
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'COMMERCE_DISCOUNT_RULE_' + action.toUpperCase(), targetId: row.id, details: { name: row.name } } });
    return { ok: true };
  });
}

// ------------------------------------------------------------------------------------------------------------------------ preview
/** The customer's price for a configuration, with a policy or rules that are not saved yet (nothing is written). Administrators also see who funds what. */
export async function preview(input: any) {
  const user = await actor(), vendorId = vendorIdOf(user);
  const [line] = parseLines([{ id: 'preview', ...(input.line ?? {}) }]);
  const codes = input.promoCodes === undefined ? [] : parsePromoCodes(input.promoCodes);
  return atomic(async tx => {
    const overrides: Record<string, PackagePolicy> = {};
    if (input.policy && line.packageId) {
      const pack = await ownedPackage(tx, user, line.packageId), items = await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackageItem" WHERE "packageId"=${pack.id}`;
      const percent = input.policy.discountPercent === undefined || input.policy.discountPercent === null ? null : Number(input.policy.discountPercent);
      const policy: PackagePolicy = { model: text(input.policy.model, 20, true) as any, fixedPrice: input.policy.fixedPrice ?? null, discountBps: percent === null ? null : Math.round(percent * 100), discountAmount: input.policy.discountAmount ?? null, config: cleanConfig(input.policy.config, user, new Set(items.map(i => i.offerId))) as any };
      const problem = validatePolicy(policy, items.map(i => ({ optional: i.body.optional === true, hasSubstitutions: (i.body.substitutions ?? []).length > 0 })));
      if (problem) throw new HttpError(400, problem);
      overrides[pack.id] = policy;
    }
    const extra: Rule[] = [];
    if (input.rule) {
      const parsed = parseRule(input.rule, user, vendorId), targets = await parseTargets(tx, user, vendorId, input.rule);
      extra.push(ruleFromRow({ id: 'draft', version: 0, name: parsed.name, kind: parsed.kind, discountType: parsed.type, value: parsed.value, maximumDiscount: parsed.maximumDiscount, minimumSubtotal: parsed.minimumSubtotal, priority: parsed.priority, stackable: parsed.stackable, stackingGroup: parsed.stackingGroup, fundingType: parsed.funding, vendorShareBps: parsed.share, code: parsed.code, startsAt: parsed.startsAt, endsAt: parsed.endsAt, usageLimit: parsed.usageLimit, perCustomerLimit: parsed.perCustomerLimit, ownerVendorId: vendorId, status: 'ACTIVE', conditions: parsed.conditions }, [
        ...targets.packageIds.map(packageId => ({ packageId })), ...targets.serviceIds.map(serviceId => ({ serviceId })), ...targets.offerIds.map(offerId => ({ offerId })), ...targets.vendorIds.map(vendorId => ({ vendorId }))]));
    }
    const quote = await quoteLines(tx, [line], { userId: input.asCustomer === false ? null : user.id, promoCodes: codes.concat(extra.map(r => r.code).filter(Boolean) as string[]), policyOverrides: overrides, extraRules: extra });
    const full = admin(user);
    return { customerView: publicQuote(quote), ...(full ? { internal: { funding: quote.pricing.funding, discounts: quote.pricing.discounts.map(d => ({ ...d, snapshot: undefined })), rejected: quote.pricing.rejected, components: quote.pricing.components } } : {}) };
  });
}

// ------------------------------------------------------------------------------------------------------------------------ history
export async function history(params: URLSearchParams) {
  const user = await actor(), packageId = params.get('packageId'), offerId = params.get('offerId');
  if (!packageId && !offerId) throw new HttpError(400, 'بيانات غير صالحة');
  if (packageId) {
    const pack = await ownedPackage(prisma as any, user, packageId);
    const policies = await prisma.$queryRaw<any[]>`SELECT * FROM "PackagePricingPolicy" WHERE "packageId"=${pack.id} ORDER BY "version" DESC LIMIT 100`, versions = await prisma.$queryRaw<any[]>`SELECT "version","createdAt" FROM "CommercePackageVersion" WHERE "packageId"=${pack.id} ORDER BY "version" DESC LIMIT 50`;
    return { kind: 'PACKAGE', policies: policies.map(r => ({ ...policyView(policyFromRow(r)), status: r.status, effectiveFrom: r.effectiveFrom, effectiveUntil: r.effectiveUntil, createdAt: r.createdAt, createdBy: r.createdBy })), versions, affectedCarts: await countAffectedCarts(prisma as any, { packageId: pack.id }) };
  }
  const offer = (await prisma.$queryRaw<any[]>`SELECT o.*, s."ownerId" FROM "CommerceOffer" o JOIN "CommerceService" s ON s."id"=o."serviceId" WHERE o."id"=${text(offerId, 140, true)}`)[0];
  if (!offer || (!admin(user) && offer.ownerId !== user.id)) throw new HttpError(404, 'العرض غير موجود');
  const versions = await prisma.$queryRaw<any[]>`SELECT "version","createdAt","snapshot"->'policy'->>'baseAmount' AS "baseAmount" FROM "CommerceOfferVersion" WHERE "offerId"=${offer.id} ORDER BY "version" DESC LIMIT 100`;
  const schedules = await prisma.$queryRaw<any[]>`SELECT "id","newBaseAmount","effectiveFrom","status","appliedAt","previousBaseAmount" FROM "OfferPriceSchedule" WHERE "offerId"=${offer.id} ORDER BY "effectiveFrom" DESC LIMIT 50`;
  return { kind: 'OFFER', current: Number(offer.body.policy?.baseAmount ?? 0), versions: versions.map(v => ({ version: v.version, createdAt: v.createdAt, baseAmount: v.baseAmount === null ? null : Number(v.baseAmount) })), schedules: schedules.map(s => ({ ...s, newBaseAmount: Number(s.newBaseAmount), previousBaseAmount: s.previousBaseAmount === null ? null : Number(s.previousBaseAmount) })), affectedCarts: await countAffectedCarts(prisma as any, { offerId: offer.id }) };
}

// ----------------------------------------------------------------------------------------------------------------------- schedules
export async function saveSchedule(input: any) {
  const user = await actor();
  return atomic(async tx => {
    if (input.action === 'cancel') {
      const row = (await tx.$queryRaw<any[]>`SELECT sc.*, s."ownerId" FROM "OfferPriceSchedule" sc JOIN "CommerceOffer" o ON o."id"=sc."offerId" JOIN "CommerceService" s ON s."id"=o."serviceId" WHERE sc."id"=${text(input.id, 140, true)}`)[0];
      if (!row || (!admin(user) && row.ownerId !== user.id)) throw new HttpError(404, 'العنصر غير موجود');
      if (row.status !== 'SCHEDULED') throw new HttpError(409, 'تغير الطلب');
      await tx.$executeRaw`UPDATE "OfferPriceSchedule" SET "status"='CANCELLED' WHERE "id"=${row.id}`; return { ok: true };
    }
    const offer = (await tx.$queryRaw<any[]>`SELECT o.*, s."ownerId" FROM "CommerceOffer" o JOIN "CommerceService" s ON s."id"=o."serviceId" WHERE o."id"=${text(input.offerId, 140, true)}`)[0];
    if (!offer || (!admin(user) && offer.ownerId !== user.id)) throw new HttpError(404, 'العرض غير موجود');
    const amount = money(input.newBaseAmount, 100_000_000), from = new Date(text(input.effectiveFrom, 40, true));
    if (!Number.isFinite(+from) || +from < Date.now() - 60000) throw new HttpError(400, 'تاريخ غير صالح');
    try { mergePolicy({ ...offer.body.policy, baseAmount: amount }); } catch (e: any) { throw new HttpError(400, e.message); }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "OfferPriceSchedule" ("id","offerId","newBaseAmount","effectiveFrom","createdBy") VALUES (${id},${offer.id},${amount},${from},${user.id})`;
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'COMMERCE_PRICE_SCHEDULED', targetId: offer.id, details: { scheduleId: id, newBaseAmount: amount, effectiveFrom: from.toISOString() } } });
    return { id, affectedCarts: await countAffectedCarts(tx, { offerId: offer.id }) };
  });
}

// ---------------------------------------------------------------------------------------------------------- vendor settlement review
/** Per vendor: the gross service value, what the vendor funded, what the platform funded on their services, commission, and what that leaves payable (before refunds). */
export async function settlementReview(params: URLSearchParams) {
  const user = await actor(), vendorId = vendorIdOf(user);
  const from = params.get('from') ? new Date(params.get('from') as string) : new Date(Date.now() - 90 * 86400000), to = params.get('to') ? new Date(params.get('to') as string) : new Date();
  if (!Number.isFinite(+from) || !Number.isFinite(+to)) throw new HttpError(400, 'تاريخ غير صالح');
  const rows = await prisma.$queryRaw<any[]>`
    SELECT c."vendorId", COALESCE(v."businessName", '—') AS "vendorName", COUNT(DISTINCT q."orderId")::int AS orders,
      SUM(c."grossAmount")::bigint AS gross, SUM(c."discountAmount")::bigint AS discounts, SUM(c."vendorFundedAmount")::bigint AS "vendorFunded", SUM(c."platformFundedAmount")::bigint AS "platformFunded",
      SUM(c."netAmount")::bigint AS net, SUM(c."commissionAmount")::bigint AS commission
    FROM "PriceQuoteComponent" c JOIN "PriceQuote" q ON q."id"=c."priceQuoteId" LEFT JOIN "Vendor" v ON v."id"=c."vendorId"
    WHERE q."createdAt" >= ${from} AND q."createdAt" <= ${to} AND (${vendorId}::text IS NULL OR c."vendorId"=${vendorId})
    GROUP BY c."vendorId", v."businessName" ORDER BY gross DESC LIMIT 200`;
  const campaigns = admin(user) ? await prisma.$queryRaw<any[]>`
    SELECT COALESCE(r."campaign", r."name") AS name, a."fundingType", COUNT(*)::int AS uses, SUM(a."discountAmount")::bigint AS amount
    FROM "AppliedDiscount" a JOIN "PriceQuote" q ON q."id"=a."priceQuoteId" LEFT JOIN "DiscountRule" r ON r."id"=a."discountRuleId"
    WHERE q."createdAt" >= ${from} AND q."createdAt" <= ${to} GROUP BY 1,2 ORDER BY amount DESC LIMIT 50` : [];
  const n = (x: any) => Number(x ?? 0);
  return {
    from, to, vendors: rows.map(r => ({ vendorId: r.vendorId, vendorName: r.vendorName, orders: r.orders, gross: n(r.gross), discounts: n(r.discounts), vendorFunded: n(r.vendorFunded), platformFunded: n(r.platformFunded), net: n(r.net), commission: n(r.commission), payable: n(r.net) + n(r.platformFunded) - n(r.commission) })),
    campaigns: campaigns.map(c => ({ name: c.name, fundingType: c.fundingType, uses: c.uses, amount: n(c.amount) })),
    note: 'المستحق = صافي السعر بعد الخصم + الخصم الممول من المنصة − العمولة، قبل المبالغ المستردة والتسويات اللاحقة.',
  };
}
export { loadRules };
