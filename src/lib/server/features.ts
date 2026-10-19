import 'server-only';
import { prisma } from '@/lib/db';
import { defaultFeatures, FeatureId } from '@/lib/system/feature-catalog';
import { HttpError } from './http';
export async function featureStates() {
  const rows = await prisma.systemFeature.findMany();
  return defaultFeatures().map(f => { const row = rows.find(r => r.id === f.id); return row ? { id: f.id, visible: row.visible, enabled: row.enabled, version: row.version } : f; });
}
// Layout-only cache: feature visibility in the page chrome may lag by a few seconds.
// requireFeature() and the APIs always read the database.
const LAYOUT_TTL_MS = 10_000;
let layoutStates: { at: number; value: ReturnType<typeof featureStates> } | null = null;
export function featureStatesForLayout() {
  if (process.env.NODE_ENV !== 'production') return featureStates();
  if (!layoutStates || Date.now() - layoutStates.at > LAYOUT_TTL_MS) {
    const value = featureStates();
    layoutStates = { at: Date.now(), value };
    value.catch(() => { if (layoutStates?.value === value) layoutStates = null; });
  }
  return layoutStates.value;
}
export async function requireFeature(id: FeatureId) {
  const states = await featureStates();
  const feature = states.find(f => f.id === id);
  if (id === 'zaffah_generator' && !states.find(f => f.id === 'folk_arts')?.enabled) throw new HttpError(403, 'مكتبة الفنون معطلة حالياً');
  if (!feature?.enabled) throw new HttpError(403, 'هذه الخدمة معطلة حالياً بواسطة مدير النظام');
}
export function guardService(handler: (request: Request) => Promise<Response>, id: FeatureId, existing=false) {
  return async (request: Request) => {
    try { if(!existing&&request.method!=='GET')await requireFeature(id); if(request.headers.get('x-coverage-preview'))throw new HttpError(403,'المعاينة للعرض فقط'); return await handler(request); }
    catch (error) { const { NextResponse } = await import('next/server'); return NextResponse.json({ error: error instanceof HttpError ? error.message : 'تعذر التحقق من الخدمة' }, { status: error instanceof HttpError ? error.status : 503 }); }
  };
}
