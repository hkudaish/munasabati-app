import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { financeAction } from '@/lib/server/commerce-v2/finance';
export const POST=api(async request=>{await assertNotPreview(request);return {order:await financeAction(await body(request,12000))};},{allowDisabledFeature:true});
