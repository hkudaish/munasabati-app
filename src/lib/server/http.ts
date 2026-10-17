import 'server-only';
import { featureForPath } from '@/lib/system/feature-catalog';
import { NextResponse } from 'next/server';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (origin && origin !== expected && origin !== new URL(request.url).origin) throw new HttpError(403, 'مصدر الطلب غير مسموح');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'مصدر الطلب غير مسموح');
}
export async function body(request: Request, limit = 1600000): Promise<Record<string, any>> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'البيانات مطلوبة');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'حجم الطلب كبير'); } chunks.push(value); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
  catch { throw new HttpError(400, 'بيانات غير صالحة'); }
}
export function text(value: unknown, max: number, required = false): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, 'قيمة نصية غير صالحة');
  return value.trim();
}
export function integer(value: unknown, max: number, fallback = 0): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > max) throw new HttpError(400, 'قيمة رقمية غير صالحة');
  return value as number;
}
export function api(handler: (request: Request, context: any) => Promise<unknown>, options: { allowDisabledFeature?: boolean } = {}) {
  return async (request: Request, context: any) => {
    try { const feature = featureForPath(new URL(request.url).pathname, true); if (feature && !options.allowDisabledFeature) await (await import('./features')).requireFeature(feature.id); if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request); const data = await handler(request, context); return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } }); }
    catch (e: any) {
      const status = e instanceof HttpError ? e.status : ['P2002','P2034'].includes(e?.code) ? 409 : e?.code === 'P2025' ? 404 : 503;
      return NextResponse.json({ error: e instanceof HttpError ? e.message : status === 409 ? 'البيانات مسجلة مسبقاً أو تعارض تحديث؛ أعد التحميل' : status === 404 ? 'السجل غير موجود' : 'تعذر الاتصال بالخدمة؛ لم يتم تأكيد الحفظ. أعد المحاولة.' }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
