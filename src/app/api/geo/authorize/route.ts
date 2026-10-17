import { api,body,text,HttpError } from '@/lib/server/http';
import { requireGeo,visitorId } from '@/lib/server/geo/context';
import { recordGeoEvent } from '@/lib/server/geo/metrics';
export const POST=api(async request=>{
 const d=await body(request,16000);const keys=Array.isArray(d.keys)?d.keys:[d.key];if(!keys.length||keys.length>100||keys.some(k=>typeof k!=='string'))throw new HttpError(400,'قائمة خدمات غير صالحة');
 const cityId=text(d.cityId,100)||undefined;
 for(const key of keys){try{await requireGeo(key,cityId);}catch(e){await recordGeoEvent('DENIED',cityId||null,null,key,await visitorId(true)).catch(()=>{});throw e;}}
 await recordGeoEvent('REQUEST',cityId||null,null,keys[0],await visitorId(true)).catch(()=>{});return {allowed:true};
});
