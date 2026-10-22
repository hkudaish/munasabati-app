import { api, body } from '@/lib/server/http';
import { requireAdmin, requireSystemAdmin } from '@/lib/server/auth';
import { prisma } from '@/lib/db';
import { computeStats, readStatsConfig, saveStatsConfig, STAT_DEFINITIONS } from '@/lib/server/availability/stats';

export const dynamic = 'force-dynamic';
/** The settings, every metric's definition, and the live values (computed now, ignoring the public cache) so the public display can be previewed. */
export const GET = api(async () => {
  await requireAdmin();
  const config = await readStatsConfig();
  const [live, cities] = await Promise.all([computeStats(config), prisma.saudiCity.findMany({ select: { id: true, nameAr: true }, orderBy: { nameAr: 'asc' } })]);
  return { config, definitions: STAT_DEFINITIONS, live, cities };
}, { allowDisabledFeature: true });
export const PUT = api(async request => { const user = await requireSystemAdmin(); return { config: await saveStatsConfig(user.id, await body(request, 20000)) }; }, { allowDisabledFeature: true });
