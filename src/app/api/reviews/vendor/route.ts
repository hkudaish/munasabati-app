import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { vendorReply, vendorView } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const GET = api(async () => vendorView(await requireUser()), { allowDisabledFeature: true });
export const POST = api(async request => vendorReply(await requireUser(), await body(request, 20000)), { allowDisabledFeature: true });
