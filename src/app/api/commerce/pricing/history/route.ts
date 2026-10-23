import { api } from '@/lib/server/http';
import { history } from '@/lib/server/commerce-v2/pricing-admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => history(new URL(request.url).searchParams), { allowDisabledFeature: true });
