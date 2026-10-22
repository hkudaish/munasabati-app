import { api } from '@/lib/server/http';
import { validateDraft } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const POST = api((_, { params }) => validateDraft(params.id), { allowDisabledFeature: true });
