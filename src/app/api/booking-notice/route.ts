import { prisma } from '@/lib/db';
import { api, HttpError, text } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/auth';
import { checkNotice, exceptionsEnabled, publicNotice } from '@/lib/server/exceptions/notice';
import { evaluatePackageNotice } from '@/lib/booking/advance-notice';
export const dynamic = 'force-dynamic';

// The storefront asks this while a customer picks a date: does the time respect the notice this service needs, and if not, what is the earliest time
// and may an exception be requested? It only informs the screen; the cart, checkout and confirmation enforce the rule again on the server.
// Deliberately outside /api/exceptions, so the notice itself keeps working while the exception feature is switched off.
export const GET = api(async request => {
  await rateLimit('booking-notice:' + clientIp(request), 240, 60000);
  const q = new URL(request.url).searchParams, cityId = text(q.get('cityId'), 100, true), date = text(q.get('date'), 10, true), time = text(q.get('time'), 5, true);
  const offerId = text(q.get('offerId'), 140), packageId = text(q.get('packageId'), 140), on = await exceptionsEnabled();
  if (!!offerId === !!packageId) throw new HttpError(400, 'اختر عرضاً أو باقة');
  if (offerId) return publicNotice(await checkNotice(prisma, { offerId, cityId, date, time }), on);
  const items = await prisma.$queryRaw<any[]>`SELECT * FROM "CommercePackageItem" WHERE "packageId"=${packageId}`;
  if (!items.length) throw new HttpError(404, 'الباقة غير موجودة');
  const checks = [];
  for (const item of items) { const c = await checkNotice(prisma, { offerId: item.offerId, cityId, date, time, offsetMinutes: item.body.offsetMinutes || 0 }); checks.push({ item, c }); }
  const verdict = evaluatePackageNotice(checks.map(({ item, c }) => ({ label: c.titleAr, offerId: item.offerId, optional: !!item.body.optional, evaluation: c.evaluation })));
  const required = Math.max(...checks.map(x => x.c.evaluation.requiredMinutes));
  return {
    ok: verdict.ok, canRequestException: on && verdict.canRequestException, exceptionsOn: on, requiredMinutes: required, remainingMinutes: Math.max(0, Math.min(...checks.map(x => x.c.evaluation.remainingMinutes))),
    earliestAt: new Date(Math.max(...checks.map(x => +x.c.evaluation.earliestAt))).toISOString(), cutoffPassed: checks.some(x => x.c.evaluation.cutoffPassed), startAt: checks[0].c.start.toISOString(),
    components: checks.map(({ item, c }) => ({ offerId: item.offerId, titleAr: c.titleAr, optional: !!item.body.optional, ok: c.evaluation.ok, requiredMinutes: c.evaluation.requiredMinutes })),
    blocking: verdict.blocking.map(i => i.label), droppable: verdict.droppable.map(i => i.label), longest: verdict.longest?.label ?? null,
  };
}, { allowDisabledFeature: true });
