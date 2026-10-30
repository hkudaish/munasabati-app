import { api, body } from '@/lib/server/http';
import { decideVendorApproval, listVendorApprovals } from '@/lib/server/vendor-approval';
export const dynamic = 'force-dynamic';
// Vendor account review: the list (newest pending first) and the decision (approve, ask for information, reject, hold, reopen).
export const GET = api(async request => listVendorApprovals(new URL(request.url).searchParams));
export const POST = api(async request => decideVendorApproval(await body(request, 6000)));
