import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { catalog,saveEntity } from '@/lib/server/commerce-v2/catalog';
export const dynamic='force-dynamic';
export const GET=api(()=>catalog(true));
export const POST=api(async request=>{await assertNotPreview(request);return {entity:await saveEntity(await body(request,180000))};});
