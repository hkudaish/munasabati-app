import { prisma } from '@/lib/db';
import { api,body,HttpError,text,integer } from '@/lib/server/http';
import { requireSystemAdmin } from '@/lib/server/auth';
import { systemMutation } from '@/lib/server/system-admin';
import { readGeo } from '@/lib/server/geo/data';
import { validateChanges,writeChanges } from '@/lib/server/geo/changes';
import { applyChanges,availability,summary,normalizePlace } from '@/lib/geo/engine';
import { GeoChange } from '@/lib/geo/types';
import { countryCatalog,cityCatalog } from '@/lib/server/geo/catalog';
export const dynamic='force-dynamic';
export const GET=api(async request=>{
 const user=await requireSystemAdmin();const u=new URL(request.url);
 if(u.searchParams.get('catalog')==='countries')return {rows:await countryCatalog(),source:'https://www.geonames.org/export/'};
 if(u.searchParams.get('catalog')==='cities')return {rows:await cityCatalog(u.searchParams.get('country')||''),source:'https://download.geonames.org/export/dump/'};
 const snapshot=await readGeo();const [drafts,logs,metrics,orders,metricTotals]=await Promise.all([
  prisma.geoDraft.findMany({where:{ownerId:user.id,status:'DRAFT'},orderBy:{updatedAt:'desc'},take:30}),prisma.systemAuditLog.findMany({where:{action:{startsWith:'COVERAGE_'}},orderBy:{createdAt:'desc'},take:40}),
  prisma.geoDailyMetric.findMany({where:{day:{gte:new Date(Date.now()-30*86400000).toISOString().slice(0,10)}},orderBy:[{day:'desc'},{count:'desc'}],take:1000}),
  prisma.multiVendorOrder.groupBy({by:['cityId'],_count:true,where:{status:{notIn:['cancelled','completed']}}}),
  prisma.geoDailyMetric.groupBy({by:['cityKey','countryKey','serviceKey','kind'],where:{day:{gte:new Date(Date.now()-30*86400000).toISOString().slice(0,10)}},_sum:{count:true}})
 ]);
 const rows=snapshot.cities.map(city=>{const selected={cityId:city.id,countryCode:city.countryCode,source:'MANUAL' as const};const all=availability(snapshot,selected);return {cityId:city.id,status:summary(snapshot,selected,all),available:all.filter(x=>x.available).length,total:all.length,existingOrders:orders.find(o=>o.cityId===city.id)?._count||0};});
 return {snapshot,drafts,logs,metrics,metricTotals,citySummaries:rows,reverseConfigured:!!process.env.GEOAPIFY_API_KEY,stats:{countries:snapshot.countries.length,enabledCountries:snapshot.countries.filter(c=>c.enabled).length,cities:snapshot.cities.length,enabledCities:rows.filter(r=>['FULL','PARTIAL'].includes(r.status)).length,partialCities:rows.filter(r=>r.status==='PARTIAL').length,disabledCities:rows.filter(r=>r.status==='NONE').length,services:snapshot.services.length}};
});
export const POST=api(async request=>{
 const actor=await requireSystemAdmin();const d=await body(request,2000000);
 if(d.action==='country'){
  const code=text(d.code,2,true).toUpperCase();if(!/^[A-Z]{2}$/.test(code))throw new HttpError(400,'استخدم رمز الدولة ISO من حرفين');
  const nameAr=text(d.nameAr,120,true),nameEn=text(d.nameEn,120,true);const version=integer(d.version,2147483646);const aliases=text(d.aliases,1000).split('|').filter(Boolean);
  await systemMutation(actor.id,async tx=>{
   if(version){const result=await tx.geoCountry.updateMany({where:{code,version},data:{nameAr,nameEn,aliases,version:{increment:1}}});if(!result.count)throw new HttpError(409,'الدولة معدلة؛ أعد التحميل');}
   else await tx.geoCountry.create({data:{code,nameAr,nameEn,aliases,enabled:false}});
   await tx.geoRevision.upsert({where:{id:'default'},create:{version:1},update:{version:{increment:1}}});await tx.systemAuditLog.create({data:{actorId:actor.id,action:'COVERAGE_COUNTRY_SAVED',targetId:code}});
  });return {success:true};
 }
 if(d.action==='cities'||d.action==='city'){
  const input=d.action==='city'?[d]:d.rows;if(!Array.isArray(input)||!input.length||input.length>300)throw new HttpError(400,'اختر من 1 إلى 300 مدينة');
  await systemMutation(actor.id,async tx=>{
   const countries=await tx.geoCountry.findMany();const existing=await tx.saudiCity.findMany();const used=new Set<string>();
   for(const row of input){
    const countryCode=text(row.countryCode,2,true).toUpperCase();if(!countries.some(c=>c.code===countryCode))throw new HttpError(400,'أضف الدولة أولاً: '+countryCode);
    const id=text(row.cityId||row.id,100,true),nameAr=text(row.nameAr,120,true),nameEn=text(row.nameEn,120,true),regionAr=text(row.regionAr,120,true),regionId=text(row.regionId,100)||countryCode+'-'+normalizePlace(regionAr),regionEn=text(row.regionEn,120)||regionAr;
    if(!/^[A-Za-z0-9_.-]+$/.test(id)||used.has(id))throw new HttpError(400,'معرف مدينة غير صالح أو مكرر');used.add(id);
    const externalId=text(row.externalId,160)||null;const aliases=text(Array.isArray(row.aliases)?row.aliases.join('|'):row.aliases,2000).split('|').filter(Boolean);
    const version=integer(row.version,2147483646);
    // Attach a trusted source ID to an unambiguous legacy city; preserve its existing primary key and relationships.
    const matches=existing.filter(c=>c.countryCode===countryCode&&[c.nameAr,c.nameEn,...c.aliases].some(n=>[nameAr,nameEn,...aliases].some(a=>normalizePlace(a)===normalizePlace(n))));
    if(!version&&externalId?.startsWith('geonames:')&&matches.length===1&&!matches[0].externalId){
     const legacy=matches[0];await tx.saudiCity.update({where:{id:legacy.id},data:{externalId,aliases:Array.from(new Set([...legacy.aliases,...aliases,nameAr,nameEn])).slice(0,60),version:{increment:1}}});legacy.externalId=externalId;continue;
    }
    const duplicate=existing.find(c=>c.id!==id&&c.countryCode===countryCode&&normalizePlace(c.regionAr)===normalizePlace(regionAr)&&[c.nameAr,c.nameEn,...c.aliases].some(n=>[nameAr,nameEn,...aliases].some(a=>normalizePlace(a)===normalizePlace(n))));
    if(duplicate)throw new HttpError(409,'المدينة موجودة مسبقاً بمعرف '+duplicate.id);
    const region=await tx.geoRegion.findUnique({where:{id:regionId}});if(region&&region.countryCode!==countryCode)throw new HttpError(400,'المنطقة تتبع دولة أخرى');
    await tx.geoRegion.upsert({where:{id:regionId},create:{id:regionId,countryCode,nameAr:regionAr,nameEn:regionEn},update:{}});
    const value={nameAr,nameEn,regionAr,regionId,countryCode,aliases,externalId};
    if(version){const changed=await tx.saudiCity.updateMany({where:{id,version},data:{...value,version:{increment:1}}});if(!changed.count)throw new HttpError(409,'المدينة معدلة؛ أعد التحميل');}
    else {const same=existing.find(c=>c.id===id||externalId&&c.externalId===externalId);if(same)continue;await tx.saudiCity.create({data:{id,...value,isAvailable:false,defaultAvailable:false}});existing.push({id,...value} as any);}
   }
   await tx.geoRevision.upsert({where:{id:'default'},create:{version:1},update:{version:{increment:1}}});await tx.systemAuditLog.create({data:{actorId:actor.id,action:'COVERAGE_CITIES_IMPORTED',targetId:'cities',details:{rows:input.length}}});
  });return {success:true};
 }
 if(d.action==='saveDraft'){
  const snapshot=await readGeo();const changes=validateChanges(d.changes,snapshot);const name=text(d.name,120,true);
  const draft=await systemMutation(actor.id,async tx=>{
   if(d.id){const previous=await tx.geoDraft.findFirst({where:{id:d.id,ownerId:actor.id,status:'DRAFT',version:integer(d.version,2147483646)}});if(!previous)throw new HttpError(409,'المسودة تغيرت أو لم تعد متاحة');
    return tx.geoDraft.update({where:{id:previous.id},data:{name,payload:JSON.parse(JSON.stringify({changes})),version:{increment:1}}});}
   return tx.geoDraft.create({data:{ownerId:actor.id,name,baseRevision:snapshot.revision,payload:JSON.parse(JSON.stringify({changes}))}});
  });return {draft};
 }
 if(d.action==='previewChanges'){
  const s=await readGeo();const changes=validateChanges(d.changes,s);const proposed=applyChanges(s,changes);
  const rows=proposed.cities.map(c=>{const location={cityId:c.id,countryCode:c.countryCode,source:'PREVIEW' as const};const before=availability(s,location),after=availability(proposed,location);return {cityId:c.id,name:c.nameAr,before:before.filter(r=>r.available).length,after:after.filter(r=>r.available).length,status:summary(proposed,location,after),changed:JSON.stringify(before)!==JSON.stringify(after)};});
  const cities=rows.filter(r=>r.changed).map(r=>r.cityId);const affectedOrders=cities.length?await prisma.multiVendorOrder.count({where:{cityId:{in:cities},status:{notIn:['cancelled','completed']}}}):0;
  return {rows,affectedOrders,revision:s.revision};
 }
 if(d.action==='publish'){
  const id=text(d.id,100,true),version=integer(d.version,2147483646);
  await systemMutation(actor.id,async tx=>{
   const draft=await tx.geoDraft.findFirst({where:{id,ownerId:actor.id,status:'DRAFT',version}});if(!draft)throw new HttpError(409,'المسودة تغيرت أو نُشرت سابقاً');
   const current=await readGeo(tx);if(current.revision!==draft.baseRevision)throw new HttpError(409,'إعدادات التغطية تغيرت بعد إنشاء المسودة؛ راجعها وأعد تأسيسها أولاً');
   const changes=validateChanges((draft.payload as any).changes,current);
   await tx.geoRevision.upsert({where:{id:'default'},create:{version:0},update:{}});
   const bumped=await tx.geoRevision.updateMany({where:{id:'default',version:draft.baseRevision},data:{version:{increment:1}}});if(!bumped.count)throw new HttpError(409,'تعارض نشر الإعدادات');
   await writeChanges(tx,changes);await tx.geoDraft.update({where:{id},data:{status:'PUBLISHED',version:{increment:1}}});
   await tx.systemAuditLog.create({data:{actorId:actor.id,action:'COVERAGE_PUBLISHED',targetId:id,details:{changes:JSON.parse(JSON.stringify(changes)),previousRevision:current.revision}}});
  });return {success:true};
 }
 if(d.action==='discard'||d.action==='rebase'){
  await systemMutation(actor.id,async tx=>{const changed=await tx.geoDraft.updateMany({where:{id:text(d.id,100,true),ownerId:actor.id,status:'DRAFT',version:integer(d.version,2147483646)},data:d.action==='discard'?{status:'DISCARDED',version:{increment:1}}:{baseRevision:(await readGeo(tx)).revision,version:{increment:1}}});if(!changed.count)throw new HttpError(409,'المسودة تغيرت؛ أعد التحميل');});return {success:true};
 }
 if(d.action==='preview'){
  const s=await readGeo();const cityId=text(d.cityId,100)||null;if(cityId&&!s.cities.some(c=>c.id===cityId))throw new HttpError(400,'المدينة غير مسجلة');
  if(!['guest','member','subscriber'].includes(d.visitorType))throw new HttpError(400,'نوع المعاينة غير صالح');
  const draftId=text(d.draftId,100)||null;if(draftId&&!await prisma.geoDraft.findFirst({where:{id:draftId,ownerId:actor.id,status:'DRAFT'}}))throw new HttpError(404,'المسودة غير متاحة');
  const preview=await prisma.geoPreview.create({data:{ownerId:actor.id,cityId,countryCode:s.cities.find(c=>c.id===cityId)?.countryCode||null,draftId,visitorType:d.visitorType,expiresAt:new Date(Date.now()+2*3600000)}});return {url:'/coverage-preview/'+preview.id,previewId:preview.id};
 }
 throw new HttpError(400,'عملية غير صالحة');
});
