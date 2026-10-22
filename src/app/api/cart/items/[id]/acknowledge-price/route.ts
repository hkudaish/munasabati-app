import { api } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { acknowledgePrice } from '@/lib/server/commerce-v2/cart';
export const dynamic = 'force-dynamic';
export const POST = api(async (request, { params }) => { await assertNotPreview(request); return acknowledgePrice(params.id); }, { allowDisabledFeature: true });
