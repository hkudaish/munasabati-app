import { api } from '@/lib/server/http';
import { vendorInsights } from '@/lib/server/vendor-insights';
export const dynamic = 'force-dynamic';
export const GET = api(request => vendorInsights(new URL(request.url).searchParams), { allowDisabledFeature: true });
