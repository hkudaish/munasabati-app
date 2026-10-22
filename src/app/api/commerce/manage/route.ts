import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { catalog,saveEntity } from '@/lib/server/commerce-v2/catalog';
import { autoTranslateEntity } from '@/lib/server/commerce-v2/translate';
export const dynamic='force-dynamic';
export const GET=api(()=>catalog(true));
export const POST=api(async request=>{await assertNotPreview(request);const input=await body(request,180000);const entity=await saveEntity(input);
 // anything saved without English gets a machine translation (marked enAuto) so every service, offer and package, present or new, has an English page
 if(['SERVICE','OFFER','PACKAGE'].includes(input.kind)&&entity?.id)await autoTranslateEntity(input.kind,entity.id);
 return {entity};});
export const maxDuration=60;
