import { cookies } from 'next/headers';
import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { setLineSaved } from '@/lib/server/commerce-v2/cart';
export const dynamic = 'force-dynamic';
export const POST = api(async (request, { params }) => { await assertNotPreview(request); const input = await body(request, 2000); return setLineSaved({ lineId: params.id, saved: false, version: input.version }, cookies().get('locale')?.value); }, { allowDisabledFeature: true });
