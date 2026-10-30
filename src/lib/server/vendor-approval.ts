import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireAdmin, requireUser, rateLimit } from './auth';
import { HttpError, text } from './http';
import { Tx, atomic } from './booking/repository';
import { notify } from './exceptions/notify';
import { platformUserIds } from './exceptions/workflow';

// Vendor account approval. The vendor's operational status (Vendor.status) and the approval of each service they publish are separate things:
// an approved vendor can still have a service held back, and a service is never approved just because its vendor is.
export const APPROVAL_STATES = ['PENDING', 'INFO_REQUIRED', 'APPROVED', 'REJECTED', 'ON_HOLD'] as const;
export type ApprovalState = typeof APPROVAL_STATES[number];
export const STATE_LABELS: Record<ApprovalState, string> = { PENDING: 'بانتظار المراجعة', INFO_REQUIRED: 'مطلوب استكمال البيانات', APPROVED: 'معتمد', REJECTED: 'مرفوض', ON_HOLD: 'المراجعة معلقة' };
const DECISIONS: Record<string, { to: ApprovalState; status: 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED'; needsNote: boolean; label: string }> = {
  approve: { to: 'APPROVED', status: 'ACTIVE', needsNote: false, label: 'اعتماد الحساب' },
  request_info: { to: 'INFO_REQUIRED', status: 'UNDER_REVIEW', needsNote: true, label: 'طلب استكمال البيانات' },
  reject: { to: 'REJECTED', status: 'SUSPENDED', needsNote: true, label: 'رفض الحساب' },
  hold: { to: 'ON_HOLD', status: 'UNDER_REVIEW', needsNote: true, label: 'تعليق المراجعة' },
  reopen: { to: 'PENDING', status: 'UNDER_REVIEW', needsNote: false, label: 'إعادة فتح المراجعة' },
};
export const DECISION_LABELS = Object.fromEntries(Object.entries(DECISIONS).map(([k, v]) => [k, v.label]));

async function current(tx: Tx, vendorId: string) {
  await tx.$executeRaw`INSERT INTO "VendorApproval" ("vendorId","state") SELECT v."id", CASE WHEN v."status"='ACTIVE' THEN 'APPROVED' ELSE 'PENDING' END FROM "Vendor" v WHERE v."id"=${vendorId} ON CONFLICT ("vendorId") DO NOTHING`;
  const row = (await tx.$queryRaw<any[]>`SELECT * FROM "VendorApproval" WHERE "vendorId"=${vendorId}`)[0];
  if (!row) throw new HttpError(404, 'المورد غير موجود');
  return row;
}
const log = (tx: Tx, vendorId: string, actorId: string | null, action: string, from: string | null, to: string, note: string) =>
  tx.$executeRaw`INSERT INTO "VendorApprovalEvent" ("id","vendorId","actorId","action","fromState","toState","note","createdAt") VALUES (${randomUUID()},${vendorId},${actorId},${action},${from},${to},${note},clock_timestamp())`;

/** A new vendor registered: the account waits for the platform's review and the platform is told. */
export async function onVendorRegistered(tx: Tx, vendor: { id: string; userId: string | null; businessName: string }) {
  await tx.$executeRaw`INSERT INTO "VendorApproval" ("vendorId","state") VALUES (${vendor.id},'PENDING') ON CONFLICT ("vendorId") DO NOTHING`;
  await log(tx, vendor.id, vendor.userId, 'REGISTERED', null, 'PENDING', '');
  await notify(tx, { id: null, version: 0, number: '' }, 'VENDOR_REGISTERED', await platformUserIds(tx), { titleAr: 'مورد جديد بانتظار الاعتماد', bodyAr: `سجّل «${vendor.businessName}» حساب مورد ويحتاج إلى مراجعتك.`, path: '/admin/vendor-approvals' }, { once: 'registered:' + vendor.id });
}

/** The older status switches (admin vendors list, system admin) keep the approval record in step with the vendor's status. */
export async function syncApprovalFromStatus(tx: Tx, vendorId: string, status: 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED', actorId: string) {
  const row = await current(tx, vendorId);
  const to: ApprovalState = status === 'ACTIVE' ? 'APPROVED' : status === 'SUSPENDED' ? (row.state === 'APPROVED' ? 'ON_HOLD' : row.state) : row.state === 'APPROVED' ? 'ON_HOLD' : row.state;
  if (to === row.state) return;
  await tx.$executeRaw`UPDATE "VendorApproval" SET "state"=${to},"decidedBy"=${actorId},"decidedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "vendorId"=${vendorId}`;
  await log(tx, vendorId, actorId, 'STATUS_CHANGED', row.state, to, `الحالة التشغيلية: ${status}`);
}

export async function listVendorApprovals(search: URLSearchParams) {
  await requireAdmin();
  const state = text(search.get('state'), 30);
  if (state && !(APPROVAL_STATES as readonly string[]).includes(state)) throw new HttpError(400, 'حالة غير صالحة');
  await prisma.$executeRaw`INSERT INTO "VendorApproval" ("vendorId","state") SELECT v."id", CASE WHEN v."status"='ACTIVE' THEN 'APPROVED' ELSE 'PENDING' END FROM "Vendor" v ON CONFLICT ("vendorId") DO NOTHING`;
  const rows = await prisma.$queryRaw<any[]>`SELECT a."vendorId", a."state", a."note", a."decidedAt", a."updatedAt", v."businessName", v."businessNameEn", v."categoryId", v."cityId", v."contactPhone", v."status", v."verified", v."bioAr", v."createdAt", u."name" AS "ownerName", u."email" AS "ownerEmail",
      (SELECT COUNT(*)::int FROM "CommerceService" s WHERE s."vendorId"=v."id") AS "services",
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('action',e."action",'from',e."fromState",'to',e."toState",'note',e."note",'at',e."createdAt",'by',eu."name") ORDER BY e."createdAt" DESC), '[]'::jsonb) FROM (SELECT * FROM "VendorApprovalEvent" WHERE "vendorId"=v."id" ORDER BY "createdAt" DESC LIMIT 8) e LEFT JOIN "User" eu ON eu."id"=e."actorId") AS "history"
    FROM "VendorApproval" a JOIN "Vendor" v ON v."id"=a."vendorId" LEFT JOIN "User" u ON u."id"=v."userId" WHERE (${state}='' OR a."state"=${state}) ORDER BY (a."state"='PENDING') DESC, v."createdAt" DESC LIMIT 200`;
  const counts = await prisma.$queryRaw<{ state: string; n: number }[]>`SELECT "state", COUNT(*)::int AS n FROM "VendorApproval" GROUP BY "state"`;
  return { vendors: rows, counts: Object.fromEntries(counts.map(c => [c.state, c.n])) };
}

export async function decideVendorApproval(input: any) {
  const actor = await requireAdmin(); await rateLimit('vendor-approval:' + actor.id, 120);
  const vendorId = text(input.vendorId, 100, true), decision = DECISIONS[text(input.decision, 30, true)], note = text(input.note, 2000);
  if (!decision) throw new HttpError(400, 'قرار غير صالح');
  if (decision.needsNote && !note) throw new HttpError(400, 'اكتب سبب القرار ليصل إلى المورد');
  return atomic(async tx => {
    const row = await current(tx, vendorId), vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new HttpError(404, 'المورد غير موجود');
    if (row.state === decision.to && decision.to !== 'APPROVED') throw new HttpError(409, 'الحساب في هذه الحالة بالفعل');
    await tx.$executeRaw`UPDATE "VendorApproval" SET "state"=${decision.to},"note"=${note},"decidedBy"=${actor.id},"decidedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "vendorId"=${vendorId}`;
    await tx.vendor.update({ where: { id: vendorId }, data: { status: decision.status } });
    await log(tx, vendorId, actor.id, Object.keys(DECISIONS).find(k => DECISIONS[k] === decision)!.toUpperCase(), row.state, decision.to, note);
    await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'VENDOR_APPROVAL_' + decision.to, targetId: vendorId, details: { from: row.state, note } } });
    if (vendor.userId) {
      const events = { APPROVED: 'VENDOR_APPROVED', REJECTED: 'VENDOR_REJECTED', INFO_REQUIRED: 'VENDOR_INFO_REQUIRED', ON_HOLD: 'VENDOR_ON_HOLD', PENDING: 'VENDOR_ON_HOLD' } as const;
      const bodies: Record<ApprovalState, string> = { APPROVED: 'تم اعتماد حسابك. يمكنك الآن إضافة خدماتك وعروضك؛ وتُراجَع كل خدمة قبل نشرها للعملاء.', REJECTED: `لم يُعتمد حسابك: ${note}`, INFO_REQUIRED: `نحتاج منك استكمال بيانات حسابك: ${note}`, ON_HOLD: `عُلقت مراجعة حسابك: ${note}`, PENDING: 'أُعيد فتح مراجعة حسابك.' };
      await notify(tx, { id: null, version: 0, number: '' }, events[decision.to], [vendor.userId], { titleAr: decision.to === 'APPROVED' ? 'تم اعتماد حسابك كمورد' : 'تحديث على اعتماد حسابك', bodyAr: bodies[decision.to], path: '/vendor' }, { once: `${decision.to}:${Date.now()}` });
    }
    return { success: true, state: decision.to };
  });
}

/** The vendor's own view: where the account stands, and the way to send completed information back for review. */
export async function myVendorApproval() {
  const user = await requireUser();
  const vendor = await prisma.vendor.findFirst({ where: { userId: user.id } });
  if (!vendor) throw new HttpError(404, 'لا يوجد حساب مورد');
  const row = await prisma.$transaction(tx => current(tx, vendor.id));
  return { state: row.state, stateAr: STATE_LABELS[row.state as ApprovalState], note: row.note, status: vendor.status, canPublish: vendor.status === 'ACTIVE' };
}
export async function resubmitVendorApproval(input: any) {
  const user = await requireUser(); await rateLimit('vendor-resubmit:' + user.id, 10);
  const note = text(input.note, 2000);
  return atomic(async tx => {
    const vendor = await tx.vendor.findFirst({ where: { userId: user.id } });
    if (!vendor) throw new HttpError(404, 'لا يوجد حساب مورد');
    const row = await current(tx, vendor.id);
    if (!['INFO_REQUIRED', 'PENDING'].includes(row.state)) throw new HttpError(409, 'لا يمكن إرسال الحساب للمراجعة في حالته الحالية');
    await tx.$executeRaw`UPDATE "VendorApproval" SET "state"='PENDING',"note"='',"updatedAt"=CURRENT_TIMESTAMP WHERE "vendorId"=${vendor.id}`;
    await log(tx, vendor.id, user.id, 'RESUBMITTED', row.state, 'PENDING', note);
    await notify(tx, { id: null, version: 0, number: '' }, 'VENDOR_REGISTERED', await platformUserIds(tx), { titleAr: 'مورد استكمل بياناته', bodyAr: `أرسل «${vendor.businessName}» بياناته للمراجعة.${note ? ' ' + note : ''}`, path: '/admin/vendor-approvals' }, { once: 'resubmitted:' + Date.now() });
    return { success: true };
  });
}
