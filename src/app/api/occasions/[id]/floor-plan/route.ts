import { api, body } from '@/lib/server/http';
import { readFloorPlan, saveFloorPlan } from '@/lib/server/floor-plan';

export const dynamic = 'force-dynamic';

export const GET = api(async (_request, { params }) => ({ success: true, ...(await readFloorPlan(params.id)) }), { allowDisabledFeature: true });

export const PUT = api(async (request, { params }) => {
  const input = await body(request, 400000);
  return { success: true, ...(await saveFloorPlan(params.id, { layout: input.layout, version: input.version })) };
}, { allowDisabledFeature: true });
