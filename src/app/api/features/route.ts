import { api } from '@/lib/server/http';
import { featureStates } from '@/lib/server/features';
export const dynamic = 'force-dynamic';
export const GET = api(async () => ({ features: await featureStates() }));
