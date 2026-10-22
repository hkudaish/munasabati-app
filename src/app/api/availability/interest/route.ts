import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { cancelInterest, myInterests, registerInterest } from '@/lib/server/availability/interest';

export const dynamic = 'force-dynamic';
export const GET = api(async () => ({ interests: await myInterests(await requireUser()) }), { allowDisabledFeature: true });
export const POST = api(async request => registerInterest(await requireUser(), await body(request, 4000)), { allowDisabledFeature: true });
export const DELETE = api(async request => cancelInterest(await requireUser(), await body(request, 4000)), { allowDisabledFeature: true });
