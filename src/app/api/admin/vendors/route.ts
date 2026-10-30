import { prisma } from '@/lib/db';
import { api, body, text, HttpError } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { syncApprovalFromStatus } from '@/lib/server/vendor-approval';
export const POST = api(async request => {
  const actor = await requireAdmin(); const d = await body(request,4096); const id = text(d.id,100,true);
  const statuses: Record<string, 'ACTIVE'|'UNDER_REVIEW'|'SUSPENDED'> = { active: 'ACTIVE', under_review: 'UNDER_REVIEW', suspended: 'SUSPENDED' };
  if (!statuses[d.status] || typeof d.verified !== 'boolean') throw new HttpError(400, 'حالة المورد غير صالحة');
  await prisma.$transaction(async tx => {
    await tx.vendor.update({ where: { id }, data: { status: statuses[d.status], verified: d.verified } });
    await syncApprovalFromStatus(tx, id, statuses[d.status], actor.id);
    await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'VENDOR_UPDATED', targetId: id, details: { status: statuses[d.status], verified: d.verified } } });
  }); return { success: true };
});
