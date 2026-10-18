import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { getConfiguration,saveConfiguration } from '@/lib/server/booking/config';
export const dynamic='force-dynamic';
export const GET=api(async request=>getConfiguration(new URL(request.url).searchParams.get('manage')==='1'),{allowDisabledFeature:true});
export const POST=api(async request=>{await assertNotPreview(request);return {definition:await saveConfiguration(await body(request,100000))};});
