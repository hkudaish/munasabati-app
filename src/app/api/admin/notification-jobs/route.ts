import { api } from '@/lib/server/http';
import { notificationJobs } from '@/lib/server/commerce-v2/admin';
export const dynamic = 'force-dynamic';
export const GET = api(request => notificationJobs(new URL(request.url).searchParams), { allowDisabledFeature: true });
