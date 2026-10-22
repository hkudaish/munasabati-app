import { api } from '@/lib/server/http';
import { publicStats } from '@/lib/server/availability/stats';

export const dynamic = 'force-dynamic';
/** Public: aggregate, verified figures only. Never any booking, customer, vendor or financial record. */
export const GET = api(async () => publicStats(), { allowDisabledFeature: true });
