import { api,body,text } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { listFinance,recordFinance } from '@/lib/server/booking/finance';
export const dynamic='force-dynamic';
export const GET=api(async request=>listFinance(text(new URL(request.url).searchParams.get('id'),100,true)),{allowDisabledFeature:true});
export const POST=api(async request=>{await assertNotPreview(request);return {request:await recordFinance(await body(request,12000))};},{allowDisabledFeature:true});
