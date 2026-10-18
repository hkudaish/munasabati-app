import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { HttpError } from '../http';
export type Tx = Prisma.TransactionClient;
export const admin = (user:any) => ['ADMIN','SUPER_ADMIN'].includes(user.role);
export async function atomic<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>{for(let i=0;;i++){try{return await prisma.$transaction(fn,{isolationLevel:'Serializable',timeout:25000});}catch(e:any){if(!['P2034','40001'].includes(e.code)&&!String(e.meta?.message).includes('could not serialize'))throw e;if(i>=3)throw new HttpError(409,'تعارض متزامن؛ أعد المحاولة بنفس المفتاح');}}}
export async function lock(tx:Tx,key:string){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;}
export async function definitions(tx:Tx=prisma){return tx.$queryRaw<any[]>`SELECT * FROM "ServiceDefinition" ORDER BY "createdAt", "id"`;}
export async function definition(tx:Tx,id:string){const rows=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceDefinition" WHERE "id"=${id}`;return rows[0]??null;}
export async function requestRow(tx:Tx,id:string,locked=false){if(locked)await lock(tx,'request:'+id);const rows=await tx.$queryRaw<any[]>`SELECT * FROM "ServiceRequest" WHERE "id"=${id}`;if(!rows[0])throw new HttpError(404,'الطلب غير موجود');return rows[0];}
export function canManage(user:any,data:any){return admin(user)||user.role==='VENDOR'&&user.vendorProfile?.status==='ACTIVE'&&data.managerIds?.includes(user.id);}
export function canRead(user:any,row:any){return admin(user)||row.customerId===user.id||row.body.managerIds?.includes(user.id);}
export async function saveRequest(tx:Tx,row:any,data:any,status:string){const result=await tx.$executeRaw`UPDATE "ServiceRequest" SET "body"=${JSON.stringify({...data,status})}::jsonb,"status"=${status},"startAt"=${new Date(data.startAt)},"endAt"=${new Date(data.endAt)},"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id} AND "version"=${row.version}`;if(result!==1)throw new HttpError(409,'تغيّر الطلب؛ حدّث الصفحة');return requestRow(tx,row.id);}
export function view(row:any,user:any){const data={...row.body};if(!admin(user)){delete data.internalNote;delete data.shares;data.policy={...data.policy,commissionBps:undefined};data.price={...data.price,commission:undefined};}return {...row,body:data,idempotencyKey:undefined,requestHash:undefined};}
