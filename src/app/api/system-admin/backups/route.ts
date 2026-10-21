import { api, body, text, HttpError } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { approveRestore, cancelRestore, overview, previewBackup, requestRestore, runManual, verifyBackup } from '@/lib/server/backup/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

export const GET = api(async () => ({ success: true, ...(await overview()) }), { allowDisabledFeature: true });

export const POST = api(async request => {
  await assertNotPreview(request);
  const input = await body(request, 4000);
  const action = text(input.action, 40, true);
  const id = () => text(input.id, 80, true);
  switch (action) {
    case 'run': {
      const type = text(input.type, 20) || 'auto';
      if (!['auto', 'full', 'incremental'].includes(type)) throw new HttpError(400, 'نوع النسخة غير صالح');
      return { success: true, result: await runManual(type as 'auto' | 'full' | 'incremental') };
    }
    case 'verify': return { success: true, result: await verifyBackup(id()) };
    case 'preview': return { success: true, preview: await previewBackup(id()) };
    case 'request-restore': return { success: true, request: await requestRestore(id(), text(input.confirm, 20)) };
    case 'approve-restore': return { success: true, request: await approveRestore(id(), text(input.confirm, 20)) };
    case 'cancel-restore': return { success: true, request: await cancelRestore(id()) };
    default: throw new HttpError(400, 'إجراء غير معروف');
  }
}, { allowDisabledFeature: true });
