import { api } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { customerView } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const GET = api(async () => customerView(await requireUser()), { allowDisabledFeature: true });
