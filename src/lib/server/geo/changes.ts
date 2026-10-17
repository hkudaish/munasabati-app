import 'server-only';
import { Prisma } from '@prisma/client';
import { GeoChange,GeoSnapshot,Policy } from '@/lib/geo/types';
import { HttpError,text } from '@/lib/server/http';
export function validateChanges(value:unknown,s:GeoSnapshot):GeoChange[]{
 if(!Array.isArray(value)||value.length>150)throw new HttpError(400,'الحد الأقصى 150 إجراء في المسودة');
 let cells=0;
 return value.map(d=>{
  if(!d||typeof d!=='object')throw new HttpError(400,'تغيير غير صالح');
  if(d.type==='country'){if(!s.countries.some(c=>c.code===d.id)||typeof d.enabled!=='boolean')throw new HttpError(400,'دولة أو حالة غير صالحة');return {type:d.type,id:d.id,enabled:d.enabled};}
  if(d.type==='city'){if(!s.cities.some(c=>c.id===d.id)||typeof d.enabled!=='boolean'||d.defaultAvailable!==undefined&&typeof d.defaultAvailable!=='boolean')throw new HttpError(400,'مدينة أو حالة غير صالحة');return {type:d.type,id:d.id,enabled:d.enabled,...(d.defaultAvailable!==undefined?{defaultAvailable:d.defaultAvailable}:{})};}
  if(d.type==='copy'){if(!s.cities.some(c=>c.id===d.sourceId)||!Array.isArray(d.targetIds)||!d.targetIds.length||d.targetIds.length>300||d.targetIds.some((id:any)=>!s.cities.some(c=>c.id===id)||id===d.sourceId))throw new HttpError(400,'مدن النسخ غير صالحة');return {type:d.type,sourceId:d.sourceId,targetIds:Array.from(new Set<string>(d.targetIds))};}
  if(d.type==='policy'){const p=d.value;if(!p||!['PROMPT','DENY','ALLOW'].includes(p.unknownCity)||['hideUnavailable','analyticsEnabled','reverseEnabled','ipEnabled'].some(k=>typeof p[k]!=='boolean'))throw new HttpError(400,'سياسة غير صالحة');return {type:d.type,value:{unknownCity:p.unknownCity,hideUnavailable:p.hideUnavailable,analyticsEnabled:p.analyticsEnabled,reverseEnabled:p.reverseEnabled,ipEnabled:p.ipEnabled} as Policy};}
  if(d.type!=='rules'||!Array.isArray(d.cityIds)||!Array.isArray(d.keys)||!d.cityIds.length||!d.keys.length||d.cityIds.some((id:any)=>!s.cities.some(c=>c.id===id))||d.keys.some((key:any)=>!s.services.some(x=>x.key===key))||!['AVAILABLE','UNAVAILABLE','SOON'].includes(d.status))throw new HttpError(400,'الخدمات أو المدن غير صالحة');
  const cityIds=Array.from(new Set<string>(d.cityIds)),keys=Array.from(new Set<string>(d.keys));cells+=cityIds.length*keys.length;if(cells>5000)throw new HttpError(400,'الحد الأقصى 5000 إعداد في العملية');
  const date=(v:any)=>{if(!v)return null;if(typeof v!=='string'||!Number.isFinite(new Date(v).getTime()))throw new HttpError(400,'تاريخ غير صالح');return new Date(v).toISOString();};
  const startsAt=date(d.startsAt),endsAt=date(d.endsAt);if(startsAt&&endsAt&&endsAt<=startsAt)throw new HttpError(400,'نهاية الإتاحة يجب أن تكون بعد بدايتها');
  return {type:d.type,cityIds,keys,status:d.status,startsAt,endsAt,reason:text(d.reason,500),message:text(d.message,1000)};
 });
}
export async function writeChanges(tx:Prisma.TransactionClient,changes:GeoChange[]){
 for(const d of changes){
  if(d.type==='country')await tx.geoCountry.update({where:{code:d.id},data:{enabled:d.enabled,version:{increment:1}}});
  if(d.type==='city')await tx.saudiCity.update({where:{id:d.id},data:{isAvailable:d.enabled,...(d.defaultAvailable!==undefined?{defaultAvailable:d.defaultAvailable}:{}),version:{increment:1}}});
  if(d.type==='policy')await tx.geoPolicy.upsert({where:{id:'default'},create:{id:'default',...d.value},update:{...d.value,version:{increment:1}}});
  if(d.type==='rules'){
   const featureIds=d.keys.filter(k=>k.startsWith('feature:')).map(k=>k.slice(8)),serviceIds=d.keys.filter(k=>k.startsWith('item:')).map(k=>k.slice(5));
   await tx.geoRule.deleteMany({where:{cityId:{in:d.cityIds},OR:[{featureId:{in:featureIds}},{serviceId:{in:serviceIds}}]}});
   await tx.geoRule.createMany({data:d.cityIds.flatMap(cityId=>d.keys.map(key=>({cityId,...(key.startsWith('feature:')?{featureId:key.slice(8)}:{serviceId:key.slice(5)}),status:d.status,startsAt:d.startsAt?new Date(d.startsAt):null,endsAt:d.endsAt?new Date(d.endsAt):null,reason:d.reason,message:d.message})))});
  }
  if(d.type==='copy'){const rules=await tx.geoRule.findMany({where:{cityId:d.sourceId}});const source=await tx.saudiCity.findUniqueOrThrow({where:{id:d.sourceId}});
   for(const cityId of d.targetIds){await tx.geoRule.deleteMany({where:{cityId}});if(rules.length)await tx.geoRule.createMany({data:rules.map(({id,version,updatedAt,...r})=>({...r,cityId}))});await tx.saudiCity.update({where:{id:cityId},data:{defaultAvailable:source.defaultAvailable,version:{increment:1}}});}
  }
 }
}
