import { prisma } from '@/lib/db';
import { api, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { admin } from '@/lib/server/booking/repository';
import { counts, remindersFor } from '@/lib/server/commerce-v2/reminders';
export const dynamic = 'force-dynamic';
/** What needs attention now: administrators, supervisors and coordinators see everything, vendors only what they manage. Customers have their own cart reminders. */
export const GET = api(async () => {
  const user = await requireUser();
  if (!admin(user) && user.role !== 'VENDOR') throw new HttpError(403, 'غير مخول');
  const reminders = await remindersFor(user);
  const recent = await prisma.$queryRaw<any[]>`SELECT "id","body","createdAt" FROM "ServiceInbox" WHERE "userId"=${user.id} AND "body"->>'referenceType'='OPS' ORDER BY "createdAt" DESC LIMIT 10`;
  return { reminders, counts: counts(reminders), recent: recent.map(r => ({ id: r.id, title: r.body.titleAr, text: r.body.statusAr, url: r.body.url, createdAt: r.createdAt })) };
}, { allowDisabledFeature: true });
