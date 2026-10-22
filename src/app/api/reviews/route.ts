import { api, body, integer } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { publicReviews, submitReview } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
// Disabling the feature stops new reviews (checked inside submitReview) but approved reviews stay readable.
export const GET = api(async request => {
  const q = new URL(request.url).searchParams;
  return publicReviews({ serviceId: q.get('serviceId') || undefined, vendorId: q.get('vendorId') || undefined, featured: q.get('featured') === '1', limit: Math.min(50, Number(q.get('limit')) || 20) });
}, { allowDisabledFeature: true });
export const POST = api(async request => {
  const user = await requireUser();
  const d = await body(request, 20000);
  integer(d.rating, 5);
  return submitReview(user, d);
}, { allowDisabledFeature: true });
