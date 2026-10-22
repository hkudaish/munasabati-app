import { api, body } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { previewDecision } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
/** "View as customer": nothing is saved; unsaved policies may be applied hypothetically. */
export const POST = api(async request => {
  await requireAdmin();
  const d = await body(request, 100000);
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return previewDecision({ serviceId: str(d.serviceId), offerId: str(d.offerId), vendorId: str(d.vendorId), cityId: str(d.cityId) ?? null, countryCode: str(d.countryCode) ?? null, date: str(d.date) ?? null, time: str(d.time) ?? null, quantity: Math.max(1, Math.min(10000, Number(d.quantity) || 1)), intent: d.intent === 'VIEW' || d.intent === 'CONFIRM' || d.intent === 'MODIFY' ? d.intent : 'BOOK', hypothetical: Array.isArray(d.hypothetical) ? d.hypothetical : [] });
}, { allowDisabledFeature: true });
