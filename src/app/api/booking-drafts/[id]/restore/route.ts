import { api, body } from '@/lib/server/http';
import { restoreDraft } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const POST = api(async (request, { params }) => restoreDraft(params.id, await body(request, 4000)), { allowDisabledFeature: true });
