import 'server-only';
import { createHash,randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser,rateLimit } from '../auth';
import { HttpError,text } from '../http';
import { requireFeature } from '../features';
import { requireGeo } from '../geo/context';
import { price,interval,checkCalendar,nextState,refundLimit,states,settlementBasis } from '@/lib/booking/engine';
import { bookingInterval,overlaps } from '@/lib/oms/pricing';
import { effectiveOffering } from './config';
import { atomic,Tx,lock,requestRow,saveRequest,canRead,canManage,admin,view } from './repository';

const finalStates=['CANCELLED','REJECTED','EXPIRED','CLOSED'];
export async function event(tx:Tx,row:any,actorId:string,action:string,before:string,details:any={}){
 await tx.$executeRaw`INSERT INTO "ServiceRequestEvent" ("id","requestId","actorId","action","body") VALUES (${randomUUID()},${row.id},${actorId},${action},${JSON.stringify({from:before,to:row.status,...details})}::jsonb)`;
 const admins=await tx.user.findMany({where:{isActive:true,role:{in:['ADMIN','SUPER_ADMIN']}},select:{id:true}});
 for(const userId of Array.from(new Set<string>([row.customerId,...row.body.managerIds,...admins.map(a=>a.id)]))){
  const ev=action+':'+row.version;
  await tx.$executeRaw`INSERT INTO "ServiceInbox" ("id","userId","requestId","event","body") VALUES (${randomUUID()},${userId},${row.id},${ev},${JSON.stringify({titleAr:row.body.titleAr,status:row.status,statusAr:states[row.status],action})}::jsonb) ON CONFLICT ("userId","requestId","event") DO NOTHING`;
 }
}
export async function calendarAndConflict(tx:Tx,data:any,requestId:string,reserve=false,expiresAt:Date|null=null){
 const effective=await effectiveOffering(tx,data.offeringId),start=new Date(data.startAt),end=new Date(data.endAt);
 await requireGeo('feature:commerce',data.cityId,tx);await requireGeo('category:'+effective.offering.categoryId,data.cityId,tx);
 if(effective.service)await requireGeo('item:'+effective.service.id,data.cityId,tx);
 if(!effective.offering.cities.includes(data.cityId))throw new HttpError(409,'الخدمة غير متاحة في المدينة');
 // Authorizations and resource identities are snapshotted; changing them requires a new request.
 if(JSON.stringify(effective.offering.managerIds)!==JSON.stringify(data.managerIds)||JSON.stringify(effective.resourceKeys)!==JSON.stringify(data.resourceKeys))throw new HttpError(409,'تغيّر المنفذ أو جهة التأكيد؛ يلزم طلب جديد');
 try{checkCalendar(data.policy.calendar,start,end);checkCalendar(effective.policy.calendar,start,end);for(const person of effective.people)checkCalendar(person.body.calendar,start,end);}catch(e:any){throw new HttpError(409,e.message);}
 for(const availability of [effective.service?.availability,effective.vendor?.availability]){if(!availability)continue;const c={...data.policy.calendar,workingDays:availability.workingDays,blackoutDates:availability.blackoutDates,minNoticeHours:availability.minNoticeDays*24,maxAdvanceDays:availability.maxAdvanceDays};try{checkCalendar(c,start,end);}catch(e:any){throw new HttpError(409,e.message);}}
 for(const resource of data.resourceKeys as string[])await lock(tx,resource);
 const buffer=Math.max(data.policy.calendar.bufferMinutes,effective.policy.calendar.bufferMinutes,...effective.people.map((p:any)=>p.body.calendar.bufferMinutes));
 const heldStart=new Date(+start-buffer*60000),heldEnd=new Date(+end+buffer*60000);
 for(const resource of data.resourceKeys as string[]){const conflicts=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceReservation" WHERE "resourceKey"=${resource} AND "active"=true AND ("expiresAt" IS NULL OR "expiresAt">CURRENT_TIMESTAMP) AND "requestId"<>${requestId} AND "startAt"<${heldEnd} AND "endAt">${heldStart}`;
 const person=effective.people.find((p:any)=>resource===(p.body.artistId?'artist:'+p.body.artistId:'person:'+p.id)),capacity=person?.body.capacity??((resource.startsWith('service:')||resource.startsWith('offering:'))&&effective.people.length?Math.min(...effective.people.map((p:any)=>p.body.capacity??1)):1),units=data.resourceQuantity??1;
 const points=[{at:+heldStart,delta:units},{at:+heldEnd,delta:-units},...conflicts.flatMap(c=>[{at:Math.max(+heldStart,+new Date(c.startAt)),delta:c.quantity??1},{at:Math.min(+heldEnd,+new Date(c.endAt)),delta:-(c.quantity??1)}])].sort((a,b)=>a.at-b.at||a.delta-b.delta);let allocated=0;for(const p of points){allocated+=p.delta;if(allocated>capacity)throw new HttpError(409,'الموعد يتعارض مع حجز أو يتجاوز سعة المورد');}}
 // One availability domain with historical OMS orders; old records remain authoritative.
 if(effective.vendor||effective.people.some((p:any)=>p.body.artistId)){
 const artistIds=effective.people.map((p:any)=>p.body.artistId).filter(Boolean);
 const old=await tx.orderItem.findMany({where:{OR:[...(effective.vendor?[{suborder:{vendorId:effective.vendor.id}}]:[]),...(artistIds.length?[{service:{artistId:{in:artistIds}}}]:[])],suborder:{omsStatus:{in:['ACCEPTED','IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED','CUSTOMER_REVIEW','PAUSED','AWAITING_CUSTOMER_INFO','EXTENSION_REQUESTED','MODIFICATION_REQUESTED','DISPUTED','CANCEL_REQUESTED']}}},include:{service:{include:{packages:true}}}});
 for(const item of old){try{const other=bookingInterval(item.scheduledDate,item.scheduledTime||'',Math.max(item.service.executionDurationHours,item.service.packages.find(p=>p.id===item.packageId)?.durationHours??0));if(overlaps({start:+heldStart,end:+heldEnd},other))throw new HttpError(409,'يوجد حجز سابق متعارض لدى مقدم الخدمة');}catch(e){if(e instanceof HttpError)throw e;if(item.scheduledDate===data.date)throw new HttpError(409,'موعد حجز سابق يحتاج إلى مراجعة');}}
 }
 if(reserve)for(const resource of data.resourceKeys as string[])await tx.$executeRaw`INSERT INTO "ServiceReservation" ("id","requestId","resourceKey","startAt","endAt","active","quantity","expiresAt") VALUES (${randomUUID()},${requestId},${resource},${heldStart},${heldEnd},true,${data.resourceQuantity??1},${expiresAt}) ON CONFLICT ("requestId","resourceKey") DO UPDATE SET "startAt"=EXCLUDED."startAt","endAt"=EXCLUDED."endAt","active"=true,"quantity"=EXCLUDED."quantity","expiresAt"=EXCLUDED."expiresAt"`;
}
async function reminders(tx:Tx,row:any){
 const data=row.body;for(const userId of Array.from(new Set<string>([row.customerId,...data.managerIds]))){
 const dueAt=new Date(Math.max(Date.now(),+new Date(data.startAt)-data.policy.reminderHours*3600000));
 await tx.$executeRaw`INSERT INTO "ServiceInbox" ("id","userId","requestId","event","dueAt","body") VALUES (${randomUUID()},${userId},${row.id},'APPOINTMENT_REMINDER',${dueAt},${JSON.stringify({titleAr:data.titleAr,date:data.date,time:data.time})}::jsonb) ON CONFLICT ("userId","requestId","event") DO UPDATE SET "dueAt"=EXCLUDED."dueAt","body"=EXCLUDED."body","readAt"=NULL`;
 }
 let requiredCumulative=data.price.deposit;for(const [i,m]of data.price.milestones.entries()){requiredCumulative=Math.min(data.price.total,requiredCumulative+m.amount);const dueAt=new Date(+new Date(data.startAt)-m.beforeHours*3600000);await tx.$executeRaw`INSERT INTO "ServiceInbox" ("id","userId","requestId","event","dueAt","body") VALUES (${randomUUID()},${row.customerId},${row.id},${'PAYMENT_REMINDER:'+i},${dueAt},${JSON.stringify({titleAr:m.nameAr,amount:m.amount,requiredCumulative,currency:'SAR',unit:'HALALA'})}::jsonb) ON CONFLICT ("userId","requestId","event") DO UPDATE SET "dueAt"=EXCLUDED."dueAt","body"=EXCLUDED."body","readAt"=NULL`;}
}
export async function createRequest(input:any){
 const user=await requireUser();await rateLimit('booking-create:'+user.id,60);await requireFeature('commerce');
 const offeringId=text(input.offeringId,140,true),key=text(input.idempotencyKey,128,true);if(!/^[-\w]{16,128}$/.test(key)||input.acceptTerms!==true)throw new HttpError(400,'يلزم قبول الشروط ومفتاح إعادة محاولة صالح');
 const canonical={offeringId,date:text(input.date,10,true),time:text(input.time,5,true),cityId:text(input.cityId,100,true),durationMinutes:input.durationMinutes,guestCount:input.guestCount,packageId:text(input.packageId,100),fields:input.fields||{},options:input.options??[],notes:text(input.notes,2000),acceptTerms:true};
 const hash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),scopedKey=user.id+':'+key;
 return atomic(async tx=>{
  await lock(tx,'booking-idempotency:'+scopedKey);const previous=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceRequest" WHERE "idempotencyKey"=${scopedKey}`;
  if(previous.length){if(previous[0].requestHash!==hash)throw new HttpError(409,'مفتاح الطلب مستخدم لبيانات مختلفة');return view(previous[0],user);}
  const effective=await effectiveOffering(tx,offeringId),{offering,policy}=effective;if(offering.commerceServiceId)throw new HttpError(409,'اختر عرض الشراء من صفحة الخدمة وأضفه للسلة لإنشاء طلب تجاري أولاً');
  if(!offering.cities.includes(canonical.cityId))throw new HttpError(409,'الخدمة لا تغطي هذه المدينة');
  let priced,range;try{priced=price(policy,canonical);range=interval(canonical.date,canonical.time,priced.durationMinutes);}catch(e:any){throw new HttpError(400,e.message);}
  if(!canonical.fields||typeof canonical.fields!=='object'||Array.isArray(canonical.fields)||JSON.stringify(canonical.fields).length>20000)throw new HttpError(400,'حقول الطلب غير صالحة');
  const fields:Record<string,any>={};for(const f of policy.requiredFields){const v=canonical.fields[f.key];if(typeof v!==(f.type==='text'?'string':f.type)||(f.type==='text'&&(!v.trim()||v.length>2000))||(f.type==='number'&&(!Number.isFinite(v)||v<0))||(f.type==='boolean'&&!v))throw new HttpError(400,'أكمل الحقل: '+f.labelAr);fields[f.key]=v;}
  const managers=await tx.user.findMany({where:{id:{in:offering.managerIds}},select:{id:true,name:true,vendorProfile:{select:{businessName:true}}}});
  const id=randomUUID(),data:any={...canonical,fields,titleAr:offering.titleAr,descriptionAr:offering.descriptionAr,categoryId:offering.categoryId,deliveryModel:offering.deliveryModel,managerIds:offering.managerIds,managers:managers.map(m=>({id:m.id,nameAr:m.vendorProfile?.businessName??m.name})),resourceKeys:effective.resourceKeys,people:effective.people.map((p:any)=>({id:p.id,nameAr:p.body.nameAr,managementAr:p.body.managementAr,bookingTermsAr:p.body.bookingTermsAr})),shares:offering.shares,policy,configurationVersion:effective.version,price:priced,startAt:range.start.toISOString(),endAt:range.end.toISOString(),availabilityChecked:false,customerAccepted:!priced.needsQuote,approvals:[],paid:0,refunded:0,expiresAt:new Date(Math.min(+range.start,Date.now()+policy.requestExpiryHours*3600000)).toISOString()};
  await calendarAndConflict(tx,data,id);data.availabilityChecked=policy.bookingMode==='DIRECT';const status=nextState(data);data.status=status;
  await tx.$executeRaw`INSERT INTO "ServiceRequest" ("id","customerId","offeringId","status","cityId","startAt","endAt","body","idempotencyKey","requestHash") VALUES (${id},${user.id},${offeringId},${status},${data.cityId},${range.start},${range.end},${JSON.stringify(data)}::jsonb,${scopedKey},${hash})`;
  const row=await requestRow(tx,id);await event(tx,row,user.id,'CREATE','REQUESTED');return view(row,user);
 });
}
export async function listRequests(search:URLSearchParams){
 const user=await requireUser();const status=text(search.get('status'),60),city=text(search.get('cityId'),100),offering=text(search.get('offeringId'),140),provider=text(search.get('managerId'),100),date=text(search.get('date'),10);
 if(status&&!states[status]||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new HttpError(400,'مرشح غير صالح');
 const rows=await prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM "ServiceRequest" WHERE (${admin(user)} OR "customerId"=${user.id} OR "body"->'managerIds' ? ${user.id}) ${status?Prisma.sql`AND "status"=${status}`:Prisma.empty} ${city?Prisma.sql`AND "cityId"=${city}`:Prisma.empty} ${offering?Prisma.sql`AND "offeringId"=${offering}`:Prisma.empty} ${provider?Prisma.sql`AND "body"->'managerIds' ? ${provider}`:Prisma.empty} ${date?Prisma.sql`AND "body"->>'date'=${date}`:Prisma.empty} ORDER BY "createdAt" DESC LIMIT 200`);
 const payouts=rows.length?await prisma.$queryRaw<any[]>(Prisma.sql`SELECT "requestId","status","amount","body"->>'recipientId' AS "recipientId" FROM "ServiceFinanceEntry" WHERE "kind"='PAYOUT' AND "requestId" IN (${Prisma.join(rows.map(r=>r.id))})`):[];
 const result=[];for(const row of rows){let providerSettlement:any=null;if(row.body.managerIds.includes(user.id)){const shares=row.body.shares,index=shares.findIndex((s:any)=>s.managerId===user.id),net=settlementBasis(row.body).providerNet,share=shares[index];if(share){const entitlement=index===shares.length-1?net-shares.slice(0,index).reduce((n:number,s:any)=>n+Math.floor(net*s.bps/10000),0):Math.floor(net*share.bps/10000),own=payouts.filter(p=>p.requestId===row.id&&p.recipientId===user.id);providerSettlement={entitlement,paidOut:own.filter(p=>p.status==='VERIFIED').reduce((n,p)=>n+p.amount,0),pending:own.filter(p=>p.status==='PENDING').reduce((n,p)=>n+p.amount,0),holdUntil:row.body.completedAt?new Date(+new Date(row.body.completedAt)+row.body.policy.settlementHoldHours*3600000).toISOString():null};}}
 const events=await prisma.$queryRaw<any[]>`SELECT "id","actorId","action","body","createdAt" FROM "ServiceRequestEvent" WHERE "requestId"=${row.id} ORDER BY "createdAt" DESC LIMIT 30`;result.push({...view(row,user),events,providerSettlement,expired:!['CONFIRMED','IN_PROGRESS','COMPLETED','DISPUTED','RESCHEDULE_REQUESTED','CANCELLATION_REQUESTED',...finalStates].includes(row.status)&&+new Date(row.body.expiresAt)<Date.now(),overdue:row.status==='CONFIRMED'&&+row.endAt<Date.now()});}
 return {requests:result,states,user:{id:user.id,role:user.role},serverTime:new Date().toISOString()};
}
export async function transitionRequestInTx(tx:Tx,user:any,input:any,bundle=false){
 const id=text(input.id,100,true),action=text(input.action,60,true),note=text(input.noteAr,2000);
 let row=await requestRow(tx,id,true);if(!canRead(user,row))throw new HttpError(404,'الطلب غير موجود');if(input.version!==row.version)throw new HttpError(409,'تغيّر الطلب؛ حدّث الصفحة');
 const links=await tx.$queryRaw<any[]>`SELECT i."packageId" FROM "CommerceBooking" b JOIN "CommerceOrderItem" i ON i."id"=b."orderItemId" WHERE b."requestId"=${id}`;if(links.length&&action==='CLOSE')throw new HttpError(409,'أغلق المطابقة المالية من الطلب التجاري');if(links.some(l=>l.packageId)&&action==='CONFIRM'&&!bundle)throw new HttpError(409,'يجب تأكيد عناصر الباقة معاً من الطلب');
 const before=row.status,data={...row.body},manager=canManage(user,data),customer=row.customerId===user.id;
 const requireManager=()=>{if(!manager)throw new HttpError(403,'تحتاج موافقة الجهة المخولة');};
 const requireCustomer=()=>{if(!customer)throw new HttpError(403,'هذه الخطوة تخص العميل');};
 const requireNote=()=>{if(!note)throw new HttpError(400,'اكتب سبب الإجراء');};
 if(finalStates.includes(before)&&!(before==='CANCELLED'&&action==='CLOSE')||before==='COMPLETED'&&action!=='CLOSE'&&action!=='DISPUTE')throw new HttpError(409,'انتهى مسار هذا الطلب');
 const preconfirmation=!['CONFIRMED','IN_PROGRESS','COMPLETED','DISPUTED','RESCHEDULE_REQUESTED','CANCELLATION_REQUESTED'].includes(before);
 if(preconfirmation&&+new Date(data.expiresAt)<=Date.now()&&!['EXPIRE','CANCEL','CLOSE'].includes(action))throw new HttpError(409,'انتهت صلاحية الطلب؛ أنشئ طلباً جديداً');
 let status=before;
 if(['CHECK_AVAILABILITY','QUOTE','ACCEPT_PRICE','APPROVE','CONFIRM'].includes(action)){
  if(!preconfirmation)throw new HttpError(409,'هذه الخطوة متاحة قبل التأكيد فقط');
  await requireGeo('feature:commerce',data.cityId,tx);
  if(action==='CHECK_AVAILABILITY'){requireManager();await calendarAndConflict(tx,data,id);data.availabilityChecked=true;}
  if(action==='QUOTE'){requireManager();if(!data.price.needsQuote&&before!=='CUSTOMER_APPROVAL_PENDING')throw new HttpError(409,'لا يحتاج الطلب إلى عرض سعر');try{data.price=price(data.policy,data,input.amount);}catch(e:any){throw new HttpError(400,e.message);}if(input.amount===undefined||data.price.needsQuote)throw new HttpError(400,'أدخل مبلغ العرض بالهللة');data.customerAccepted=false;data.approvals=[];data.quoteExpiresAt=new Date(Math.min(+new Date(data.expiresAt),Date.now()+data.policy.quoteValidityHours*3600000)).toISOString();}
  if(action==='ACCEPT_PRICE'){requireCustomer();if(data.price.needsQuote||!data.quoteExpiresAt||+new Date(data.quoteExpiresAt)<Date.now())throw new HttpError(409,'عرض السعر غير موجود أو انتهت صلاحيته');data.customerAccepted=true;}
  if(action==='APPROVE'){requireManager();const managerId=admin(user)?text(input.managerId||user.id,100,true):user.id;if(!data.managerIds.includes(managerId))throw new HttpError(403,'جهة التأكيد غير مرتبطة بالطلب');if(!data.customerAccepted||data.price.needsQuote)throw new HttpError(409,'يلزم قبول العميل للسعر');data.approvals=Array.from(new Set([...data.approvals,managerId]));}
  status=nextState(data);
  if(action==='CONFIRM'){if(data.policy.bookingMode==='DIRECT'){if(!manager&&!customer)throw new HttpError(403,'غير مخول');}else if(!(bundle&&customer))requireManager();if(status!=='READY_TO_CONFIRM')throw new HttpError(409,'لم تستوف موافقات التأكيد أو الدفعة المطلوبة');if(data.quoteExpiresAt&&+new Date(data.quoteExpiresAt)<Date.now())throw new HttpError(409,'انتهت صلاحية عرض السعر');await calendarAndConflict(tx,data,id,true);status='CONFIRMED';data.confirmedAt=new Date().toISOString();}
 }else if(action==='START'){requireManager();if(before!=='CONFIRMED'||Date.now()<+new Date(data.startAt))throw new HttpError(409,'يبدأ التنفيذ عند موعد الحجز المؤكد');let required=data.price.deposit;for(const m of data.price.milestones)if(Date.now()>=+new Date(data.startAt)-m.beforeHours*3600000)required+=m.amount;if(data.paid-data.refunded<Math.min(required,data.price.total))throw new HttpError(409,'توجد دفعات مستحقة غير محصلة');status='IN_PROGRESS';
 }else if(action==='COMPLETE'){requireManager();if(before!=='IN_PROGRESS')throw new HttpError(409,'يلزم بدء التنفيذ أولاً');requireNote();data.completionProofAr=note;data.completedAt=new Date().toISOString();status='COMPLETED';
 }else if(action==='REJECT'){requireManager();requireNote();if(!preconfirmation||data.paid>0)throw new HttpError(409,'الطلب المدفوع يحتاج إلى مسار الإلغاء والاسترداد');status='REJECTED';
 }else if(action==='EXPIRE'){if(!preconfirmation||+new Date(data.expiresAt)>Date.now()||data.paid>0)throw new HttpError(409,'لا يمكن إنهاء هذا الطلب تلقائياً');status='EXPIRED';
 }else if(action==='CANCEL'){if(!customer&&!manager)throw new HttpError(403,'غير مخول');requireNote();if(before==='COMPLETED'||before==='DISPUTED'||before==='CANCELLATION_REQUESTED')throw new HttpError(409,'يلزم حل النزاع أولاً');data.cancellationRequestedAt=new Date().toISOString();data.refundEntitlement=refundLimit(data);data.cancellationReasonAr=note;if(data.paid===0&&preconfirmation){status='CANCELLED';data.cancelledAt=new Date().toISOString();}else status='CANCELLATION_REQUESTED';
 }else if(action==='APPROVE_CANCEL'){if(!admin(user))throw new HttpError(403,'يتطلب اعتماد الإدارة');requireNote();if(before!=='CANCELLATION_REQUESTED')throw new HttpError(409,'لا يوجد طلب إلغاء');status='CANCELLED';data.cancelledAt=new Date().toISOString();
 }else if(action==='RESCHEDULE'){requireCustomer();requireNote();if(before!=='CONFIRMED')throw new HttpError(409,'إعادة الجدولة للحجز المؤكد فقط');let range;try{range=interval(text(input.date,10,true),text(input.time,5,true),data.price.durationMinutes);}catch(e:any){throw new HttpError(400,e.message);}const proposal={...data,date:input.date,time:input.time,startAt:range.start.toISOString(),endAt:range.end.toISOString()};await calendarAndConflict(tx,proposal,id);data.reschedule={date:proposal.date,time:proposal.time,startAt:proposal.startAt,endAt:proposal.endAt,approvals:[],requestedAt:new Date().toISOString()};status='RESCHEDULE_REQUESTED';
 }else if(action==='APPROVE_RESCHEDULE'){requireManager();if(before!=='RESCHEDULE_REQUESTED'||!data.reschedule)throw new HttpError(409,'لا يوجد طلب جدولة');const managerId=admin(user)?text(input.managerId||user.id,100,true):user.id;if(!data.managerIds.includes(managerId))throw new HttpError(403,'جهة غير مخولة');data.reschedule.approvals=Array.from(new Set([...data.reschedule.approvals,managerId]));if(data.reschedule.approvals.length===data.managerIds.length){const proposal={...data,...data.reschedule};await calendarAndConflict(tx,proposal,id,true);Object.assign(data,{date:proposal.date,time:proposal.time,startAt:proposal.startAt,endAt:proposal.endAt,reschedule:null});status='CONFIRMED';}
 }else if(action==='WITHDRAW_RESCHEDULE'){requireCustomer();if(before!=='RESCHEDULE_REQUESTED')throw new HttpError(409,'لا يوجد طلب جدولة');data.reschedule=null;status='CONFIRMED';
 }else if(action==='DISPUTE'){if(!customer&&!manager)throw new HttpError(403,'غير مخول');requireNote();if(!['CONFIRMED','IN_PROGRESS','COMPLETED'].includes(before))throw new HttpError(409,'النزاع بعد التأكيد');data.beforeDispute=before;data.disputeReasonAr=note;status='DISPUTED';
 }else if(action==='RESOLVE_DISPUTE'){if(!admin(user))throw new HttpError(403,'تحتاج إدارة المنصة');requireNote();if(before!=='DISPUTED')throw new HttpError(409,'لا يوجد نزاع');status=data.beforeDispute;data.disputeResolutionAr=note;
 }else if(action==='CLOSE'){if(!admin(user)||!['COMPLETED','CANCELLED'].includes(before))throw new HttpError(409,'الإغلاق بعد اكتمال التنفيذ والمراجعة المالية');const pending=await tx.$queryRaw<any[]>`SELECT "id" FROM "ServiceFinanceEntry" WHERE "requestId"=${id} AND "status"='PENDING'`;const sums=await tx.$queryRaw<any[]>`SELECT "kind",SUM("amount")::int AS "amount" FROM "ServiceFinanceEntry" WHERE "requestId"=${id} AND "status"='VERIFIED' GROUP BY "kind"`;const paidOut=sums.filter(s=>s.kind==='PAYOUT').reduce((n,s)=>n+s.amount,0);if(pending.length||(before==='CANCELLED'?data.refunded!==(data.refundEntitlement??0):data.paid-data.refunded!==data.price.total)||paidOut!==settlementBasis(data).providerNet)throw new HttpError(409,'لم تكتمل المطابقة المالية وتسويات جميع الجهات');status='CLOSED';
 }else throw new HttpError(400,'إجراء غير معروف');
 if(finalStates.includes(status)){await tx.$executeRaw`UPDATE "ServiceReservation" SET "active"=false WHERE "requestId"=${id}`;await tx.$executeRaw`DELETE FROM "ServiceInbox" WHERE "requestId"=${id} AND ("event"='APPOINTMENT_REMINDER' OR "event" LIKE 'PAYMENT_REMINDER:%') AND "dueAt">CURRENT_TIMESTAMP`;}
 data.lastNoteAr=note||data.lastNoteAr;row=await saveRequest(tx,row,data,status);await event(tx,row,user.id,action,before,{noteAr:note,...(action==='QUOTE'?{quotedSubtotal:data.price.subtotal,quotedTotal:data.price.total}:{}),...(input.managerId?{onBehalfOf:input.managerId}:{})});if(status==='CONFIRMED')await reminders(tx,row);return view(row,user);

}
export async function transitionRequest(input:any){const user=await requireUser();await rateLimit('booking-action:'+user.id,150);return atomic(tx=>transitionRequestInTx(tx,user,input));}
