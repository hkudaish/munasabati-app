import { api, body, HttpError, text } from '@/lib/server/http';
import { requireUser, rateLimit } from '@/lib/server/auth';
import { admin } from '@/lib/server/booking/repository';
import { assertNotPreview } from '@/lib/server/geo/context';
import { translateToEnglish, translationEnabled } from '@/lib/server/translate';
import { backfillEnglish } from '@/lib/server/commerce-v2/translate';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET: is automatic translation available? POST { action: 'suggest', texts } -> English suggestions for the form (nothing is saved); POST { action: 'backfill' } (administrators) fills every record that lacks English. */
export const GET = api(async () => { await requireUser(); return { enabled: translationEnabled() }; });
export const POST = api(async request => {
  await assertNotPreview(request);
  const user = await requireUser();
  if (!admin(user) && user.role !== 'VENDOR') throw new HttpError(403, 'غير مخول');
  const input = await body(request, 120000);
  const action = text(input.action, 20, true);
  if (action === 'backfill') {
    if (!admin(user)) throw new HttpError(403, 'هذه الصلاحية مخصصة للإدارة');
    await rateLimit('translate-backfill:' + user.id, 10);
    return backfillEnglish(4);
  }
  if (action !== 'suggest' || !input.texts || typeof input.texts !== 'object' || Array.isArray(input.texts)) throw new HttpError(400, 'بيانات غير صالحة');
  await rateLimit('translate:' + user.id, 40);
  const texts: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.texts as Record<string, unknown>)) texts[text(key, 40, true)] = text(value, 8000);
  return { translations: await translateToEnglish(texts, { titleEn: 200, nameEn: 200, descriptionEn: 8000 }) };
});
