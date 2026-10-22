import { api } from '@/lib/server/http';
import { analytics } from '@/lib/server/commerce-v2/admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => analytics(new URL(request.url).searchParams), { allowDisabledFeature: true });
