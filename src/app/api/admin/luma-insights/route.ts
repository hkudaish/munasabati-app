import { api } from '@/lib/server/http';
import { lumaInsights } from '@/lib/server/luma-staff';
export const dynamic = 'force-dynamic';
export const GET = api(() => lumaInsights(), { allowDisabledFeature: true });
