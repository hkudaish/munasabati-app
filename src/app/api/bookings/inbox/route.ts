import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/server/auth';
import { api,body,text } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
export const dynamic='force-dynamic';
export const GET=api(async()=>{const user=await requireUser();const notices=await prisma.$queryRaw<any[]>`SELECT i.* FROM "ServiceInbox" i JOIN "ServiceRequest" r ON r."id"=i."requestId" WHERE i."userId"=${user.id} AND i."dueAt"<=CURRENT_TIMESTAMP AND (i."event" NOT LIKE 'PAYMENT_REMINDER:%' OR (r."status" NOT IN ('CANCELLED','CANCELLATION_REQUESTED','EXPIRED','REJECTED','CLOSED') AND (r."body"->>'paid')::bigint-(r."body"->>'refunded')::bigint<COALESCE((i."body"->>'requiredCumulative')::bigint,(r."body"->'price'->>'total')::bigint))) ORDER BY i."createdAt" DESC LIMIT 100`;return {notices};},{allowDisabledFeature:true});
export const PATCH=api(async request=>{await assertNotPreview(request);const user=await requireUser(),input=await body(request,2000),id=text(input.id,100,true);await prisma.$executeRaw`UPDATE "ServiceInbox" SET "readAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "userId"=${user.id}`;return {ok:true};},{allowDisabledFeature:true});
