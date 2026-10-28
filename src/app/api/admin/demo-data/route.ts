import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { rateLimit, requireAdmin } from '@/lib/server/auth';
import { demoStatus, removeDemoData, seedDemoStep } from '@/lib/server/demo-data';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = api(async () => { await requireAdmin(); return demoStatus(); });
// The admin page adds demo data one step at a time (each step is one request) and removes it in one call.
export const POST = api(async request => {
  const admin = await requireAdmin(); await rateLimit('demo-data:' + admin.id, 120);
  const d = await body(request, 1000);
  if (d.action === 'seed') {
    const cookie = request.headers.get('cookie') || '';
    const result = await seedDemoStep(Number(d.step), new URL(request.url).origin, cookie, admin.id);
    if (Number(d.step) === 0) await prisma.systemAuditLog.create({ data: { actorId: admin.id, action: 'DEMO_DATA_ADDED', targetId: 'demo-data' } });
    return result;
  }
  if (d.action === 'remove') {
    const result = await removeDemoData();
    await prisma.systemAuditLog.create({ data: { actorId: admin.id, action: 'DEMO_DATA_REMOVED', targetId: 'demo-data', details: result } });
    return result;
  }
  throw new HttpError(400, 'إجراء غير معروف');
});
