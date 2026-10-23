import { api, body } from '@/lib/server/http';
import { staffAsk, staffSuggestions } from '@/lib/server/luma-staff';
export const dynamic = 'force-dynamic';
export const GET = api(() => staffSuggestions(), { allowDisabledFeature: true });
export const POST = api(async request => staffAsk(await body(request, 4000)), { allowDisabledFeature: true });
