import { api } from '@/lib/server/http';
import { priceChangeEvents } from '@/lib/server/commerce-v2/admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => priceChangeEvents(new URL(request.url).searchParams), { allowDisabledFeature: true });
