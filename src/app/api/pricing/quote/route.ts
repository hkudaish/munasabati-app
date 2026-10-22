import { api, body } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/auth';
import { atomic } from '@/lib/server/booking/repository';
import { parseLines, publicQuote, quoteLines } from '@/lib/server/commerce-v2/cart';
export const dynamic = 'force-dynamic';
/** A price for a configuration, computed by the server's pricing engine. Nothing is saved; anyone may ask (browsing is open), within a rate limit. */
export const POST = api(async request => {
  await rateLimit('pricing-quote:' + (request.headers.get('x-forwarded-for') ?? 'local'), 120, 60000);
  const input = await body(request, 20000);
  const [line] = parseLines([{ id: 'quote', ...input }]);
  return atomic(async tx => ({ quote: publicQuote(await quoteLines(tx, [line])) }));
}, { allowDisabledFeature: true });
