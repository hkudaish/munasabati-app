import { api, body } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { moderate, moderationView } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
// Administrators can always moderate, even while customer reviews are switched off.
export const GET = api(async request => { await requireAdmin(); return moderationView(new URL(request.url).searchParams.get('filter') || 'pending'); }, { allowDisabledFeature: true });
export const PATCH = api(async request => moderate(await requireAdmin(), await body(request, 20000)), { allowDisabledFeature: true });
