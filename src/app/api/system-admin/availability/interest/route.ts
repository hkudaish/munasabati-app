import { api, body } from '@/lib/server/http';
import { requireAdmin, requireSystemAdmin } from '@/lib/server/auth';
import { interestSummary, markInterestNotified } from '@/lib/server/availability/interest';

export const dynamic = 'force-dynamic';
export const GET = api(async () => { await requireAdmin(); return { rows: await interestSummary() }; }, { allowDisabledFeature: true });
export const POST = api(async request => { const user = await requireSystemAdmin(); return markInterestNotified(user.id, await body(request, 4000)); }, { allowDisabledFeature: true });
