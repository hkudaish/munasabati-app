import { prisma } from '@/lib/db';
import { api, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { admin } from '@/lib/server/booking/repository';
import { staffOf } from '@/lib/server/exceptions/workflow';
export const dynamic = 'force-dynamic';
// Who a request can be assigned to, with how busy each person is. For administrators and booking supervisors.
export const GET = api(async () => {
  const user = await requireUser();
  if (!admin(user) && !(await staffOf(prisma, user.id)).has('BOOKING_SUPERVISOR')) throw new HttpError(403, 'هذه الصلاحية للإدارة والمشرفين');
  const rows = await prisma.$queryRaw<any[]>`SELECT u."id", u."name", COUNT(t."id")::int AS "open" FROM "User" u LEFT JOIN "CoordinatorTask" t ON t."coordinatorId"=u."id" AND t."status" IN ('OPEN','IN_PROGRESS') WHERE u."isActive"=true AND (u."role" IN ('ADMIN','SUPER_ADMIN') OR EXISTS (SELECT 1 FROM "StaffRole" s WHERE s."userId"=u."id" AND s."role"='COORDINATOR')) GROUP BY u."id", u."name" ORDER BY "open", u."name"`;
  return { coordinators: rows };
});
