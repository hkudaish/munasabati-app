import { requireGeo } from '@/lib/server/geo/context';
import { api, body, text, HttpError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/auth';
import { generateZaffah } from '@/lib/server/zaffah';
export const POST = api(async request => {
  const d = await body(request, 4096);
  await requireGeo('feature:zaffah_generator');
  const values = Object.fromEntries(['brideName','groomName','familyName','occasionCity'].map(field => [field, text(d[field], 100, true)]));
  if (!['royal','traditional','modern','poetic'].includes(d.zaffahStyle)) throw new HttpError(400, 'أسلوب غير صالح');
  await rateLimit('zaffah-generator', 120, 60000);
  return { poem: generateZaffah({ ...values, zaffahStyle: d.zaffahStyle }) };
});
