import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { createException } from '@/lib/server/exceptions/workflow';
import { listExceptions } from '@/lib/server/exceptions/queries';
import { metaOf } from '@/lib/server/exceptions/meta';
export const dynamic = 'force-dynamic';

// GET: the requests the signed-in person may see (customer: their own; provider: those on their services; coordinator: their assignments; staff: all),
// with filters, sorting and the dashboard counters (?stats=1). The CSV export is /api/exceptions/export.
export const GET = api(async request => { await requireUser(); return listExceptions(new URL(request.url).searchParams); });
export const POST = api(async request => createException(await body(request, 60000), metaOf(request)));
