import { api, body } from '@/lib/server/http';
import { logCustomerQuestion, customerPopularity } from '@/lib/server/luma-staff';
export const dynamic = 'force-dynamic';
export const GET = api(async () => ({ popular: await customerPopularity() }), { allowDisabledFeature: true });
export const POST = api(async request => logCustomerQuestion(request.headers.get('x-forwarded-for') ?? 'local', await body(request, 1000)), { allowDisabledFeature: true });
