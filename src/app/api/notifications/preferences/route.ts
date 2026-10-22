import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
/** The customer's consent: the in-app inbox is on unless switched off; email is off until the customer opts in. */
export const GET = api(async () => {
  const user = await requireUser();
  const rows = await prisma.$queryRaw<{ channel: string; enabled: boolean }[]>`SELECT "channel","enabled" FROM "NotificationPreference" WHERE "userId"=${user.id}`;
  const pref = new Map(rows.map(r => [r.channel, r.enabled]));
  return { inbox: pref.get('inbox') !== false, email: pref.get('email') === true, hasEmail: !!user.email };
}, { allowDisabledFeature: true });
export const PUT = api(async request => {
  const user = await requireUser(), input = await body(request, 1000);
  for (const channel of ['inbox', 'email']) {
    if (input[channel] === undefined) continue;
    if (typeof input[channel] !== 'boolean') throw new HttpError(400, 'بيانات غير صالحة');
    if (channel === 'email' && input.email && !user.email) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
    await prisma.$executeRaw`INSERT INTO "NotificationPreference" ("userId","channel","enabled") VALUES (${user.id},${channel},${input[channel]}) ON CONFLICT ("userId","channel") DO UPDATE SET "enabled"=EXCLUDED."enabled","updatedAt"=CURRENT_TIMESTAMP`;
  }
  return { ok: true };
}, { allowDisabledFeature: true });
