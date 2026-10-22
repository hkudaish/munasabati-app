import { api, body } from '@/lib/server/http';
import { requireAdmin, requireSystemAdmin } from '@/lib/server/auth';
import { bulkApply, bulkPreview } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
/** `dryRun: true` (the default) only previews: the cells that would change and the conflicts. Applying needs the system administrator and a reason. */
export const POST = api(async request => {
  const d = await body(request, 200000);
  if (d.dryRun === false) { const user = await requireSystemAdmin(); return bulkApply(user.id, d); }
  await requireAdmin();
  return bulkPreview(d);
}, { allowDisabledFeature: true });
