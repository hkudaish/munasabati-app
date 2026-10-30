import { api, body } from '@/lib/server/http';
import { myVendorApproval, resubmitVendorApproval } from '@/lib/server/vendor-approval';
export const dynamic = 'force-dynamic';
export const GET = api(async () => myVendorApproval());
export const POST = api(async request => resubmitVendorApproval(await body(request, 6000)));
