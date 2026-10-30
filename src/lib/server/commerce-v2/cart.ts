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
import { applyPackagePolicy, calculate, Entry, PackagePolicy, Rule } from '@/lib/commerce/pricing-engine';
import { loadPolicy, loadRules, orderCount, policyView, publicPricing, usageMap } from './pricing';
import { detectPriceChanges, recordBaseline } from './price-watch';
import { assertNotice } from '../exceptions/waiver';
import { acceptedOffer } from '../exceptions/offers-read';
function stable(value:any):any{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;}
export function parseLines(value:any){if(!Array.isArray(value)||value.length>40)throw new HttpError(400,'السلة تقبل حتى 40 عنصراً');const seen=new Set();return value.map(row=>{const id=text(row.id||randomUUID(),140,true);if(seen.has(id))throw new HttpError(400,'عنصر مكرر');seen.add(id);if(!!row.offerId===!!row.packageId)throw new HttpError(400,'اختر عرضاً أو باقة لكل عنصر');return {id,offerId:text(row.offerId,140)||null,packageId:text(row.packageId,140)||null,quantity:Math.max(1,integer(row.quantity,1000,1)),durationMinutes:integer(row.durationMinutes,525600)||undefined,guestCount:Math.max(1,integer(row.guestCount,100000,1)),date:text(row.date,10),time:text(row.time,5),cityId:text(row.cityId,100,true),notes:text(row.notes,2000),venue:text(row.venue,1000),options:row.options??[],fields:row.fields??{},choices:row.choices??{},...(row.savedForLater===true?{savedForLater:true}:{}),...(row.draftId?{draftId:text(row.draftId,140),snapshotId:text(row.snapshotId,140)}:{}),...(row.exceptionId?{exceptionId:text(row.exceptionId,140)}:{})};});}
export const activeLines=(lines:any[])=>lines.filter(l=>!l.savedForLater);
export const savedLines=(lines:any[])=>lines.filter(l=>l.savedForLater);
/** What the pricing engine needs besides the lines: who is buying, the codes they typed, and (for previews only) policies or rules that are not saved yet. */
export interface QuoteOptions{/** price a selection without judging its notice period (the exception workflow prices the request it is about to evaluate) */waiveNotice?:boolean;userId?:string|null;promoCodes?:string[];now?:Date;policyOverrides?:Record<string,PackagePolicy>;extraRules?:Rule[]}
export const cartPromoCodes=(body:any):string[]=>Array.isArray(body?.promoCodes)?body.promoCodes.filter((c:any)=>typeof c==='string').slice(0,3):[];
export const cartBody=(previous:any,lines:any[],promoCodes?:string[])=>{const next={...(previous??{}),lines};if(promoCodes!==undefined){if(promoCodes.length)(next as any).promoCodes=promoCodes;else delete (next as any).promoCodes;}return next;};
/** Up to three codes, letters, digits, dash and underscore only. */
export function parsePromoCodes(value:any):string[]{if(!Array.isArray(value)||value.length>3)throw new HttpError(400,'رمز ترويجي غير صحيح');const seen=new Set<string>();for(const c of value){if(typeof c!=='string'||!/^[A-Za-z0-9_-]{2,32}$/.test(c.trim()))throw new HttpError(400,'رمز ترويجي غير صحيح');seen.add(c.trim().toUpperCase());}return Array.from(seen);}
export const quoteOptionsFor=(userId:string|null,body:any):QuoteOptions=>({userId,promoCodes:cartPromoCodes(body)});
export async function quoteLines(tx:Tx,source:any[],opts:QuoteOptions={}){
 const lines:any[]=[];const packageSnapshots:any[]=[];const entries:Entry[]=[];const now=opts.now??new Date();const waivers=new Map<string,any>(),feeApplied=new Set<string>();
 for(const entry of source){
  let selected:any[]=[];let pack:any=null;let policy:any=null;const omittedUnavailable:any[]=[];
  if(entry.packageId){pack=(await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackage" WHERE "id"=${entry.packageId}`)[0];if(!pack?.body.published)throw new HttpError(409,'الباقة غير متاحة');const items=await tx.$queryRaw<any[]>`SELECT * FROM "CommercePackageItem" WHERE "packageId"=${entry.packageId} ORDER BY COALESCE(("body"->>'sortOrder')::int,0),"id"`;if(!items.length)throw new HttpError(409,'الباقة فارغة');
   if(!entry.choices||typeof entry.choices!=='object'||Array.isArray(entry.choices)||JSON.stringify(entry.choices).length>20000)throw new HttpError(400,'تخصيص الباقة غير صالح');for(const item of items){const choice=entry.choices[item.id]??{};if(choice.omit){if(!item.body.optional)throw new HttpError(400,'لا يمكن حذف عنصر إلزامي');continue;}const offerId=choice.offerId??item.offerId;if(offerId!==item.offerId&&!item.body.substitutions.includes(offerId))throw new HttpError(400,'بديل غير مسموح');
   // a package is bookable when every REQUIRED component can be fulfilled (or a permitted substitute is chosen); an unavailable OPTIONAL one is left out and the price is recalculated
   const here=await decideOffering(tx,{offeringId:offerId,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:entry.quantity*item.body.quantity,intent:'BOOK',packageId:pack.id,noLock:true});
   if(here&&!here.decision.canBook){if(item.body.optional){omittedUnavailable.push({itemId:item.id,offerId,reasonCodes:here.decision.reasonCodes});continue;}const alternatives:string[]=[];for(const alt of item.body.substitutions??[]){if(alt===offerId)continue;const other=await decideOffering(tx,{offeringId:alt,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:entry.quantity*item.body.quantity,intent:'BOOK',packageId:pack.id,noLock:true});if(other?.decision.canBook)alternatives.push(alt);}throw new HttpError(409,alternatives.length?'أحد عناصر الباقة الإلزامية غير متاح؛ اختر بديلاً متاحاً':(here.decision.message.ar||'أحد عناصر الباقة الإلزامية غير متاح في هذا الموعد أو المكان'),{reasonCodes:here.decision.reasonCodes,unavailableItem:item.id,alternatives});}selected.push({offerId,quantity:entry.quantity*item.body.quantity,durationMinutes:item.body.durationMinutes,offsetMinutes:item.body.offsetMinutes,itemKey:item.id,options:choice.options??[],fields:choice.fields??entry.fields});}
   if(!selected.length)throw new HttpError(400,'لا يمكن شراء باقة فارغة');policy=await loadPolicy(tx,pack,now,opts.policyOverrides);packageSnapshots.push({cartLineId:entry.id,id:pack.id,version:pack.version,body:pack.body,pricingPolicy:policyView(policy),items,...(omittedUnavailable.length?{omittedUnavailable}:{})});
  }else selected=[{offerId:entry.offerId,quantity:entry.quantity,durationMinutes:entry.durationMinutes,offsetMinutes:0,itemKey:entry.id,options:entry.options,fields:entry.fields}];
  if(lines.length+selected.length>100)throw new HttpError(400,'الحد الأقصى 100 عنصر تنفيذ في الطلب');
  let expanded:any[]=[];for(const selection of selected){
   const {offer,service,effective}=await activeOffer(tx,selection.offerId);if(pack&&service.ownerId!==pack.ownerId&&!offer.body.allowPackages)throw new HttpError(409,'سحب مقدم الخدمة إذن الإدراج في الباقة');
   // a digital service is delivered online: it is not tied to the city's coverage (an explicit availability policy can still restrict it)
   if(service.body.kind!=='DIGITAL'){if(!service.body.cities.includes(entry.cityId))throw new HttpError(409,'أحد عناصر السلة لا يغطي المدينة');await requireGeo('feature:commerce',entry.cityId,tx);await requireGeo('category:'+service.body.categoryId,entry.cityId,tx);if(service.sourceId)await requireGeo('item:'+service.sourceId,entry.cityId,tx);}
   await assertBookable(tx,{offeringId:selection.offerId,cityId:entry.cityId,date:entry.date||null,time:entry.time||null,quantity:selection.quantity,intent:'BOOK',packageId:pack?.id??null,noLock:true,waiveLeadTime:true});
   const requiresBooking=['BOOKABLE','FIELD'].includes(service.body.kind);if(requiresBooking&&(!entry.date||!entry.time))throw new HttpError(400,'حدد تاريخ ووقت '+service.body.titleAr);
   // the minimum notice (server-side, whatever the screen allowed); an approved exception for this very offer, date and time excuses it and adds its agreed fee
   let exceptionFee=0;if(requiresBooking&&!opts.waiveNotice){const w=await assertNotice(tx,{offerId:selection.offerId,cityId:entry.cityId,date:entry.date,time:entry.time,offsetMinutes:selection.offsetMinutes||0,customerId:opts.userId,exceptionId:entry.exceptionId,kind:'NOTICE',effective});if(w.waived){const agreed=await acceptedOffer(tx,w.exception.id);if(!agreed)throw new HttpError(409,'لا يوجد عرض معتمد لهذا الاستثناء');waivers.set(entry.id,agreed);if(w.exception.offerId===selection.offerId&&!feeApplied.has(entry.id)){exceptionFee=Math.max(0,agreed.exceptionFee-agreed.discount);feeApplied.add(entry.id);}}}
   let priced;try{priced=offerPrice({...offer.body,policy:exceptionFee?{...effective.policy,fees:[...effective.policy.fees,{nameAr:'رسوم الاستثناء',amount:exceptionFee}]}:effective.policy},{...entry,...selection});}catch(e:any){throw new HttpError(400,e.message);}
   expanded.push({cartLineId:entry.id,packageId:pack?.id??null,packageVersion:pack?.version??null,serviceId:service.id,offerId:offer.id,offerVersion:offer.version,serviceVersion:service.version,titleAr:service.body.titleAr,offerNameAr:offer.body.nameAr,requiresBooking,selection:{...entry,...selection},price:{...priced,offerDiscount:priced.discount},vendorId:service.vendorId??null,policy:priced.policy,service:service.body,offer:offer.body,managers:effective.offering.managerIds,shares:effective.offering.shares,resourceKeys:effective.resourceKeys,people:effective.people.map((p:any)=>({id:p.id,nameAr:p.body.nameAr,managementAr:p.body.managementAr,bookingTermsAr:p.body.bookingTermsAr})),sourceId:service.sourceId});
  }
  // the package's own pricing policy (fixed price, percentage, fixed amount, tiers or plain sum) is applied to its components by the pricing engine
  if(pack){let adjusted;try{adjusted=applyPackagePolicy(expanded,policy,entry.quantity);}catch(e:any){throw new HttpError(400,e.message);}
   if(pack.body.budgetMax&&adjusted.lines.reduce((n:number,l:any)=>n+l.price.total,0)>pack.body.budgetMax)throw new HttpError(409,'التخصيص يتجاوز ميزانية الباقة');
   entries.push({entryId:entry.id,packageId:pack.id,policy,quantity:entry.quantity,standalone:expanded.map((l:any)=>({...l,price:{...l.price,standaloneSubtotal:l.price.subtotal}})),packaged:adjusted.lines,savings:adjusted.adjustments.reduce((n:number,a:any)=>n+a.amount,0),adjustments:adjusted.adjustments});lines.push(...adjusted.lines);}
  else{entries.push({entryId:entry.id,packageId:null,policy:null,quantity:entry.quantity,standalone:expanded,packaged:expanded,savings:0,adjustments:[]});lines.push(...expanded);}
 }
 if(lines.length){const required=await tx.$queryRaw<any[]>`SELECT * FROM "CommerceRelationship" WHERE "kind"='REQUIRED'`;for(const relation of required)if(relation.body.enabled&&lines.some(l=>l.serviceId===relation.serviceId)&&!lines.some(l=>l.serviceId===relation.relatedServiceId))throw new HttpError(400,'يلزم إضافة الخدمة المطلوبة المرتبطة قبل متابعة الشراء');}
 // promotions and discount rules: eligibility, stacking and funding are decided by the engine, deterministically
 const codes=(opts.promoCodes??[]).slice(0,3),rules=[...await loadRules(tx,codes),...(opts.extraRules??[])];
 const result=calculate(entries,rules,{now,customerId:opts.userId??null,completedOrders:await orderCount(tx,opts.userId??null),promoCodes:codes,usage:await usageMap(tx,rules.map(r=>r.id),opts.userId??null)});
 for(const code of codes)if(!rules.some(r=>r.code&&r.code.toUpperCase()===code.trim().toUpperCase()))result.quote.rejected.push({ruleId:null,name:code,code:'UNKNOWN_CODE',reasonAr:'رمز ترويجي غير صحيح'});
 lines.splice(0,lines.length,...result.lines);
 // the customer never pays more than the price they approved for an exception; promotions can only lower it
 for(const [entryId,agreed] of Array.from(waivers.entries())){const paid=lines.filter((l:any)=>l.cartLineId===entryId).reduce((n:number,l:any)=>n+l.price.total,0);if(paid>agreed.total)throw new HttpError(409,'تغير السعر عن العرض المعتمد للاستثناء؛ يلزم عرض جديد',{code:'EXCEPTION_PRICE_CHANGED'});}
 const sum=(key:string)=>amount(lines.reduce((n,l)=>n+l.price[key],0)),totals={subtotal:sum('subtotal'),tax:sum('tax'),fees:sum('fees'),discount:sum('discount'),total:sum('total'),deposit:sum('deposit'),needsQuote:lines.some(l=>l.price.needsQuote),currency:'SAR',unit:'HALALA'};
 const hash=createHash('sha256').update(JSON.stringify(stable({lines,packageSnapshots,totals,pricing:{mode:result.quote.mode,discounts:result.quote.discounts.map(d=>({r:d.ruleId,v:d.ruleVersion,a:d.amount}))}}))).digest('hex');return {lines,packageSnapshots,totals,hash,pricing:result.quote,publicPricing:publicPricing(result.quote,rules,codes)};
}
export function publicQuote(q:any){return {...q,pricing:q.publicPricing,publicPricing:undefined,lines:q.lines.map((l:any)=>({...l,sourceId:undefined,managers:undefined,shares:undefined,resourceKeys:undefined,service:{...l.service,managerIds:undefined,resourceIds:undefined},offer:{...l.offer,managerIds:undefined,shares:undefined,policy:{...l.policy,commissionBps:0}},policy:{...l.policy,commissionBps:0},price:{...l.price,commission:undefined,policy:undefined}}))};}
export async function getCart(){
 const user=await requireUser();
 // price changes are looked for whenever the customer opens the cart, so a higher price is never first met at payment
 await detectPriceChanges(user.id).catch(()=>{});
 return atomic(async tx=>{
  const row=(await tx.$queryRaw<any[]>`SELECT * FROM "CommerceCart" WHERE "userId"=${user.id}`)[0]??{body:{lines:[]},version:0};
  let quote=null,error='';
  try{quote=publicQuote(await quoteLines(tx,activeLines(row.body.lines),quoteOptionsFor(user.id,row.body)));}catch(e){if(!(e instanceof HttpError))throw e;error=e.message;}
  // saved-for-later items keep their choices; each is priced on its own so the customer can see whether it is still available
  const saved:any[]=[];
  for(const line of savedLines(row.body.lines)){try{saved.push({line,quote:publicQuote(await quoteLines(tx,[line],{userId:user.id}))});}catch(e){if(!(e instanceof HttpError))throw e;saved.push({line,error:e.message});}}
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
  const promo=input.promoCodes!==undefined?parsePromoCodes(input.promoCodes):cartPromoCodes(previous?.body);
  const quote=await quoteLines(tx,activeLines(lines),{userId:user.id,promoCodes:promo});
  const lang=locale==='en'?'en':'ar';
  await tx.$executeRaw`INSERT INTO "CommerceCart" ("userId","body","locale","lastActivityAt") VALUES (${user.id},${JSON.stringify(cartBody(previous?.body,lines,promo))}::jsonb,${lang},CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "body"=EXCLUDED."body","locale"=EXCLUDED."locale","lastActivityAt"=CURRENT_TIMESTAMP,"version"="CommerceCart"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
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
  if(!saved)await quoteLines(tx,activeLines(lines),quoteOptionsFor(user.id,cart.body));
  await tx.$executeRaw`UPDATE "CommerceCart" SET "body"=${JSON.stringify(cartBody(cart.body,lines))}::jsonb,"version"="version"+1,"lastActivityAt"=CURRENT_TIMESTAMP,"locale"=${locale==='en'?'en':'ar'},"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id}`;
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
