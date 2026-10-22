import { api, body } from '@/lib/server/http';
import { createDraft, listDrafts } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const GET = api(() => listDrafts(), { allowDisabledFeature: true });
export const POST = api(async request => createDraft(await body(request, 60000)), { allowDisabledFeature: true });
