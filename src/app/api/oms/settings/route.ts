import { requireAdmin } from '@/lib/server/auth';
import { api, body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { getOMSSettings, saveOMSSettings } from '@/lib/oms/store';
export const GET = api(async () => { await requireAdmin(); return { success: true, settings: await getOMSSettings() }; });
export const POST = api(async request => {
  await assertNotPreview(request);
  const actor = await requireAdmin();
  const { settings } = await body(request, 20000);
  return { success: true, settings: await saveOMSSettings(settings || {}, actor.id) };
});
