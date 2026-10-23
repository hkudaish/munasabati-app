import { api, body } from '@/lib/server/http';
import { preview } from '@/lib/server/commerce-v2/pricing-admin';
export const dynamic = 'force-dynamic';
export const POST = api(async request => preview(await body(request, 60000)), { allowDisabledFeature: true });
