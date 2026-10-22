import { api, body } from '@/lib/server/http';
import { getNotificationSettings, saveNotificationSettings } from '@/lib/server/commerce-v2/admin';
export const dynamic = 'force-dynamic';
export const GET = api(() => getNotificationSettings(), { allowDisabledFeature: true });
export const PATCH = api(async request => saveNotificationSettings(await body(request, 40000)), { allowDisabledFeature: true });
