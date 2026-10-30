'use client';
import { useLocale, useT } from '@/components/i18n/LocaleProvider';
import { describeMinutes } from '@/lib/booking/advance-notice';
import { getNumberLocale } from '@/lib/i18n/format';
import { STAGE_LABELS, STAGES, STATUS_LABELS, ExceptionStatus, isFinal } from '@/lib/exceptions/machine';

export const field = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';
export const primary = 'rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600';
export const secondary = 'rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-50';
export const danger = 'rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50';
/** Durations in the page language. */
export const useDuration = () => { const { locale } = useLocale(); return (minutes: number) => describeMinutes(minutes, locale === 'en' ? 'en' : 'ar'); };
export const card = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 sm:p-5';

/** Date and time in Saudi time, in the page language. */
export const fmt = (iso?: string | Date | null) => iso ? new Date(iso).toLocaleString(getNumberLocale(), { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const riyals = (halalas?: number | null) => halalas === null || halalas === undefined ? '—' : (halalas / 100).toLocaleString(getNumberLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TONE: Partial<Record<ExceptionStatus, string>> = {
  completed: 'bg-emerald-100 text-emerald-900', confirmed: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900', customer_declined: 'bg-red-100 text-red-900', execution_unavailable: 'bg-red-100 text-red-900', cancelled: 'bg-gray-200 text-gray-800', offer_expired: 'bg-orange-100 text-orange-900',
  information_required: 'bg-amber-100 text-amber-900', alternative_proposed: 'bg-amber-100 text-amber-900', awaiting_customer_approval: 'bg-sky-100 text-sky-900', awaiting_payment: 'bg-sky-100 text-sky-900',
};
export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${TONE[status as ExceptionStatus] ?? 'bg-saudi-sand-100 text-gray-900'}`}>{t(STATUS_LABELS[status as ExceptionStatus] ?? status)}</span>;
}

/** The three mandatory stages, with the current one marked. A closed-without-success request shows every stage as stopped. */
export function Stepper({ stage, status }: { stage: number; status: string }) {
  const t = useT(), stopped = isFinal(status) && status !== 'completed', done = status === 'completed';
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label={t('مراحل الاعتماد')}>
      {STAGES.map((s, i) => {
        const n = i + 1, state = done || (!stopped && stage > n) ? 'done' : !stopped && stage === n ? 'current' : 'todo';
        return (
          <li key={s} aria-current={state === 'current' ? 'step' : undefined} className={`rounded-xl border p-3 text-sm ${state === 'done' ? 'border-emerald-300 bg-emerald-50' : state === 'current' ? 'border-saudi-green-800 bg-white ring-1 ring-saudi-green-800' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
            <span className="block text-xs">{t('المرحلة')} {n}</span>
            <span className="block font-bold">{t(STAGE_LABELS[s])}</span>
            <span className="block text-xs">{state === 'done' ? t('تمت') : state === 'current' ? t('الحالية') : stopped ? t('متوقفة') : t('لاحقاً')}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** "منذ ساعتين" style helper for deadlines: positive minutes remaining, or how late. */
export function Countdown({ iso }: { iso?: string | Date | null }) {
  const t = useT(), dur = useDuration();
  if (!iso) return null;
  const minutes = Math.round((+new Date(iso) - Date.now()) / 60000), text = dur(Math.max(1, Math.abs(minutes)));
  return <span className={minutes < 0 ? 'font-bold text-red-700' : ''}>{minutes < 0 ? `${t('متأخر')} ${text}` : `${t('خلال')} ${text}`}</span>;
}
