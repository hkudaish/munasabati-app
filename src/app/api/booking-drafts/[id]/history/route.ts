import { api } from '@/lib/server/http';
import { draftHistory } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const GET = api((_, { params }) => draftHistory(params.id), { allowDisabledFeature: true });
