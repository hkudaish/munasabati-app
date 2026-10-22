import { api, body } from '@/lib/server/http';
import { getDraft, saveDraft } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const GET = api((_, { params }) => getDraft(params.id), { allowDisabledFeature: true });
export const PATCH = api(async (request, { params }) => saveDraft(params.id, await body(request, 60000)), { allowDisabledFeature: true });
