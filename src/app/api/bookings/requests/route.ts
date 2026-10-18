import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { createRequest,listRequests,transitionRequest } from '@/lib/server/booking/requests';
export const dynamic='force-dynamic';
export const GET=api(async request=>listRequests(new URL(request.url).searchParams),{allowDisabledFeature:true});
export const POST=api(async request=>{await assertNotPreview(request);return {request:await createRequest(await body(request,40000))};});
export const PATCH=api(async request=>{await assertNotPreview(request);return {request:await transitionRequest(await body(request,12000))};},{allowDisabledFeature:true});
