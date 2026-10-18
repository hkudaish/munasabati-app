import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireUser, requireSystemAdmin, rateLimit } from '../auth';
import { requireFeature } from '../features';
import { HttpError,text } from '../http';
import { defaultPolicy,mergePolicy,deliveryModels } from '@/lib/booking/engine';
import { publicServiceWhere } from '../catalog';
import { readGeo } from '../geo/data';
import { availability } from '@/lib/geo/engine';
import { definitions, definition, atomic, lock, admin, Tx } from './repository';

export async function effectiveOffering(tx:Tx,id:string,loadedDefinitions?:any[]){
 const defs=loadedDefinitions??await definitions(tx),record=defs.find(d=>d.id===id&&d.kind==='OFFERING');
 const serviceId=record?.body.serviceId??(!record?id:null);
 const service=serviceId?await tx.serviceItem.findUnique({where:{id:serviceId},include:{vendor:{include:{user:true,availability:true}},subcategory:true,artist:true,availability:true,packages:true,addons:true}}):null;
 const managedVendor=service?.vendor??(record?.body.commerceVendorId?await tx.vendor.findUnique({where:{id:record.body.commerceVendorId},include:{user:true,availability:true}}):null);if(managedVendor&&(managedVendor.status!=='ACTIVE'||managedVendor.user?.isActive===false))throw new HttpError(409,'المورد غير متاح');
 if(!record&&!service)throw new HttpError(404,'الخدمة غير موجودة');
 const offering=record?{...record.body,id:record.id}:{id:service!.id,serviceId:service!.id,titleAr:service!.titleAr,descriptionAr:service!.descriptionAr,categoryId:service!.categoryId,subcategoryId:service!.subcategoryId,typeId:'standard',cities:Array.from(new Set([service!.cityId,...service!.vendor.serviceAreas])),deliveryModel:'VENDOR',managerIds:service!.vendor.userId?[service!.vendor.userId]:[],resourceIds:[],enabled:service!.isPublished,policy:{},shares:service!.vendor.userId?[{managerId:service!.vendor.userId,bps:10000}]:[]};
 if(service&&(!service.isPublished||service.vendor.status!=='ACTIVE'||service.vendor.user?.isActive===false||service.subcategory?.isActive===false||service.artist?.enabled===false))throw new HttpError(409,'الخدمة أو الجهة المقدمة غير متاحة');
 if(!offering.enabled||!offering.managerIds?.length)throw new HttpError(409,'الخدمة غير مفعلة أو لا توجد جهة مخولة بتأكيدها');
 const people=offering.resourceIds.map((key:string)=>defs.find(d=>d.kind==='PERSON'&&d.id===key)).filter(Boolean);
 if(people.length!==offering.resourceIds.length||people.some((p:any)=>!p.body.enabled||!p.body.authorized||!p.body.managerIds.some((m:string)=>offering.managerIds.includes(m))))throw new HttpError(409,'ملف المنفذ أو تفويض إدارة حجزه غير معتمد');
 if(service?.subcategory?.kind==='performer'&&!people.some((p:any)=>p.body.artistId===service.artistId))throw new HttpError(409,'يلزم ربط الفنان بملف شخص معتمد وجهة إدارة مخولة قبل الحجز');
 const base=service?{options:service.addons.filter(a=>a.isAvailable).map(a=>({id:a.id,nameAr:a.titleAr,amount:a.price*100,pricingMode:a.pricingType==='PER_HOUR'?'PER_HOUR':a.pricingType==='PER_PERSON'?'PER_GUEST':a.pricingType==='PER_UNIT'?'PER_UNIT':'FIXED',maxQuantity:a.maxQuantity??10000})),baseAmount:service.price*100,pricingMode:service.priceType==='PER_PERSON'?'GUEST':service.priceType==='STARTING_AT'?'STARTING_AT':'FIXED',durationMinutes:service.executionDurationHours*60,packages:service.packages.map(p=>({id:p.id,nameAr:p.nameAr,amount:p.price*100,durationMinutes:(p.durationHours??service.executionDurationHours)*60})),...((service.executionDurationHours*60>1440)?{maxDurationMinutes:service.executionDurationHours*60}:{})}:{};
 const type=defs.find(d=>d.kind==='TYPE'&&d.id===offering.typeId);if(type&&!type.body.enabled||offering.typeId!=='standard'&&!type)throw new HttpError(409,'نوع الخدمة معطل');
 const rules=(scope:string)=>defs.find(d=>d.kind==='RULE'&&d.id===scope&&d.body.enabled)?.body.policy;
 const policy=mergePolicy(base,type?.body.policy,rules('category:'+offering.categoryId),rules('subcategory:'+offering.subcategoryId),offering.policy);
 const managerCount=await tx.user.count({where:{id:{in:offering.managerIds},isActive:true,role:{in:['VENDOR','ADMIN','SUPER_ADMIN']}}});if(managerCount!==offering.managerIds.length)throw new HttpError(409,'إحدى جهات التأكيد غير نشطة');
 return {offering,policy,people,service,vendor:managedVendor,version:record?.version??0,resourceKeys:Array.from(new Set(['offering:'+offering.id,...people.map((p:any)=>p.body.artistId?'artist:'+p.body.artistId:'person:'+p.id),...(record?.body.commerceServiceId?['service:'+record.body.commerceServiceId]:[]),...(managedVendor&&record?.body.exclusiveVendor!==false?['vendor:'+managedVendor.id]:[])])).sort()};
}
export async function getConfiguration(management=false){
 const user=management?await requireUser():null; if(management&&(!user||(!admin(user)&&user.role!=='VENDOR')))throw new HttpError(403,'خاص بإدارة الخدمات');
 const [defs,services,cities,categories,subcategories,artists]=await Promise.all([definitions(),prisma.serviceItem.findMany({where:management&&admin(user)?{}:management?{vendorId:user!.vendorProfile?.id??'__none__'}:publicServiceWhere,select:{id:true,titleAr:true,vendorId:true,categoryId:true,subcategoryId:true,artistId:true,cityId:true,price:true,priceType:true,isPublished:true,descriptionAr:true,vendor:{select:{userId:true,businessName:true}}},orderBy:{createdAt:'desc'},take:1000}),prisma.saudiCity.findMany({where:{isAvailable:true}}),prisma.serviceCategory.findMany(),prisma.serviceSubcategory.findMany(),prisma.catalogArtist.findMany()]);
 if(management){return {definitions:defs.filter(d=>admin(user)||['TYPE','RULE'].includes(d.kind)||d.body.managerIds?.includes(user!.id)),services,cities,categories,subcategories,artists,users:admin(user)?await prisma.user.findMany({where:{isActive:true,role:{in:['ADMIN','SUPER_ADMIN','VENDOR']}},select:{id:true,name:true,role:true,vendorProfile:{select:{id:true,businessName:true}}}}):[{id:user!.id,name:user!.name,role:user!.role}],canAdmin:admin(user),canConfigure:user!.role==='SUPER_ADMIN',defaultPolicy:defaultPolicy()};}
 const ids=Array.from(new Set([...services.map(s=>s.id),...defs.filter(d=>d.kind==='OFFERING'&&d.body.enabled).map(d=>d.id)]));
 const configuredServiceIds=new Set(defs.filter(d=>d.kind==='OFFERING').map(d=>d.body.serviceId));
 const geo=await readGeo();const cityAvailability=new Map(cities.map(c=>[c.id,new Set(availability(geo,{cityId:c.id,countryCode:c.countryCode,source:'MANUAL'}).filter(a=>a.available).map(a=>a.key))]));
 const offerings=[];for(const id of ids){if(configuredServiceIds.has(id)&&!defs.some(d=>d.kind==='OFFERING'&&d.id===id))continue;try{const r=await effectiveOffering(prisma,id,defs);if(r.offering.commerceServiceId)continue;const availableCities=r.offering.cities.filter((city:string)=>{const keys=cityAvailability.get(city);return keys?.has('feature:commerce')&&keys.has('category:'+r.offering.categoryId)&&(!r.service||keys.has('item:'+r.service.id));});if(!availableCities.length)continue;offerings.push({id:r.offering.id,serviceId:r.offering.serviceId,titleAr:r.offering.titleAr,descriptionAr:r.offering.descriptionAr,categoryId:r.offering.categoryId,subcategoryId:r.offering.subcategoryId,cities:availableCities,deliveryModel:r.offering.deliveryModel,people:r.people.map((p:any)=>({id:p.id,nameAr:p.body.nameAr,bioAr:p.body.bioAr,managementAr:p.body.managementAr,bookingTermsAr:p.body.bookingTermsAr})),policy:{...r.policy,commissionBps:0},version:r.version});}catch(e){if(!(e instanceof HttpError))throw e;}}
 return {offerings,cities: cities.map(c=>({id:c.id,nameAr:c.nameAr})),categories:categories.map(c=>({id:c.id,nameAr:c.nameAr}))};
}
function strings(v:any,max=50){if(!Array.isArray(v)||v.length>max)throw new HttpError(400,'قائمة غير صالحة');return Array.from(new Set<string>(v.map(x=>text(x,100,true))));}
export async function saveConfiguration(input:any){
 const user=await requireUser();await rateLimit('booking-config:'+user.id,120);if(user.role==='VENDOR')await requireFeature('vendor_portal');
 if(!admin(user)&&user.role!=='VENDOR')throw new HttpError(403,'غير مخول');
 const kind=text(input.kind,30,true),id=text(input.id||randomUUID(),140,true),data=input.body;if(!['TYPE','RULE','PERSON','OFFERING'].includes(kind)||!data||typeof data!=='object'||Array.isArray(data)||!/^[-\w:]+$/.test(id))throw new HttpError(400,'إعدادات غير صالحة');
 if(kind!=='OFFERING')await requireSystemAdmin();
 return atomic(async tx=>{
  await lock(tx,'definition:'+id);const previous=await definition(tx,id);if(previous?.body.commerceServiceId)throw new HttpError(409,'استخدم إدارة عروض الشراء لتعديل هذا العرض');if(previous&&previous.kind!==kind)throw new HttpError(409,'المعرف مستخدم لنوع آخر');if(previous&&input.version!==previous.version)throw new HttpError(409,'تغيّرت الإعدادات؛ أعد التحميل');
  let normalized:any;
  if(kind==='TYPE'||kind==='RULE'){
   if(kind==='RULE'){const [scope,...parts]=id.split(':');const scopeId=parts.join(':');if(!['category','subcategory'].includes(scope)||!scopeId||!(scope==='category'?await tx.serviceCategory.findUnique({where:{id:scopeId}}):await tx.serviceSubcategory.findUnique({where:{id:scopeId}})))throw new HttpError(400,'نطاق السياسة غير موجود');}
   try{mergePolicy(data.policy);}catch(e:any){throw new HttpError(400,e.message);}normalized={nameAr:text(data.nameAr,200,true),enabled:data.enabled===true,policy:data.policy};
  }else if(kind==='PERSON'){
   const managerIds=strings(data.managerIds);if(!managerIds.length)throw new HttpError(400,'حدد الجهة المخولة بإدارة الشخص');
   if(await tx.user.count({where:{id:{in:managerIds},isActive:true,role:{in:['VENDOR','ADMIN','SUPER_ADMIN']}}})!==managerIds.length)throw new HttpError(400,'جهة إدارة غير صالحة');
   const calendar=mergePolicy({calendar:data.calendar}).calendar,artistId=text(data.artistId,100);
   if(artistId&&!await tx.catalogArtist.findUnique({where:{id:artistId}}))throw new HttpError(400,'الفنان غير موجود');
   normalized={resourceType:['HUMAN','EQUIPMENT','ROOM','TEAM'].includes(data.resourceType)?data.resourceType:'HUMAN',capacity:data.resourceType==='EQUIPMENT'||data.resourceType==='ROOM'?Math.max(1,Number.isInteger(data.capacity)?Math.min(data.capacity,10000):1):1,nameAr:text(data.nameAr,200,true),bioAr:text(data.bioAr,8000),managementAr:text(data.managementAr,1000,true),bookingTermsAr:text(data.bookingTermsAr,8000),servicesAr:text(data.servicesAr,8000),pricesAr:text(data.pricesAr,4000),managerIds,artistId:artistId||null,calendar,enabled:data.enabled===true,authorized:data.authorized===true};
  }else{
   const serviceId=text(data.serviceId,100),service=serviceId?await tx.serviceItem.findUnique({where:{id:serviceId},include:{vendor:true}}):null;
   if(serviceId&&!service)throw new HttpError(404,'الخدمة غير موجودة');
   if(!admin(user)&&(!service||service.vendor.userId!==user.id||service.vendor.status!=='ACTIVE'||previous&&!previous.body.managerIds?.includes(user.id)))throw new HttpError(403,'يمكن إدارة خدمات متجرك المعتمد فقط');
   const managerIds=admin(user)?strings(data.managerIds):[user.id],resourceIds=strings(data.resourceIds);
   if(!managerIds.length||await tx.user.count({where:{id:{in:managerIds},isActive:true,role:{in:['VENDOR','ADMIN','SUPER_ADMIN']}}})!==managerIds.length)throw new HttpError(400,'حدد جهات تأكيد نشطة');
   const categoryId=text(data.categoryId||service?.categoryId,100,true),subcategoryId=text(data.subcategoryId||service?.subcategoryId,100),typeId=text(data.typeId||'standard',140,true);
   if(!await tx.serviceCategory.findUnique({where:{id:categoryId}})||subcategoryId&&!await tx.serviceSubcategory.findFirst({where:{id:subcategoryId,categoryId}}))throw new HttpError(400,'القسم أو التصنيف الفرعي غير صالح');
   if(typeId!=='standard'&&(await definition(tx,typeId))?.kind!=='TYPE')throw new HttpError(400,'نوع الخدمة غير موجود');
   for(const r of resourceIds){const person=await definition(tx,r);if(person?.kind!=='PERSON'||!person.body.enabled||!person.body.authorized||!person.body.managerIds.some((m:string)=>managerIds.includes(m)))throw new HttpError(400,'المنفذ غير معتمد لهذه الجهة');}
   const cities=strings(data.cities,100);if(!cities.length||await tx.saudiCity.count({where:{id:{in:cities}}})!==cities.length)throw new HttpError(400,'حدد مدناً صحيحة');
   if(!admin(user)&&cities.some(c=>c!==service!.vendor.cityId&&!service!.vendor.serviceAreas.includes(c)))throw new HttpError(400,'المدينة خارج نطاق المورد');
   if(!admin(user)&&previous&&(previous.body.deliveryModel!=='VENDOR'||previous.body.managerIds.length!==1||previous.body.managerIds[0]!==user.id))throw new HttpError(403,'الخدمات المشتركة أو المدارة خارجياً تتطلب إدارة المنصة');
   const deliveryModel=admin(user)?data.deliveryModel:'VENDOR';if(!deliveryModels.includes(deliveryModel))throw new HttpError(400,'نموذج تقديم الخدمة غير صالح');if(deliveryModel==='JOINT'&&managerIds.length<2)throw new HttpError(400,'الخدمة المشتركة تتطلب جهتين على الأقل');
   const policy={...data.policy};if(!admin(user)){if(policy.commissionBps!==undefined&&policy.commissionBps!==(previous?.body.policy?.commissionBps??defaultPolicy().commissionBps))throw new HttpError(403,'تحدد الإدارة العمولة');delete policy.commissionBps;if(previous?.body.policy?.commissionBps!==undefined)policy.commissionBps=previous.body.policy.commissionBps;}
   try{mergePolicy(policy);}catch(e:any){throw new HttpError(400,e.message);}
   const shares=admin(user)?data.shares: [{managerId:user.id,bps:10000}];if(!Array.isArray(shares)||shares.length!==managerIds.length||new Set(shares.map(s=>s.managerId)).size!==managerIds.length||shares.some(s=>!managerIds.includes(s.managerId)||!Number.isInteger(s.bps)||s.bps<=0)||shares.reduce((n,s)=>n+s.bps,0)!==10000)throw new HttpError(400,'حصص الجهات يجب أن تساوي 100%');
   const duplicate=serviceId?await tx.$queryRaw<any[]>`SELECT "id" FROM "ServiceDefinition" WHERE "kind"='OFFERING' AND "body"->>'serviceId'=${serviceId} AND "id"<>${id}`:[];if(duplicate.length)throw new HttpError(409,'توجد إعدادات لهذه الخدمة بالفعل');
   normalized={titleAr:text(data.titleAr||service?.titleAr,200,true),descriptionAr:text(data.descriptionAr||service?.descriptionAr,8000,true),serviceId:serviceId||null,categoryId,subcategoryId:subcategoryId||null,typeId,managerIds,resourceIds,cities,deliveryModel,policy,shares,enabled:data.enabled===true};
  }
  await tx.$executeRaw`INSERT INTO "ServiceDefinition" ("id","kind","body") VALUES (${id},${kind},${JSON.stringify(normalized)}::jsonb) ON CONFLICT ("id") DO UPDATE SET "body"=EXCLUDED."body","version"="ServiceDefinition"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
  await tx.systemAuditLog.create({data:{actorId:user.id,action:'BOOKING_CONFIGURATION_SAVED',targetId:id,details:{kind,before:previous?.body??null,after:normalized}}});
  return definition(tx,id);
 });
}
