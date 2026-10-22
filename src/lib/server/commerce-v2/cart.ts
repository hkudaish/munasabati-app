import 'server-only';
import { randomUUID,createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireUser } from '../auth';
import { HttpError,text,integer } from '../http';
import { atomic,lock,Tx } from '../booking/repository';
import { activeOffer } from './catalog';
import { offerPrice,discountedPrices,fixedPackagePrices } from '@/lib/commerce/engine';
import { requireGeo } from '../geo/context';
import { assertBookable, decideOffering } from '../availability/enforce';
import { amount } from '@/lib/booking/engine';
import { emit } from './events';
import { syncDraftsWithCart } from './draft-sync';
import { detectPriceChanges, recordBaseline } from './price-watch';
function stable(value:any):any{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;}
export function parseLines(value:any){if(!Array.isArray(value)||value.length>40)throw new HttpError(400,'السلة تقبل حتى 40 عنصراً');const seen=new Set();return value.map(row=>{const id=text(row.id||randomUUID(),140,true);if(seen.has(id))throw new HttpError(400,'عنصر مكرر');seen.add(id);if(!!row.offerId===!!row.packageId)throw new HttpError(400,'اختر عرضاً أو باقة لكل عنصر');return {id,offerId:text(row.offerId,140)||null,packageId:text(row.packageId,140)||null,quantity:Math.max(1,integer(row.quantity,1000,1)),durationMinutes:integer(row.durationMinutes,525600)||undefined,guestCount:Math.max(1,integer(row.guestCount,100000,1)),date:text(row.date,10),time:text(row.time,5),cityId:text(row.cityId,100,true),notes:text(row.notes,2000),venue:text(row.venue,1000),options:row.options??[],fields:row.fields??{},choices:row.choices??{},...(row.savedForLater===true?{savedForLater:true}:{}),...(row.draftId?{draftId:text(row.draftId,140),snapshotId:text(row.snapshotId,140)}:{})};});}
export const activeLines=(lines:any[])=>lines.filter(l=>!l.savedForLater);
export const savedLines=(lines:any[])=>lines.filter(l=>l.savedForLater);
export async function quoteLines(tx:Tx,source:any[]){
 const lines:any[]=[];const packageSnapshots:any[]=[];
 for(const entry of source){
  let selected:any[]=[];let pack:any=null;const omittedUnavailable:any[]=[];
  if(entry.packageId){pack=(await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackage" WHERE "id"=${entry.packageId}`)[0];if(!pack?.body.published)throw new HttpError(409,'الباقة غير متاحة');const items=await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackageItem" WHERE "packageId"=${entry.packageId} ORDER BY "id"`;if(!items.length)throw new HttpError(409,'الباقة فارغة');
   if(!entry.choices||typeof entry.choices!=='object'||Array.isArray(entry.choices)||JSON.stringify(entry.choices).length>20000)throw new HttpError(400,'تخصيص الباقة غير صالح');for(const item of items){const choice=entry.choices[item.id]??{};if(choice.omit){if(!item.body.optional)throw new HttpError(400,'لا يمكن حذف عنصر إلزامي');continue;}const offerId=choice.offerId??item.offerId;if(offerId!==item.offerId&&!item.body.substitutions.includes(offerId))throw new HttpError(400,'بديل غير مسموح');
   // a package is bookable when every REQUIRED component can be fulfilled (or a permitted substitute is chosen); an unavailable OPTIONAL one is left out and the price is recalculated
   const here=await decideOffering(tx,{offeringId:offerId,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:entry.quantity*item.body.quantity,intent:'BOOK',packageId:pack.id,noLock:true});
   if(here&&!here.decision.canBook){if(item.body.optional){omittedUnavailable.push({itemId:item.id,offerId,reasonCodes:here.decision.reasonCodes});continue;}const alternatives:string[]=[];for(const alt of item.body.substitutions??[]){if(alt===offerId)continue;const other=await decideOffering(tx,{offeringId:alt,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:entry.quantity*item.body.quantity,intent:'BOOK',packageId:pack.id,noLock:true});if(other?.decision.canBook)alternatives.push(alt);}throw new HttpError(409,alternatives.length?'أحد عناصر الباقة الإلزامية غير متاح؛ اختر بديلاً متاحاً':(here.decision.message.ar||'أحد عناصر الباقة الإلزامية غير متاح في هذا الموعد أو المكان'),{reasonCodes:here.decision.reasonCodes,unavailableItem:item.id,alternatives});}selected.push({offerId,quantity:entry.quantity*item.body.quantity,durationMinutes:item.body.durationMinutes,offsetMinutes:item.body.offsetMinutes,itemKey:item.id,options:choice.options??[],fields:choice.fields??entry.fields});}
   if(!selected.length)throw new HttpError(400,'لا يمكن شراء باقة فارغة');packageSnapshots.push({cartLineId:entry.id,id:pack.id,version:pack.version,body:pack.body,items,...(omittedUnavailable.length?{omittedUnavailable}:{})});
  }else selected=[{offerId:entry.offerId,quantity:entry.quantity,durationMinutes:entry.durationMinutes,offsetMinutes:0,itemKey:entry.id,options:entry.options,fields:entry.fields}];
  if(lines.length+selected.length>100)throw new HttpError(400,'الحد الأقصى 100 عنصر تنفيذ في الطلب');
  let expanded:any[]=[];for(const selection of selected){
   const {offer,service,effective}=await activeOffer(tx,selection.offerId);if(pack&&service.ownerId!==pack.ownerId&&!offer.body.allowPackages)throw new HttpError(409,'سحب مقدم الخدمة إذن الإدراج في الباقة');
   // a digital service is delivered online: it is not tied to the city's coverage (an explicit availability policy can still restrict it)
   if(service.body.kind!=='DIGITAL'){if(!service.body.cities.includes(entry.cityId))throw new HttpError(409,'أحد عناصر السلة لا يغطي المدينة');await requireGeo('feature:commerce',entry.cityId,tx);await requireGeo('category:'+service.body.categoryId,entry.cityId,tx);if(service.sourceId)await requireGeo('item:'+service.sourceId,entry.cityId,tx);}
   await assertBookable(tx,{offeringId:selection.offerId,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:selection.quantity,intent:'BOOK',packageId:pack?.id??null,noLock:true});
   const requiresBooking=['BOOKABLE','FIELD'].includes(service.body.kind);if(requiresBooking&&(!entry.date||!entry.time))throw new HttpError(400,'حدد تاريخ ووقت '+service.body.titleAr);
   let priced;try{priced=offerPrice({...offer.body,policy:effective.policy},{...entry,...selection});}catch(e:any){throw new HttpError(400,e.message);}
   expanded.push({cartLineId:entry.id,packageId:pack?.id??null,packageVersion:pack?.version??null,serviceId:service.id,offerId:offer.id,offerVersion:offer.version,serviceVersion:service.version,titleAr:service.body.titleAr,offerNameAr:offer.body.nameAr,requiresBooking,selection:{...entry,...selection},price:priced,policy:priced.policy,service:service.body,offer:offer.body,managers:effective.offering.managerIds,shares:effective.offering.shares,resourceKeys:effective.resourceKeys,people:effective.people.map((p:any)=>({id:p.id,nameAr:p.body.nameAr,managementAr:p.body.managementAr,bookingTermsAr:p.body.bookingTermsAr})),sourceId:service.sourceId});
  }
  if(pack){try{expanded=pack.body.fixedTotal?fixedPackagePrices(expanded,amount(pack.body.fixedTotal*entry.quantity)):discountedPrices(expanded,pack.body.discountBps);}catch(e:any){throw new HttpError(400,e.message);}if(pack.body.budgetMax&&expanded.reduce((n,l)=>n+l.price.total,0)>pack.body.budgetMax)throw new HttpError(409,'التخصيص يتجاوز ميزانية الباقة');}lines.push(...expanded);
 }
 if(lines.length){const required=await tx.$queryRaw<any[]>`SELECT * FROM "CommerceRelationship" WHERE "kind"='REQUIRED'`;for(const relation of required)if(relation.body.enabled&&lines.some(l=>l.serviceId===relation.serviceId)&&!lines.some(l=>l.serviceId===relation.relatedServiceId))throw new HttpError(400,'يلزم إضافة الخدمة المطلوبة المرتبطة قبل متابعة الشراء');}
 const sum=(key:string)=>amount(lines.reduce((n,l)=>n+l.price[key],0)),totals={subtotal:sum('subtotal'),tax:sum('tax'),fees:sum('fees'),discount:sum('discount'),total:sum('total'),deposit:sum('deposit'),needsQuote:lines.some(l=>l.price.needsQuote),currency:'SAR',unit:'HALALA'};
 const hash=createHash('sha256').update(JSON.stringify(stable({lines,packageSnapshots,totals}))).digest('hex');return {lines,packageSnapshots,totals,hash};
}
export function publicQuote(q:any){return {...q,lines:q.lines.map((l:any)=>({...l,sourceId:undefined,managers:undefined,shares:undefined,resourceKeys:undefined,service:{...l.service,managerIds:undefined,resourceIds:undefined},offer:{...l.offer,managerIds:undefined,shares:undefined,policy:{...l.policy,commissionBps:0}},policy:{...l.policy,commissionBps:0},price:{...l.price,commission:undefined,policy:undefined}}))};}
export async function getCart(){
 const user=await requireUser();
 // price changes are looked for whenever the customer opens the cart, so a higher price is never first met at payment
 await detectPriceChanges(user.id).catch(()=>{});
 return atomic(async tx=>{
  const row=(await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0]??{body:{lines:[]},version:0};
  let quote=null,error='';
  try{quote=publicQuote(await quoteLines(tx,activeLines(row.body.lines)));}catch(e){if(!(e instanceof HttpError))throw e;error=e.message;}
  // saved-for-later items keep their choices; each is priced on its own so the customer can see whether it is still available
  const saved:any[]=[];
  for(const line of savedLines(row.body.lines)){try{saved.push({line,quote:publicQuote(await quoteLines(tx,[line]))});}catch(e){if(!(e instanceof HttpError))throw e;saved.push({line,error:e.message});}}
  const priceChanges=await tx.$queryRaw<any[]>`SELECT "id","lineId","direction","differenceHalala","differencePercent","reasonCode","detectedAt","acknowledgedAt","previousSnapshotId","newSnapshotId" FROM "CartPriceChange" WHERE "userId"=${user.id} AND "acknowledgedAt" IS NULL AND "lineId" = ANY(${activeLines(row.body.lines).map((l:any)=>l.id)}) ORDER BY "detectedAt" DESC LIMIT 50`;
  const notifications=(await tx.$queryRaw<any[]>`SELECT "id","body","readAt","createdAt" FROM "ServiceInbox" WHERE "userId"=${user.id} AND "body"->>'referenceType'='CART' ORDER BY "createdAt" DESC LIMIT 5`).map(n=>({id:n.id,title:n.body.titleAr,text:n.body.statusAr,createdAt:n.createdAt}));
  return {cart:row,quote,error,saved,priceChanges:priceChanges.map(c=>({...c,differenceHalala:Number(c.differenceHalala),differencePercent:c.differencePercent===null?null:Number(c.differencePercent)})),notifications};
 });
}
export async function saveCart(input:any,locale='ar'){
 const user=await requireUser(),lines=parseLines(input.lines);
 return atomic(async tx=>{
  await lock(tx,'cart:'+user.id);
  const previous=(await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0];
  if((previous?.version??0)!==input.version)throw new HttpError(409,'السلة تغيرت؛ أعد تحميلها');
  const quote=await quoteLines(tx,activeLines(lines));
  const lang=locale==='en'?'en':'ar';
  await tx.$executeRaw`INSERT INTO "CommerceCart" ("userId","body","locale","lastActivityAt") VALUES (${user.id},${JSON.stringify({lines})}::jsonb,${lang},CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "body"=EXCLUDED."body","locale"=EXCLUDED."locale","lastActivityAt"=CURRENT_TIMESTAMP,"version"="CommerceCart"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
  const cart=(await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0];
  await recordBaseline(tx,user.id,quote.lines);
  await syncDraftsWithCart(tx,user.id,lines.map((l:any)=>l.id));
  await emit(tx,{aggregateType:'Cart',aggregateId:user.id,version:cart.version,type:'CartSaved',payload:{lines:lines.length}});
  return {cart,quote:publicQuote(quote),error:''};
 });
}
/** Moves one cart item to "saved for later" (or back). Its choices are kept exactly; only the active part of the cart is priced and bought. */
export async function setLineSaved(input:any,locale='ar'){
 const user=await requireUser(),lineId=text(input.lineId,140,true),saved=input.saved===true;
 return atomic(async tx=>{
  await lock(tx,'cart:'+user.id);
  const cart=(await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0];
  if(!cart||cart.version!==input.version)throw new HttpError(409,'السلة تغيرت؛ أعد تحميلها');
  if(!cart.body.lines.some((l:any)=>l.id===lineId))throw new HttpError(404,'العنصر غير موجود');
  const lines=cart.body.lines.map((l:any)=>l.id===lineId?(saved?{...l,savedForLater:true}:Object.fromEntries(Object.entries(l).filter(([k])=>k!=='savedForLater'))):l);
  // bringing an item back must leave the cart purchasable as a whole; a saved item may be unavailable and is never rejected for that
  if(!saved)await quoteLines(tx,activeLines(lines));
  await tx.$executeRaw`UPDATE "CommerceCart" SET "body"=${JSON.stringify({lines})}::jsonb,"version"="version"+1,"lastActivityAt"=CURRENT_TIMESTAMP,"locale"=${locale==='en'?'en':'ar'},"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id}`;
  await emit(tx,{aggregateType:'Cart',aggregateId:user.id,version:cart.version+1,type:saved?'CartItemSavedForLater':'CartItemRestored',payload:{lineId}});
  return {ok:true,version:cart.version+1};
 });
}
/** The customer confirms they have seen a higher price; checkout is refused until every increase on an item in the cart is acknowledged. */
export async function acknowledgePrice(lineId:string){
 const user=await requireUser();
 const count=await prisma.$executeRaw`UPDATE "CartPriceChange" SET "acknowledgedAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id} AND "lineId"=${text(lineId,140,true)} AND "acknowledgedAt" IS NULL`;
 return {acknowledged:count};
}
export async function priceHistory(lineId:string){
 const user=await requireUser();
 const snapshots=await prisma.$queryRaw<any[]>`SELECT "id","totalHalala","breakdown","createdAt" FROM "CartPriceSnapshot" WHERE "userId"=${user.id} AND "lineId"=${text(lineId,140,true)} ORDER BY "createdAt" ASC, "id" ASC LIMIT 200`;
 const changes=await prisma.$queryRaw<any[]>`SELECT "direction","differenceHalala","differencePercent","detectedAt","acknowledgedAt" FROM "CartPriceChange" WHERE "userId"=${user.id} AND "lineId"=${lineId} ORDER BY "detectedAt" ASC`;
 return {snapshots:snapshots.map(x=>({...x,totalHalala:Number(x.totalHalala)})),changes:changes.map(x=>({...x,differenceHalala:Number(x.differenceHalala),differencePercent:x.differencePercent===null?null:Number(x.differencePercent)}))};
}
