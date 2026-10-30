import { api } from '@/lib/server/http';
import { myNotifications } from '@/lib/server/exceptions/queries';
export const dynamic = 'force-dynamic';
export const GET = api(async request => myNotifications(new URL(request.url).searchParams.get('read') === '1'));
