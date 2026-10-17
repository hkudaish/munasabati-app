import { sessionUser } from '@/lib/server/auth';
import { api } from '@/lib/server/http';
import { getVendorsFromDB } from '@/lib/server-db';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const user = await sessionUser(); return { vendors: await getVendorsFromDB({ strict: true, includeInactive: !!user && ['ADMIN','SUPER_ADMIN'].includes(user.role) }) }; });
