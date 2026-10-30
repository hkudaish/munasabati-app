import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/server/http';
import { requireFeature } from '@/lib/server/features';
import { exportExceptionsCsv } from '@/lib/server/exceptions/queries';
export const dynamic = 'force-dynamic';
// A file download, so it answers with CSV (the shared JSON wrapper is not used); the same rules as the list decide what is in it.
export async function GET(request: Request) {
  try {
    await requireFeature('booking_exceptions');
    const csv = await exportExceptionsCsv(new URL(request.url).searchParams);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="exceptions.csv"', 'cache-control': 'no-store' } });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 503;
    return NextResponse.json({ error: e instanceof HttpError ? e.message : 'تعذر التصدير' }, { status });
  }
}
