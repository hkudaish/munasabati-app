import { api } from '@/lib/server/http';
import { abandonedCarts } from '@/lib/server/commerce-v2/admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => abandonedCarts(new URL(request.url).searchParams), { allowDisabledFeature: true });
