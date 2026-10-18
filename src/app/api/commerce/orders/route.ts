import { api,body,text } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { checkout,listOrders,orderAction } from '@/lib/server/commerce-v2/orders';
export const dynamic='force-dynamic';
export const GET=api(request=>listOrders(text(new URL(request.url).searchParams.get('id'),140)),{allowDisabledFeature:true});
export const POST=api(async request=>{await assertNotPreview(request);return {order:await checkout(await body(request,12000))};});
export const PATCH=api(async request=>{await assertNotPreview(request);return {order:await orderAction(await body(request,12000))};},{allowDisabledFeature:true});
