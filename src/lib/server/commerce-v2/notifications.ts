import 'server-only';
import {randomUUID} from 'node:crypto';
import {Tx} from '../booking/repository';
export async function notifyOrder(tx:Tx,order:any,action:string){
 const groups=await tx.$queryRaw<any[]>`SELECT "managerId" FROM "CommerceFulfillmentGroup" WHERE "orderId"=${order.id}`,admins=await tx.user.findMany({where:{isActive:true,role:{in:['ADMIN','SUPER_ADMIN']}},select:{id:true}});
 for(const userId of Array.from(new Set<string>([order.customerId,...groups.map(g=>g.managerId),...admins.map(a=>a.id)])))await tx.$executeRaw`INSERT INTO "ServiceInbox" ("id","userId","requestId","event","body") VALUES (${randomUUID()},${userId},${order.id},${'COMMERCE:'+action+':'+order.version},${JSON.stringify({referenceType:'ORDER',titleAr:'الطلب '+order.number,statusAr:action==='CREATE'?'طلب تجاري جديد':action.startsWith('FINANCE')?'تحديث المطابقة المالية':'تحديث الطلب أو التنفيذ',url:'/commerce/orders?id='+order.id})}::jsonb) ON CONFLICT ("userId","requestId","event") DO NOTHING`;
}
