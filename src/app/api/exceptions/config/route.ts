import { prisma } from '@/lib/db';
import { api, body } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { loadConfig, saveConfig } from '@/lib/server/exceptions/workflow';
export const dynamic = 'force-dynamic';
// Escalation windows and thresholds. Available even while the feature is off, so it can be prepared before it is switched on.
export const GET = api(async () => { await requireAdmin(); return { config: await loadConfig(prisma) }; }, { allowDisabledFeature: true });
export const POST = api(async request => { await requireAdmin(); return { config: await saveConfig(await body(request, 10000)) }; }, { allowDisabledFeature: true });
