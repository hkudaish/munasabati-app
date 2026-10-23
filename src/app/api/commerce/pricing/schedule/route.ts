import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { saveSchedule } from '@/lib/server/commerce-v2/pricing-admin';
export const dynamic = 'force-dynamic';
export const POST = api(async request => { await assertNotPreview(request); return saveSchedule(await body(request, 4000)); }, { allowDisabledFeature: true });
