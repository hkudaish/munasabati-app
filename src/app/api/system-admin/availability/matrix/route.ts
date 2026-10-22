import { api } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { matrix } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
export const GET = api(async request => {
  await requireAdmin();
  const q = new URL(request.url).searchParams;
  return matrix({ categoryId: q.get('categoryId') || undefined, vendorId: q.get('vendorId') || undefined, status: q.get('status') || undefined, countryCode: q.get('countryCode') || undefined, regionId: q.get('regionId') || undefined, search: q.get('search') || undefined, cityIds: (q.get('cityIds') || '').split(',').filter(Boolean) });
}, { allowDisabledFeature: true });
