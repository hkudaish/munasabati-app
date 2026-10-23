// Shared deterministic policy, pricing and lifecycle rules. All money is integer halalas.
export const bookingModes = ['DIRECT','QUOTE','APPROVAL','INQUIRY'] as const;
export const deliveryModels = ['PLATFORM','VENDOR','MANAGED_EXTERNAL','JOINT'] as const;
export const states: Record<string,string> = { REQUESTED:'طلب جديد', AVAILABILITY_PENDING:'بانتظار التحقق من التوفر', QUOTE_PENDING:'بانتظار عرض السعر', CUSTOMER_APPROVAL_PENDING:'بانتظار قبول السعر', APPROVAL_PENDING:'بانتظار موافقة الجهة المخولة', PAYMENT_PENDING:'بانتظار الدفعة المطلوبة', READY_TO_CONFIRM:'جاهز لمراجعة التأكيد', CONFIRMED:'حجز مؤكد', IN_PROGRESS:'قيد التنفيذ', COMPLETED:'اكتمل التنفيذ', CLOSED:'مغلق مالياً', REJECTED:'مرفوض', CANCELLED:'ملغي', EXPIRED:'منتهي الصلاحية', RESCHEDULE_REQUESTED:'طلب إعادة جدولة', CANCELLATION_REQUESTED:'طلب إلغاء', DISPUTED:'متنازع عليه' };
export type Policy = ReturnType<typeof defaultPolicy>;
export function defaultPolicy() { return {
  bookingMode:'APPROVAL', pricingMode:'FIXED', baseAmount:0, currency:'SAR', durationMinutes:240, minDurationMinutes:60, maxDurationMinutes:1440, unitMinutes:60,
  options:[] as {id:string;nameAr:string;amount:number;pricingMode:string;maxQuantity:number}[], cityAmounts:{} as Record<string,number>, packages:[] as {id:string;nameAr:string;amount:number;durationMinutes:number}[], fees:[] as {nameAr:string;amount:number}[], discountBps:0, taxBps:1500, depositBps:3000, commissionBps:1000,
  paymentMilestones:[{nameAr:'الرصيد قبل التنفيذ',beforeHours:24,percentBps:7000}], cancellation:{freeBeforeHours:72,refundBps:5000},
  calendar:{workingDays:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440,blackoutDates:[] as string[],minNoticeHours:24,maxAdvanceDays:365,bufferMinutes:0},
  requiredFields:[] as {key:string;labelAr:string;type:string}[], requirementsAr:'',paymentTermsAr:'',cancellationTermsAr:'',quoteValidityHours:48,requestExpiryHours:72,settlementHoldHours:48, reminderHours:24,
}; }
function object(v:any) { return !!v && typeof v==='object' && !Array.isArray(v); }
export function mergePolicy(...layers:any[]):Policy { const result:any=defaultPolicy(); for(const layer of layers){if(!layer)continue;for(const key of Object.keys(result)){if(layer[key]!==undefined)result[key]=object(result[key])&&object(layer[key])?{...result[key],...layer[key]}:layer[key];}}return validatePolicy(result); }
export function amount(value:any,max=2_000_000_000) { if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('قيمة مالية أو رقمية غير صالحة');return value as number; }
export function validatePolicy(p:any):Policy {
 if(!object(p)||!bookingModes.includes(p.bookingMode)||!['FIXED','STARTING_AT','HOURLY','DAILY','DURATION','GUEST','PACKAGE'].includes(p.pricingMode)||p.currency!=='SAR')throw Error('نموذج الحجز أو التسعير غير صالح');
 for(const k of ['baseAmount','durationMinutes','minDurationMinutes','maxDurationMinutes','unitMinutes','quoteValidityHours','requestExpiryHours','settlementHoldHours','reminderHours'])amount(p[k],k==='baseAmount'?100_000_000:525600);
 if(!p.unitMinutes||!p.minDurationMinutes||p.maxDurationMinutes<p.minDurationMinutes||p.durationMinutes<p.minDurationMinutes||p.durationMinutes>p.maxDurationMinutes||!p.quoteValidityHours||!p.requestExpiryHours)throw Error('حدود المدة غير صالحة');
 for(const k of ['taxBps','depositBps','commissionBps','discountBps'])amount(p[k],10000);
 if(!object(p.cityAmounts)||Object.keys(p.cityAmounts).length>100)throw Error('أسعار المدن غير صالحة');Object.values(p.cityAmounts).forEach(v=>amount(v,100_000_000));
 if(!Array.isArray(p.packages)||p.packages.length>50||!Array.isArray(p.fees)||p.fees.length>30||!Array.isArray(p.requiredFields)||p.requiredFields.length>30)throw Error('قائمة الإعدادات طويلة أو غير صالحة');
 const keys=new Set();for(const item of p.packages){if(!/^[\w-]{1,100}$/.test(item.id)||keys.has(item.id)||typeof item.nameAr!=='string'||!item.nameAr.trim())throw Error('الباقة غير صالحة');keys.add(item.id);amount(item.amount,100_000_000);amount(item.durationMinutes,525600);if(item.durationMinutes<p.minDurationMinutes||item.durationMinutes>p.maxDurationMinutes)throw Error('مدة الباقة خارج الحدود');}
 for(const fee of p.fees){if(typeof fee.nameAr!=='string'||!fee.nameAr.trim()||fee.nameAr.length>200)throw Error('اسم الرسم مطلوب');amount(fee.amount,100_000_000);}
 keys.clear();for(const f of p.requiredFields){if(!/^[a-zA-Z][\w-]{0,59}$/.test(f.key)||keys.has(f.key)||typeof f.labelAr!=='string'||!f.labelAr.trim()||!['text','number','boolean'].includes(f.type))throw Error('الحقل الإلزامي غير صالح');keys.add(f.key);}
 if(!Array.isArray(p.options)||p.options.length>50)throw Error('الإضافات غير صالحة');keys.clear();for(const o of p.options){if(!/^[\w-]{1,100}$/.test(o.id)||keys.has(o.id)||typeof o.nameAr!=='string'||!o.nameAr.trim()||!['FIXED','PER_HOUR','PER_GUEST','PER_UNIT'].includes(o.pricingMode))throw Error('إضافة غير صالحة');keys.add(o.id);amount(o.amount,100_000_000);amount(o.maxQuantity,10000);if(!o.maxQuantity)throw Error('كمية الإضافة غير صالحة');}
 const c=p.calendar;if(!object(c)||!Array.isArray(c.workingDays)||!c.workingDays.length||c.workingDays.some((d:any)=>!Number.isInteger(d)||d<0||d>6)||!Array.isArray(c.blackoutDates)||c.blackoutDates.length>1000||c.blackoutDates.some((d:any)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)))throw Error('التقويم غير صالح');
 for(const k of ['startMinute','endMinute'])amount(c[k],1440);if(c.startMinute>=c.endMinute)throw Error('وقت الإغلاق يجب أن يلي وقت الفتح');amount(c.minNoticeHours,8760);amount(c.maxAdvanceDays,3650);amount(c.bufferMinutes,10080);
 if(!object(p.cancellation))throw Error('سياسة الإلغاء مطلوبة');amount(p.cancellation.freeBeforeHours,8760);amount(p.cancellation.refundBps,10000);
 if(!Array.isArray(p.paymentMilestones)||p.paymentMilestones.length>12)throw Error('الدفعات غير صالحة');let total=p.depositBps;for(const m of p.paymentMilestones){amount(m.percentBps,10000);amount(m.beforeHours,8760);if(typeof m.nameAr!=='string'||!m.nameAr.trim())throw Error('اسم الدفعة مطلوب');total+=m.percentBps;}if(total!==10000)throw Error('مجموع العربون والدفعات يجب أن يساوي 100%');
 for(const k of ['requirementsAr','paymentTermsAr','cancellationTermsAr'])if(typeof p[k]!=='string'||p[k].length>8000)throw Error('نص السياسة غير صالح');
 return p;
}
export function price(p:Policy,input:any,quote?:number){
 const duration=amount(input.durationMinutes??p.durationMinutes,525600),guests=amount(input.guestCount??1,100000);
 if(duration<p.minDurationMinutes||duration>p.maxDurationMinutes||!guests)throw Error('المدة أو عدد الضيوف خارج الحدود');
 let base=p.cityAmounts[input.cityId]??p.baseAmount,actualDuration=duration;
 if(p.pricingMode==='PACKAGE'){const pack=p.packages.find(b=>b.id===input.packageId);if(!pack)throw Error('اختر باقة متاحة');base=pack.amount;actualDuration=pack.durationMinutes;}
 if(['HOURLY','DAILY','DURATION'].includes(p.pricingMode))base*=Math.ceil(duration/(p.pricingMode==='HOURLY'?60:p.pricingMode==='DAILY'?1440:p.unitMinutes));
 if(p.pricingMode==='GUEST')base*=guests;
 if(quote!==undefined)base=amount(quote,100_000_000);
 const needsQuote=(p.pricingMode==='STARTING_AT'||p.bookingMode==='QUOTE'||p.bookingMode==='INQUIRY')&&quote===undefined;
 const selections=input.options??[];if(!Array.isArray(selections)||selections.length>50)throw Error('اختيارات الإضافات غير صالحة');const selected=new Set();let optionsAmount=0;for(const item of selections){const option=p.options.find(o=>o.id===item.id);if(!option||selected.has(item.id))throw Error('إضافة غير متاحة أو مكررة');selected.add(item.id);amount(item.quantity,option.maxQuantity);if(!item.quantity)throw Error('كمية الإضافة غير صالحة');optionsAmount+=option.amount*item.quantity*(option.pricingMode==='PER_HOUR'?Math.ceil(actualDuration/60):option.pricingMode==='PER_GUEST'?guests:1);}
 const fees=amount(p.fees.reduce((s,f)=>s+f.amount,0));amount(base);amount(optionsAmount);const discount=Math.round((base+optionsAmount)*p.discountBps/10000),subtotal=amount(base+optionsAmount+fees-discount),tax=Math.round(subtotal*p.taxBps/10000),total=amount(subtotal+tax),deposit=Math.round(total*p.depositBps/10000),commission=Math.round(subtotal*p.commissionBps/10000);
 let remaining=total-deposit;const milestones=p.paymentMilestones.map((m,i)=>{const value=i===p.paymentMilestones.length-1?remaining:Math.min(remaining,Math.round(total*m.percentBps/10000));remaining-=value;return {...m,amount:value};});
 return {base,optionsAmount,fees,discount,subtotal,tax,total,deposit,commission,milestones,durationMinutes:actualDuration,needsQuote,currency:'SAR',unit:'HALALA'};
}
export function interval(date:string,time:string,duration:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isInteger(duration)||duration<1)throw Error('الموعد غير صالح');
 const start=new Date(date+'T'+time+':00+03:00');if(!Number.isFinite(+start)||new Date(+start+10800000).toISOString().slice(0,10)!==date)throw Error('التاريخ غير صالح');return {start,end:new Date(+start+duration*60000)};
}
export function checkCalendar(c:Policy['calendar'],start:Date,end:Date,now=Date.now()){
 if(+start<now+c.minNoticeHours*3600000||+start>now+c.maxAdvanceDays*86400000)throw Error('الموعد خارج مهلة الحجز');
 // Check each Riyadh calendar day, including overnight and multi-day services.
 for(let cursor=+start;cursor<+end;){const local=new Date(cursor+10800000),date=local.toISOString().slice(0,10),minute=local.getUTCHours()*60+local.getUTCMinutes(),nextMidnight=Date.parse(date+'T00:00:00+03:00')+86400000,partEnd=Math.min(+end,nextMidnight),lastMinute=minute+(partEnd-cursor)/60000;
 if(!c.workingDays.includes(local.getUTCDay())||c.blackoutDates.includes(date)||minute<c.startMinute||lastMinute>c.endMinute)throw Error('الموعد يتعارض مع أيام أو ساعات العمل أو الإجازات');cursor=partEnd;}
}
export function nextState(data:any){if(!data.availabilityChecked)return 'AVAILABILITY_PENDING';if(data.price.needsQuote)return 'QUOTE_PENDING';if(!data.customerAccepted)return 'CUSTOMER_APPROVAL_PENDING';if(data.policy.bookingMode!=='DIRECT'&&data.approvals.length<data.managerIds.length)return 'APPROVAL_PENDING';if(data.paid<data.price.deposit)return 'PAYMENT_PENDING';return 'READY_TO_CONFIRM';}
export function refundLimit(data:any,now=Date.now()){const bps=+new Date(data.startAt)-now>=data.policy.cancellation.freeBeforeHours*3600000?10000:data.policy.cancellation.refundBps;return Math.max(0,Math.round(data.paid*bps/10000)-data.refunded);}
export function settlementBasis(data:any){
 if(data.cancelledAt){const retained=amount(data.paid-(data.refundEntitlement??0)),subtotal=Math.round(retained*10000/(10000+data.policy.taxBps)),commission=Math.round(subtotal*data.policy.commissionBps/10000);return {total:retained,subtotal,tax:retained-subtotal,commission,providerNet:subtotal-commission};}
 // a discount the platform funds does not reduce what the provider is paid (the commission is charged on subtotal + platform-funded part); vendor-funded and package discounts do
 return {...data.price,providerNet:data.price.subtotal+(data.price.funding?.platform??0)-data.price.commission};
}
export function settlement(data:any,paidOut:number,now=Date.now()){
 const cancelled=data.status==='CANCELLED',holdStart=cancelled?data.cancelledAt:data.completedAt;
 if(!['COMPLETED','CANCELLED'].includes(data.status)||!holdStart||now<+new Date(holdStart)+data.policy.settlementHoldHours*3600000)throw Error('التسوية محجوزة حتى اكتمال التنفيذ أو اعتماد الإلغاء وانتهاء فترة الحجز');
 if(cancelled?data.refunded!==(data.refundEntitlement??0):data.paid-data.refunded<data.price.total)throw Error('يلزم مطابقة التحصيل واستيفاء الاستردادات أولاً');return amount(settlementBasis(data).providerNet-paidOut);
}
