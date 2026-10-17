import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { transitionOrder } from '@/lib/server/commerce';

export const POST = api(async request => {
  await assertNotPreview(request);
  return { success: true, ...await transitionOrder(await body(request, 10000)), messageAr: 'تم تحديث حالة الطلب' };
}, { allowDisabledFeature: true });
