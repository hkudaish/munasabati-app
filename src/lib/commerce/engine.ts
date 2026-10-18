import { amount,mergePolicy,price } from '@/lib/booking/engine';
export const relationshipKinds=['COMPLEMENTARY','ALTERNATIVE','REQUIRED','BOUGHT_TOGETHER','UPGRADE'] as const;
export const serviceKinds=['BOOKABLE','FIELD','DIGITAL','PHYSICAL'] as const;
export function offerPrice(body:any,input:any,quote?:number){
 const policy=mergePolicy(body.policy),date=input.date||new Date().toISOString().slice(0,10);
 if(body.validFrom&&Date.now()<Date.parse(body.validFrom)||body.validUntil&&Date.now()>=Date.parse(body.validUntil))throw Error('انتهت صلاحية العرض أو لم تبدأ');
 let base=policy.baseAmount;const season=(body.seasons||[]).find((s:any)=>date>=s.from&&date<=s.until);if(season)base=season.amount;
 if(policy.cityAmounts[input.cityId]!==undefined)base=policy.cityAmounts[input.cityId];
 const quantity=amount(input.quantity??1,10000);if(quantity<(body.minQuantity??1)||quantity>(body.maxQuantity??10000))throw Error('الكمية خارج حدود العرض');
 const model=body.model||policy.pricingMode;
 const normalized=mergePolicy(policy,{baseAmount:base,cityAmounts:{},pricingMode:model==='NIGHT'?'DURATION':model==='QUANTITY'?'FIXED':model,...(model==='NIGHT'?{unitMinutes:body.nightMinutes||720}:{})});
 let result=price(normalized,input,quote);
 // Quantity multiplies an authoritative unit calculation, including its options, only once.
 if(quantity>1){for(const key of ['base','optionsAmount','fees','discount','subtotal','tax','total','deposit','commission'] as const)result[key]=amount(result[key]*quantity);result={...result,milestones:result.milestones.map(m=>({...m,amount:amount(m.amount*quantity)}))};}
 if(body.extraMinuteAmount&&result.durationMinutes>body.includedMinutes){const extra=amount(Math.ceil((result.durationMinutes-body.includedMinutes)/body.extraUnitMinutes)*body.extraMinuteAmount*quantity);const baseExtra=mergePolicy(normalized,{baseAmount:extra,pricingMode:'FIXED',fees:[],options:[],discountBps:0});const more=price(baseExtra,{durationMinutes:result.durationMinutes});result={...result,base:amount(result.base+extra),subtotal:amount(result.subtotal+extra),tax:amount(result.tax+more.tax),total:amount(result.total+more.total),deposit:amount(result.deposit+more.deposit),commission:amount(result.commission+more.commission),milestones:result.milestones.map((m,i)=>({...m,amount:amount(m.amount+more.milestones[i].amount)}))};}
 return {...result,quantity,policy:normalized,model};
}
export function discountedPrices(lines:any[],bps:number){
 amount(bps,10000);return lines.map(line=>{const p=line.price;if(!bps)return line; if(p.discount>0)throw Error('لا يجمع خصم الباقة مع خصم العرض نفسه');
 const subtotal=p.subtotal-Math.round(p.subtotal*bps/10000),tax=Math.round(subtotal*line.policy.taxBps/10000),total=subtotal+tax,deposit=Math.round(total*line.policy.depositBps/10000);let remain=total-deposit;
 const milestones=line.policy.paymentMilestones.map((m:any,i:number)=>{const value=i===line.policy.paymentMilestones.length-1?remain:Math.min(remain,Math.round(total*m.percentBps/10000));remain-=value;return {...m,amount:value};});
 return {...line,price:{...p,discount:p.subtotal-subtotal,subtotal,tax,total,deposit,commission:Math.round(subtotal*line.policy.commissionBps/10000),milestones}};});
}
export function paymentState(total:number,paid:number,refunded:number,pending=0){if(refunded&&refunded===paid)return 'REFUNDED';if(refunded)return 'PARTIALLY_REFUNDED';if(paid===0&&total===0)return 'UNPAID';if(paid>=total)return 'PAID';if(paid>0)return 'PARTIALLY_PAID';return pending?'PENDING':'UNPAID';}
export function bookingState(status:string,hold?:string){if(['CANCELLED','REJECTED'].includes(status))return 'CANCELLED';if(status==='EXPIRED')return 'EXPIRED';if(['CONFIRMED','IN_PROGRESS','COMPLETED','CLOSED','DISPUTED','RESCHEDULE_REQUESTED','CANCELLATION_REQUESTED'].includes(status))return 'CONFIRMED';return hold?Date.parse(hold)>Date.now()?'HELD':'EXPIRED':status==='AVAILABILITY_PENDING'?'AVAILABILITY_REQUEST':'AWAITING_CONFIRMATION';}
export function fulfillmentState(status:string){return status==='IN_PROGRESS'?'IN_PROGRESS':['COMPLETED','CLOSED'].includes(status)?'COMPLETED':status==='CANCELLED'?'CANCELLED':status==='DISPUTED'?'BLOCKED':status==='CONFIRMED'?'READY':'NOT_STARTED';}

export function fixedPackagePrices(lines:any[],target:number){amount(target);if(lines.some(l=>l.price.needsQuote||l.price.discount))throw Error('السعر الثابت للباقة لا يجمع بعرض سعر غير محدد أو خصم آخر');const sum=lines.reduce((n,l)=>n+l.price.total,0);let remaining=target;
 return lines.map((l,i)=>{const gross=i===lines.length-1?remaining:Math.floor(target*(sum?l.price.total/sum:1/lines.length));remaining-=gross;const subtotal=Math.round(gross*10000/(10000+l.policy.taxBps)),tax=gross-subtotal,deposit=Math.round(gross*l.policy.depositBps/10000);let remainder=gross-deposit;return {...l,price:{...l.price,fees:l.price.fees+Math.max(0,subtotal-l.price.subtotal),discount:Math.max(0,l.price.subtotal-subtotal),subtotal,tax,total:gross,deposit,commission:Math.round(subtotal*l.policy.commissionBps/10000),milestones:l.policy.paymentMilestones.map((m:any,index:number)=>{const v=index===l.policy.paymentMilestones.length-1?remainder:Math.min(remainder,Math.round(gross*m.percentBps/10000));remainder-=v;return {...m,amount:v};})}};});
}

export function orderState(items:{status:string;fulfillmentStatus:string}[]){const active=items.filter(i=>!['CANCELLED','REJECTED','EXPIRED'].includes(i.status));if(!active.length)return 'CANCELLED';if(active.every(i=>i.fulfillmentStatus==='COMPLETED'))return 'COMPLETED';if(active.some(i=>i.fulfillmentStatus==='IN_PROGRESS'))return 'IN_PROGRESS';if(active.every(i=>['CONFIRMED','IN_PROGRESS','COMPLETED','CLOSED'].includes(i.status)))return 'CONFIRMED';return 'WAITING_APPROVAL';}
