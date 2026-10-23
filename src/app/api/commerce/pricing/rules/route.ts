import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { listRules, ruleAction, saveRule } from '@/lib/server/commerce-v2/pricing-admin';
export const dynamic = 'force-dynamic';
export const GET = api(() => listRules(), { allowDisabledFeature: true });
export const POST = api(async request => { await assertNotPreview(request); return saveRule(await body(request, 40000)); }, { allowDisabledFeature: true });
export const PATCH = api(async request => { await assertNotPreview(request); return ruleAction(await body(request, 4000)); }, { allowDisabledFeature: true });
