import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireAdmin,rateLimit } from '../auth';
import { HttpError,text } from '../http';
import { mediaUrl } from '../catalog';
import { amount,nextState,settlement,settlementBasis } from '@/lib/booking/engine';
import { atomic,requestRow,saveRequest,view,lock } from './repository';
import { event } from './requests';
export async function listFinance(id:string){await requireAdmin();return {entries:await prisma.$queryRaw<any[]>`SELECT * FROM "ServiceFinanceEntry" WHERE "requestId"=${id} ORDER BY "createdAt" DESC`};}
export async function recordFinance(input:any){
 const user=await requireAdmin();await rateLimit('booking-finance:'+user.id,100);const id=text(input.id,100,true),action=text(input.action,30,true);
 return atomic(async tx=>{
  let row=await requestRow(tx,id,true);if(input.version!==row.version)throw new HttpError(409,'تغيّر الطلب؛ أعد التحميل');const data={...row.body};
  const entries=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceFinanceEntry" WHERE "requestId"=${id}`;
  const sum=(kind:string,status='VERIFIED',recipient?:string)=>entries.filter(e=>e.kind===kind&&e.status===status&&(!recipient||e.body.recipientId===recipient)).reduce((s,e)=>s+e.amount,0);
  if(action==='RECORD'){
   const kind=text(input.kind,30,true),reference=text(input.reference,160,true),noteAr=text(input.noteAr,2000,true),evidenceUrl=mediaUrl(input.evidenceUrl);let value;try{value=amount(input.amount);}catch(e:any){throw new HttpError(400,e.message);}if(!value||!evidenceUrl||!['PAYMENT','REFUND','PAYOUT'].includes(kind))throw new HttpError(400,'أدخل نوع العملية ومبلغها وإثبات التحويل البنكي');
   if(!/^[A-Za-z0-9:_/-]{6,160}$/.test(reference))throw new HttpError(400,'مرجع التحويل غير صالح');
   await lock(tx,'finance-reference:'+reference);
   const prior=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceFinanceEntry" WHERE "reference"=${reference}`;
   if(prior.length){if(prior[0].requestId!==id||prior[0].amount!==value||prior[0].kind!==kind||prior[0].makerId!==user.id)throw new HttpError(409,'مرجع التحويل مسجل لعملية أخرى');return view(row,user);}
   const recipientId=kind==='PAYOUT'?text(input.recipientId,100,true):row.customerId;
   if(kind==='PAYMENT'){
    if(!['PAYMENT_PENDING','READY_TO_CONFIRM','CONFIRMED','IN_PROGRESS','COMPLETED'].includes(row.status)||data.price.needsQuote||!data.customerAccepted)throw new HttpError(409,'الطلب غير جاهز للتحصيل');
    if(value+data.paid+sum('PAYMENT','PENDING')>data.price.total)throw new HttpError(409,'التحصيل يتجاوز إجمالي الطلب');
   }else if(kind==='REFUND'){
    if(row.status!=='CANCELLED'||value+sum('REFUND','PENDING')>Math.max(0,(data.refundEntitlement??0)-data.refunded))throw new HttpError(409,'الاسترداد يتجاوز الاستحقاق المعتمد أو لم يعتمد الإلغاء');
    if(sum('PAYOUT')+sum('PAYOUT','PENDING')>0)throw new HttpError(409,'يلزم استرداد مستحق المورد ومطابقته قبل رد مبلغ العميل');
   }else{
    const share=data.shares.find((s:any)=>s.managerId===recipientId);if(!share)throw new HttpError(400,'المستفيد غير مرتبط بالعقد');
    let available;try{available=settlement(data,sum('PAYOUT')+sum('PAYOUT','PENDING'));}catch(e:any){throw new HttpError(409,e.message);}
    // Deterministic remainder assigned to the last participant, so joint settlements sum exactly.
    const net=settlementBasis(data).providerNet,index=data.shares.indexOf(share),entitlement=index===data.shares.length-1?net-data.shares.slice(0,index).reduce((n:number,s:any)=>n+Math.floor(net*s.bps/10000),0):Math.floor(net*share.bps/10000);
    if(value>available||value+sum('PAYOUT','VERIFIED',recipientId)+sum('PAYOUT','PENDING',recipientId)>entitlement)throw new HttpError(409,'التحويل يتجاوز صافي استحقاق الجهة');
   }
   await tx.$executeRaw`INSERT INTO "ServiceFinanceEntry" ("id","requestId","kind","amount","reference","makerId","body") VALUES (${randomUUID()},${id},${kind},${value},${reference},${user.id},${JSON.stringify({recipientId,noteAr,evidenceUrl,currency:'SAR',unit:'HALALA',method:'MANUAL_BANK_RECONCILIATION'})}::jsonb)`;
  }else if(action==='VERIFY'||action==='VOID'){
   const entry=entries.find(e=>e.id===input.entryId);if(!entry||entry.status!=='PENDING')throw new HttpError(409,'السجل غير موجود أو تمت مراجعته');if(entry.makerId===user.id)throw new HttpError(403,'يجب أن يراجع التحويل إداري آخر مستقل');
   const noteAr=text(input.noteAr,2000,true);
   if(action==='VERIFY'){
    if(entry.kind==='PAYMENT'){if(['CANCELLED','REJECTED','EXPIRED','CLOSED','DISPUTED','CANCELLATION_REQUESTED'].includes(row.status)||data.paid+entry.amount>data.price.total)throw new HttpError(409,'تغيّرت حالة الطلب؛ أوقف العملية وراجع التحصيل');data.paid+=entry.amount;}
    if(entry.kind==='REFUND'){if(row.status!=='CANCELLED'||entry.amount>Math.max(0,(data.refundEntitlement??0)-data.refunded))throw new HttpError(409,'الاسترداد غير مستحق');data.refunded+=entry.amount;}
    if(entry.kind==='PAYOUT'){try{settlement(data,sum('PAYOUT'));}catch(e:any){throw new HttpError(409,e.message);}}
   }
   await tx.$executeRaw`UPDATE "ServiceFinanceEntry" SET "status"=${action==='VERIFY'?'VERIFIED':'VOID'},"checkerId"=${user.id},"updatedAt"=CURRENT_TIMESTAMP,"body"="body" || ${JSON.stringify({reviewNoteAr:noteAr,reviewedAt:new Date().toISOString()})}::jsonb WHERE "id"=${entry.id}`;
  }else throw new HttpError(400,'إجراء مالي غير صالح');
  const status=['PAYMENT_PENDING','READY_TO_CONFIRM','APPROVAL_PENDING'].includes(row.status)?nextState(data):row.status;
  const before=row.status;row=await saveRequest(tx,row,data,status);await event(tx,row,user.id,'FINANCE_'+action,before,{entryId:input.entryId??null,kind:input.kind??null});return view(row,user);
 });
}
