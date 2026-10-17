import { api } from '@/lib/server/http';
import { sessionUser, profile } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const user = await sessionUser(); return { user: user ? profile(user) : null }; });
