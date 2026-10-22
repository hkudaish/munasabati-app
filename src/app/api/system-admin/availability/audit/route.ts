import { api } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { auditLogs } from '@/lib/server/availability/policies';

export const dynamic = 'force-dynamic';
export const GET = api(async request => {
  await requireAdmin();
  const q = new URL(request.url).searchParams;
  return auditLogs({ policyId: q.get('policyId') || undefined, entityType: q.get('entityType') || undefined, entityId: q.get('entityId') || undefined, page: Number(q.get('page')) || 0 });
}, { allowDisabledFeature: true });
