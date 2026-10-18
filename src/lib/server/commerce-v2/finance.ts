import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireAdmin,rateLimit } from '../auth';
import { HttpError,text } from '../http';
import { mediaUrl } from '../catalog';
import { atomic,lock,requestRow,saveRequest } from '../booking/repository';
import { orderRow,orderLines,lineData,orderView } from './orders';
import {notifyOrder} from './notifications';
import { amount,nextState,settlement,settlementBasis } from '@/lib/booking/engine';
export async function financeAction(input:any){
 const user=await requireAdmin();await rateLimit('commerce-finance:'+user.id,120);return atomic(async tx=>{
 const id=text(input.id,140,true);await lock(tx,'commerce-order:'+id);let order=await orderRow(tx,id);if(order.version!==input.version)throw new HttpError(409,'تغير الطلب');const lines=await orderLines(tx,id),entries=await tx.$queryRaw<any[]>`SELECT * FROM "CommerceTransfer" WHERE "orderId"=${id}`;const action=text(input.action,30,true),noteAr=text(input.noteAr,2000,true);
 const allocated=(lineId:string,kind:string,status:string,recipientId?:string)=>entries.filter(e=>e.kind===kind&&e.status===status).flatMap(e=>e.body.allocations).filter((a:any)=>a.itemId===lineId&&(!recipientId||a.recipientId===recipientId)).reduce((n:number,a:any)=>n+a.amount,0);
 if(action==='RECORD'){
 const kind=text(input.kind,30,true),reference=text(input.reference,160,true),value=amount(input.amount),evidenceUrl=mediaUrl(input.evidenceUrl);if(!['PAYMENT','REFUND','PAYOUT'].includes(kind)||!value||!evidenceUrl||!/^[\w:/-]{6,160}$/.test(reference))throw new HttpError(400,'عملية غير صالحة');await lock(tx,'finance-reference:'+reference);
 const duplicate=await tx.$queryRaw<any[]>`SELECT "id" FROM "CommerceTransfer" WHERE "reference"=${reference} UNION ALL SELECT "id" FROM "ServiceFinanceEntry" WHERE "reference"=${reference}`;if(duplicate.length)throw new HttpError(409,'مرجع التحويل مسجل مسبقاً');
 let remaining=value;const allocations:any[]=[];const recipientId=kind==='PAYOUT'?text(input.recipientId,100,true):order.customerId;
 for(const phase of kind==='PAYMENT'?['DEPOSIT','BALANCE']:['BALANCE'])for(const line of lines){if(!remaining)break;if(input.itemId&&line.id!==input.itemId)continue;const d=lineData(line);let available=0;
 if(kind==='PAYMENT'){
  if(d.price.needsQuote||!d.customerAccepted||d.policy.bookingMode!=='DIRECT'&&d.approvals.length!==d.managerIds.length||['CANCELLED','CANCELLATION_REQUESTED','DISPUTED','EXPIRED','REJECTED','CLOSED'].includes(d.status))continue;
  const pending=allocated(line.id,kind,'PENDING')+allocations.filter(a=>a.itemId===line.id).reduce((n,a)=>n+a.amount,0),ceiling=phase==='DEPOSIT'?d.price.deposit:d.price.total;available=Math.max(0,ceiling-d.paid-pending);
 }else if(kind==='REFUND'){
  if(d.status!=='CANCELLED'||allocated(line.id,'PAYOUT','PENDING')+allocated(line.id,'PAYOUT','VERIFIED')>0)continue;available=Math.max(0,(d.refundEntitlement??0)-d.refunded-allocated(line.id,kind,'PENDING'));
 }else{
  const shares=d.shares,index=shares.findIndex((s:any)=>s.managerId===recipientId);if(index<0)continue;const net=settlementBasis(d).providerNet,share=index===shares.length-1?net-shares.slice(0,index).reduce((n:number,s:any)=>n+Math.floor(net*s.bps/10000),0):Math.floor(net*shares[index].bps/10000);try{const totalAvailable=settlement(d,allocated(line.id,kind,'VERIFIED')+allocated(line.id,kind,'PENDING'));available=Math.min(totalAvailable,share-allocated(line.id,kind,'VERIFIED',recipientId)-allocated(line.id,kind,'PENDING',recipientId));}catch{continue;}
 }
 const part=Math.min(remaining,Math.max(0,available));if(part){const prior=allocations.find(a=>a.itemId===line.id);if(prior)prior.amount+=part;else allocations.push({itemId:line.id,amount:part,recipientId});remaining-=part;}
 }
 if(remaining)throw new HttpError(409,'المبلغ يتجاوز الاستحقاق أو لم تستوف الشروط لكل العناصر');await tx.$executeRaw`INSERT INTO "CommerceTransfer" ("id","orderId","kind","amount","reference","makerId","body") VALUES (${randomUUID()},${id},${kind},${value},${reference},${user.id},${JSON.stringify({allocations,evidenceUrl,noteAr,method:'MANUAL_BANK_RECONCILIATION',currency:'SAR',unit:'HALALA'})}::jsonb)`;
 }else if(action==='VERIFY'||action==='VOID'){
 const entry=entries.find(e=>e.id===input.entryId);if(!entry||entry.status!=='PENDING')throw new HttpError(409,'العملية غير متاحة للمراجعة');if(entry.makerId===user.id)throw new HttpError(403,'يلزم إداري مستقل للمراجعة');
 if(action==='VERIFY')for(const allocation of entry.body.allocations){const line=lines.find(l=>l.id===allocation.itemId);if(!line)throw new HttpError(409,'العنصر غير موجود');const d={...lineData(line)};if(entry.kind==='PAYMENT'){if(['CANCELLED','CANCELLATION_REQUESTED','DISPUTED','EXPIRED','REJECTED','CLOSED'].includes(d.status)||d.paid+allocation.amount>d.price.total)throw new HttpError(409,'راجع تحصيل العنصر');d.paid+=allocation.amount;}else if(entry.kind==='REFUND'){if(d.status!=='CANCELLED'||allocation.amount>(d.refundEntitlement??0)-d.refunded)throw new HttpError(409,'راجع استحقاق الاسترداد');d.refunded+=allocation.amount;}else{try{if(allocation.amount>settlement(d,allocated(line.id,'PAYOUT','VERIFIED')))throw Error();}catch{throw new HttpError(409,'التسوية محجوزة');}}
 if(!['CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','DISPUTED','CLOSED','CANCELLATION_REQUESTED','RESCHEDULE_REQUESTED'].includes(d.status))d.status=nextState({...d,availabilityChecked:line.bookingId?d.availabilityChecked:true});if(!line.bookingId&&d.status==='READY_TO_CONFIRM')d.status='CONFIRMED';
 if(line.bookingId){const request=await requestRow(tx,line.requestId,true);await saveRequest(tx,request,d,d.status);}else await tx.$executeRaw`UPDATE "CommerceOrderItem" SET "body"=${JSON.stringify(d)}::jsonb,"version"="version"+1 WHERE "id"=${line.id}`;
 }
 await tx.$executeRaw`UPDATE "CommerceTransfer" SET "status"=${action==='VERIFY'?'VERIFIED':'VOID'},"checkerId"=${user.id},"body"="body" || ${JSON.stringify({reviewNoteAr:noteAr,reviewedAt:new Date().toISOString()})}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${entry.id}`;
 }else throw new HttpError(400,'إجراء مالي غير صالح');
 await tx.$executeRaw`UPDATE "CommerceOrder" SET "version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`;await tx.systemAuditLog.create({data:{actorId:user.id,action:'COMMERCE_FINANCE_'+action,targetId:id,details:{entryId:input.entryId??null,kind:input.kind??null,noteAr}}});order=await orderRow(tx,id);await notifyOrder(tx,order,'FINANCE_'+action);return orderView(tx,order,user);
 });
}
