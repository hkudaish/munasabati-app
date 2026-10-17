import { api } from '@/lib/server/http';
import { logout } from '@/lib/server/auth';
export const POST = api(async () => { await logout(); return { success: true }; });
