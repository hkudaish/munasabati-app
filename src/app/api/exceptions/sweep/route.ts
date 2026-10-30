import { api } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { sweepExceptions } from '@/lib/server/exceptions/sweep';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;
// The 15-minute cron runs this automatically; an administrator can also run it now from the dashboard.
export const POST = api(async () => { await requireAdmin(); return { result: await sweepExceptions() }; }, { allowDisabledFeature: true });
