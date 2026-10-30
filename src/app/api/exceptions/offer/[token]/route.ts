import { api, HttpError } from '@/lib/server/http';
import { rateLimit, clientIp, sessionUser } from '@/lib/server/auth';
import { requestForOfferToken } from '@/lib/server/exceptions/queries';
export const dynamic = 'force-dynamic';
// The secure link in a message. It names the request but never lets anyone decide anything: the page sends the customer to sign in, and only the
// signed-in owner of the request can see the offer or approve it.
export const GET = api(async (request, context) => {
  await rateLimit('exception-offer-link:' + clientIp(request), 60, 60000);
  const found = await requestForOfferToken((await context.params).token);
  const user = await sessionUser();
  if (user && user.id !== found.customerId) throw new HttpError(403, 'هذا الرابط يخص حساباً آخر. سجل الدخول بحساب العميل صاحب الطلب');
  return { requestId: found.requestId, expired: found.expired, signedIn: !!user };
});
