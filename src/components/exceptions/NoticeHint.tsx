'use client';
import { useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';
import { useDuration } from './common';

import type { NoticeInfo } from './NoticeFlow';

/** Under the date and time pickers: how much notice this service needs, and when it is not met, the earliest time and the way to ask for an exception. */
export function useBookingNotice(offerId: string | null | undefined, packageId: string | null | undefined, cityId: string, date: string, time: string) {
  const [info, setInfo] = useState<(NoticeInfo & { ok: boolean }) | null>(null);
  useEffect(() => {
    if ((!offerId && !packageId) || !cityId || !date || !time) { setInfo(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ cityId, date, time }); if (packageId) q.set('packageId', packageId); else q.set('offerId', offerId as string);
      requestJSON('/api/booking-notice?' + q.toString()).then(d => { if (!cancelled) setInfo(d); }).catch(() => { if (!cancelled) setInfo(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [offerId, packageId, cityId, date, time]);
  return info;
}

export default function NoticeHint({ info, onRequest }: { info: (NoticeInfo & { ok: boolean }) | null; onRequest: (info: NoticeInfo) => void }) {
  const t = useT(), dur = useDuration();
  if (!info || (info.ok && !info.requiredMinutes)) return null;
  if (info.ok) return <p className="text-xs text-gray-600">{t('المدة المسبقة المطلوبة لهذه الخدمة:')} {dur(info.requiredMinutes)}</p>;
  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
      <p>{info.cutoffPassed ? t('انتهى وقت قبول الحجوزات لهذه الخدمة.') : `${t('تحتاج هذه الخدمة إلى')} ${dur(info.requiredMinutes)} ${t('قبل الموعد، والمتبقي')} ${dur(info.remainingMinutes)}.`}</p>
      <button type="button" onClick={() => onRequest(info)} className="rounded-lg border border-amber-700 bg-white px-3 py-1.5 font-bold text-amber-950 hover:bg-amber-100">{info.canRequestException ? t('اختر موعداً آخر أو اطلب استثناء') : t('تفاصيل المدة المطلوبة')}</button>
    </div>
  );
}
