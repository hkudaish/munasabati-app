import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/server/auth';
import { api } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { getOMSSettings } from '@/lib/oms/store';
import { runOMSWatchdogScan } from '@/lib/oms/sla-watchdog';
import { orderInclude, serializeOrder } from '@/lib/server/commerce';

export const GET = api(async () => {
  await requireAdmin();
  return { success: true, exceptions: await prisma.oMSException.findMany({ where: { status: { in: ['OPEN','IN_REVIEW','ACTION_TAKEN'] } }, orderBy: { detectedAt: 'desc' }, take: 200 }) };
});
export const POST = api(async request => {
  await assertNotPreview(request);
  const user = await requireAdmin(); const settings = await getOMSSettings();
  return prisma.$transaction(async tx => {
    // Concurrent scans share a lock; risk updates never overwrite workflow or payment state.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'oms-watchdog'}))::text`;
    const [orders, exceptions] = await Promise.all([
      tx.multiVendorOrder.findMany({ include: orderInclude }), tx.oMSException.findMany({ where: { status: { notIn: ['RESOLVED','CLOSED'] } } })
    ]);
    const suborders = JSON.parse(JSON.stringify(orders.map(serializeOrder).flatMap(o => o.suborders)));
    const result = runOMSWatchdogScan(suborders, JSON.parse(JSON.stringify(exceptions)), settings);
    const seen = new Set<string>(); const created = [];
    for (const exception of result.detectedExceptions) {
      if (!exception.suborderId || seen.has(exception.suborderId)) continue;
      seen.add(exception.suborderId);
      created.push(await tx.oMSException.create({ data: { orderId: exception.orderId, suborderId: exception.suborderId, issueType: exception.issueType!, severity: exception.severity,
        assignedRole: exception.assignedRole, correctiveActionAr: exception.correctiveActionAr!, resolutionDeadline: exception.resolutionDeadline ? new Date(exception.resolutionDeadline) : null } }));
    }
    for (const sub of result.updatedSuborders) await tx.suborder.update({ where: { id: sub.id }, data: { isAtRisk: sub.isAtRisk, isDelayed: sub.isDelayed } });
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'OMS_WATCHDOG_SCAN', targetId: 'orders', details: { scanned: suborders.length, exceptions: created.length } } });
    return { success: true, scannedOrdersCount: suborders.length, newExceptionsCount: created.length, detectedExceptions: created };
  }, { timeout: 20000 });
});
