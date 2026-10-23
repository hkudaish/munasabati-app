import { api, body, text } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { listPolicies, policyAction, savePolicy } from '@/lib/server/commerce-v2/pricing-admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => listPolicies(text(new URL(request.url).searchParams.get('packageId'), 140, true)), { allowDisabledFeature: true });
export const POST = api(async request => { await assertNotPreview(request); return savePolicy(await body(request, 40000)); }, { allowDisabledFeature: true });
export const PATCH = api(async request => { await assertNotPreview(request); return policyAction(await body(request, 4000)); }, { allowDisabledFeature: true });
