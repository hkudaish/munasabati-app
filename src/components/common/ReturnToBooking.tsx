'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

/** Only our own planning page may be a return target: never an address a link could smuggle in. */
const ALLOWED = /^\/plan(\?[\w=&%-]*)?$/;
function Inner() {
  const target = useSearchParams().get('returnTo');
  if (!target || !ALLOWED.test(target)) return null;
  return (
    <div className="sticky top-14 z-30 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-saudi-green-200 bg-saudi-green-50/95 p-3 text-sm shadow-sm backdrop-blur">
      <span>أنت تستعرض الخدمات أثناء تخطيط مناسبتك؛ اختياراتك محفوظة.</span>
      <Link href={target} className="inline-flex items-center gap-1.5 rounded-xl bg-saudi-green-800 px-4 py-2 font-bold text-white hover:bg-saudi-green-900"><ArrowRight className="h-4 w-4" aria-hidden="true" />العودة لإكمال الحجز</Link>
    </div>
  );
}
export default function ReturnToBooking() { return <Suspense fallback={null}><Inner /></Suspense>; }
