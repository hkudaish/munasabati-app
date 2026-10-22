import { api, HttpError } from '@/lib/server/http';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshotForListing } from '@/lib/server/availability/loader';
import { publicDecision } from '@/lib/server/availability/enforce';
import { serviceContext, serviceRows } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
/** Public: how every published service stands in one city (visible, bookable, notice). No policy internals. */
export const GET = api(async request => {
  const q = new URL(request.url).searchParams;
  const cityId = q.get('cityId') || null;
  const [snapshot, services] = await Promise.all([loadSnapshotForListing(), serviceRows()]);
  if (cityId && !snapshot.geo.cities.some(c => c.id === cityId)) throw new HttpError(404, 'المدينة غير موجودة');
  const categoryId = q.get('categoryId');
  const rows = services.filter(s => !categoryId || s.categoryId === categoryId).slice(0, 500).map(s => ({ serviceId: s.id, ...publicDecision(resolve(snapshot, serviceContext(s, cityId))) })).filter(r => r.isVisible);
  return { cityId, services: rows };
}, { allowDisabledFeature: true });
