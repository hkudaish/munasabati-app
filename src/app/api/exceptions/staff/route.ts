import { prisma } from '@/lib/db';
import { api, body, text, HttpError } from '@/lib/server/http';
import { requireAdmin, rateLimit } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
const ROLES = ['COORDINATOR', 'BOOKING_SUPERVISOR', 'SUPPORT'];
// Who works the exception queue besides full administrators: coordinators (their assignments), booking supervisors (everything, can approve offers) and support (read only).
export const GET = api(async () => {
  await requireAdmin();
  const rows = await prisma.$queryRaw<any[]>`SELECT s."userId", s."role", s."createdAt", u."name", u."phone", u."email", u."isActive" FROM "StaffRole" s JOIN "User" u ON u."id"=s."userId" ORDER BY s."createdAt" DESC`;
  return { staff: rows };
}, { allowDisabledFeature: true });
export const POST = api(async request => {
  const actor = await requireAdmin(); await rateLimit('exception-staff:' + actor.id, 60);
  const d = await body(request, 2000), role = text(d.role, 40, true), action = d.action === 'revoke' ? 'revoke' : 'grant';
  if (!ROLES.includes(role)) throw new HttpError(400, 'دور غير صالح');
  const identifier = text(d.identifier, 254, true).toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ id: identifier }, { phone: identifier }, { email: identifier }], isActive: true } });
  if (!user) throw new HttpError(404, 'لا يوجد مستخدم نشط بهذا الجوال أو البريد');
  if (action === 'grant') await prisma.$executeRaw`INSERT INTO "StaffRole" ("userId","role","grantedBy") VALUES (${user.id},${role},${actor.id}) ON CONFLICT DO NOTHING`;
  else await prisma.$executeRaw`DELETE FROM "StaffRole" WHERE "userId"=${user.id} AND "role"=${role}`;
  await prisma.systemAuditLog.create({ data: { actorId: actor.id, action: action === 'grant' ? 'EXCEPTION_STAFF_GRANTED' : 'EXCEPTION_STAFF_REVOKED', targetId: user.id, details: { role } } });
  return { success: true, userId: user.id };
}, { allowDisabledFeature: true });
