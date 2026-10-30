import { api, body } from '@/lib/server/http';
import { exceptionAction } from '@/lib/server/exceptions/actions';
import { exceptionDetail } from '@/lib/server/exceptions/queries';
import { metaOf } from '@/lib/server/exceptions/meta';
export const dynamic = 'force-dynamic';
export const GET = api(async (_request, context) => exceptionDetail((await context.params).id));
// One entry point for every step of the workflow; the state machine and the caller's roles decide what is allowed.
export const POST = api(async (request, context) => { const id = (await context.params).id; const request_ = await exceptionAction({ ...(await body(request, 20000)), id }, metaOf(request)); return { request: request_ }; });
