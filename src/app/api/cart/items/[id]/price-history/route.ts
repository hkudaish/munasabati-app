import { api } from '@/lib/server/http';
import { priceHistory } from '@/lib/server/commerce-v2/cart';
export const dynamic = 'force-dynamic';
export const GET = api((_, { params }) => priceHistory(params.id), { allowDisabledFeature: true });
