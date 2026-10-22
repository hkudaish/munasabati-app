import { cookies } from 'next/headers';
import { api } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { addDraftToCart } from '@/lib/server/commerce-v2/drafts';
export const dynamic = 'force-dynamic';
export const POST = api(async (request, { params }) => { await assertNotPreview(request); return addDraftToCart(params.id, cookies().get('locale')?.value); }, { allowDisabledFeature: true });
