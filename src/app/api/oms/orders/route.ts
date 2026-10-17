import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { createOrder, listOrders } from '@/lib/server/commerce';

export const GET = api(async () => ({ success: true, orders: await listOrders() }), { allowDisabledFeature: true });
export const POST = api(async request => {
  await assertNotPreview(request);
  const masterOrder = await createOrder(await body(request, 150000));
  return { success: true, masterOrder, messageAr: 'تم حفظ طلبك؛ بانتظار موافقة المورد. لم يتم تحصيل أي مبلغ.' };
});
