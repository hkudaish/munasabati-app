'use client';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/i18n/Link';
import { requestJSON } from '@/lib/api-client';
import { useApp } from '@/lib/store';
import { useT } from '@/components/i18n/LocaleProvider';
import { useDuration } from './common';

import { EXCEPTION_ACK_TEXT, NOTICE_DIALOG_MESSAGE } from '@/lib/exceptions/texts';

export interface NoticeInfo { requiredMinutes: number; remainingMinutes: number; earliestAt: string; canRequestException: boolean; cutoffPassed?: boolean; blocking?: string[] }
interface Props {
  kind?: 'NOTICE' | 'RESCHEDULE';
  notice: NoticeInfo;
  titleAr: string;
  providerName?: string;
  /** the cart line being booked (kind NOTICE) */
  selection?: Record<string, unknown>;
  /** the confirmed booking being moved (kind RESCHEDULE) */
  bookingRequestId?: string;
  referenceNumber?: string;
  date: string;
  time: string;
  onClose: () => void;
}

const field = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';
const primary = 'rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600';
const secondary = 'rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-gray-900 hover:bg-gray-50';
const REASONS = ['حدث طارئ', 'تغيّر موعد المناسبة', 'قررنا الحجز متأخرين', 'ظرف خاص آخر'];
const riyadh = (iso: string) => new Date(iso).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'full', timeStyle: 'short' });

/**
 * What a customer sees when the time they picked is closer than the service allows: the notice, then (if the service accepts exceptions)
 * the request form, then the reference number. The server decides every part of it again; this screen only explains and collects.
 */
export default function NoticeFlow(p: Props) {
  const t = useT(), dur = useDuration();
  const { currentUser } = useApp();
  const [step, setStep] = useState<'notice' | 'form' | 'done'>('notice');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reasonPick, setReasonPick] = useState(REASONS[0]), [reasonText, setReasonText] = useState('');
  const [urgency, setUrgency] = useState(''), [notes, setNotes] = useState('');
  const [occasionDate, setOccasionDate] = useState(p.date), [occasionTime, setOccasionTime] = useState(p.time);
  const [name, setName] = useState(currentUser?.name ?? ''), [phone, setPhone] = useState((currentUser as any)?.phone ?? ''), [email, setEmail] = useState((currentUser as any)?.email ?? '');
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<{ id: string; number: string; duplicate?: boolean } | null>(null);
  const first = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useEffect(() => { first.current?.focus(); }, [step]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [p]);
  useEffect(() => { box.current?.scrollTo({ top: 0 }); }, [step]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const reason = reasonPick === REASONS[REASONS.length - 1] ? reasonText.trim() : reasonPick + (reasonText.trim() ? ' — ' + reasonText.trim() : '');
      const payload = { kind: p.kind ?? 'NOTICE', ...(p.kind === 'RESCHEDULE' ? { bookingRequestId: p.bookingRequestId, date: p.date, time: p.time } : { selection: p.selection }), reason, urgencyDetails: urgency.trim(), customerNotes: notes.trim(), occasionDate, occasionTime, contact: { name: name.trim(), phone: phone.trim(), email: email.trim() }, acknowledge: ack };
      const r = await requestJSON('/api/exceptions', 'POST', payload);
      setResult({ id: r.request.id, number: r.request.number, duplicate: r.duplicate }); setStep('done');
    } catch (err) { setError(err instanceof Error ? err.message : t('تعذر إرسال الطلب')); } finally { setBusy(false); }
  };

  const required = dur(p.notice.requiredMinutes), left = dur(p.notice.remainingMinutes);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="notice-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div ref={box} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-card sm:p-6">
        {step === 'notice' && (
          <div className="space-y-4">
            <h2 id="notice-title" className="font-cairo text-xl font-black text-saudi-green-950">{p.notice.cutoffPassed ? t('انتهى وقت قبول الحجوزات لهذه الخدمة') : t('هذا الموعد قريب جداً')}</h2>
            {p.notice.cutoffPassed ? <p className="leading-8 text-gray-800">{t('لم تعد هذه الخدمة تستقبل حجوزات جديدة. اختر خدمة أخرى أو تواصل مع المنصة.')}</p> : <div className="space-y-2 leading-8 text-gray-800">{NOTICE_DIALOG_MESSAGE.map(m => <p key={m}>{t(m)}</p>)}</div>}
            {!p.notice.cutoffPassed && (
              <dl className="grid gap-2 rounded-xl bg-saudi-sand-100 p-3 text-sm sm:grid-cols-3">
                <div><dt className="text-gray-600">{t('المدة المسبقة المطلوبة')}</dt><dd className="font-bold">{required}</dd></div>
                <div><dt className="text-gray-600">{t('المتبقي حتى الموعد')}</dt><dd className="font-bold">{left}</dd></div>
                <div><dt className="text-gray-600">{t('أقرب موعد متاح')}</dt><dd className="font-bold">{riyadh(p.notice.earliestAt)}</dd></div>
              </dl>
            )}
            {p.notice.blocking?.length ? <p className="text-sm text-gray-700">{t('الخدمات غير المستوفية للمدة:')} {p.notice.blocking.join(t('، '))}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button ref={first} type="button" className={primary} onClick={p.onClose}>{t('موافق')}</button>
              {p.notice.canRequestException && !p.notice.cutoffPassed && <button type="button" className={secondary} onClick={() => setStep('form')}>{t('طلب استثناء')}</button>}
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submit} className="space-y-4">
            <h2 id="notice-title" className="font-cairo text-xl font-black text-saudi-green-950">{p.kind === 'RESCHEDULE' ? t('طلب استثناء لتعديل الموعد') : t('طلب استثناء من مدة الحجز المسبق')}</h2>
            <dl className="grid gap-2 rounded-xl bg-saudi-sand-100 p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-gray-600">{t('الخدمة')}</dt><dd className="font-bold">{p.titleAr}</dd></div>
              <div><dt className="text-gray-600">{t('مقدم الخدمة')}</dt><dd className="font-bold">{p.providerName || t('منصة مناسبتي')}</dd></div>
              {p.referenceNumber && <div><dt className="text-gray-600">{t('رقم الطلب أو الحجز')}</dt><dd className="font-bold" dir="ltr">{p.referenceNumber}</dd></div>}
              <div><dt className="text-gray-600">{t('موعد التنفيذ المطلوب')}</dt><dd className="font-bold" dir="ltr">{p.date} {p.time}</dd></div>
              <div><dt className="text-gray-600">{t('المدة المسبقة المعتمدة')}</dt><dd className="font-bold">{required}</dd></div>
              <div><dt className="text-gray-600">{t('المدة المتبقية')}</dt><dd className="font-bold">{left}</dd></div>
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">{t('تاريخ المناسبة')}<input type="date" className={field + ' mt-1 font-normal'} value={occasionDate} onChange={e => setOccasionDate(e.target.value)} /></label>
              <label className="block text-sm font-bold">{t('وقت المناسبة')}<input type="time" className={field + ' mt-1 font-normal'} value={occasionTime} onChange={e => setOccasionTime(e.target.value)} /></label>
            </div>
            <label className="block text-sm font-bold">{t('سبب طلب الاستثناء')}
              <select className={field + ' mt-1 font-normal'} value={reasonPick} onChange={e => setReasonPick(e.target.value)}>{REASONS.map(r => <option key={r} value={r}>{t(r)}</option>)}</select>
            </label>
            {reasonPick === REASONS[REASONS.length - 1] && <label className="block text-sm font-bold">{t('اذكر السبب')}<input required maxLength={300} className={field + ' mt-1 font-normal'} value={reasonText} onChange={e => setReasonText(e.target.value)} /></label>}
            <label className="block text-sm font-bold">{t('تفاصيل الحاجة العاجلة')}<textarea required rows={3} maxLength={4000} className={field + ' mt-1 font-normal'} value={urgency} onChange={e => setUrgency(e.target.value)} placeholder={t('ما الذي تغيّر، ولماذا لا يمكن تأجيل الموعد؟')} /></label>
            <label className="block text-sm font-bold">{t('ملاحظات إضافية (اختياري)')}<textarea rows={2} maxLength={2000} className={field + ' mt-1 font-normal'} value={notes} onChange={e => setNotes(e.target.value)} /></label>
            <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-1 text-sm font-bold">{t('بيانات التواصل')}</legend>
              <label className="block text-sm">{t('الاسم')}<input required className={field + ' mt-1'} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
              <label className="block text-sm">{t('رقم الجوال')}<input required dir="ltr" inputMode="tel" className={field + ' mt-1'} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
              <label className="block text-sm">{t('البريد الإلكتروني')}<input dir="ltr" type="email" className={field + ' mt-1'} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
            </fieldset>
            <label className="flex items-start gap-3 rounded-xl border border-saudi-sand-300 p-3 text-sm leading-7"><input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0" checked={ack} onChange={e => setAck(e.target.checked)} required /><span>{t(EXCEPTION_ACK_TEXT)}</span></label>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap gap-3"><button ref={first} className={primary} disabled={busy || !ack}>{busy ? t('جارٍ الإرسال…') : t('إرسال طلب الاستثناء')}</button><button type="button" className={secondary} onClick={() => setStep('notice')}>{t('رجوع')}</button></div>
          </form>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <h2 id="notice-title" className="font-cairo text-xl font-black text-saudi-green-950">{result.duplicate ? t('لديك طلب مماثل قيد المعالجة') : t('تم إرسال طلب الاستثناء')}</h2>
            <p>{t('الرقم المرجعي')}: <strong dir="ltr">{result.number}</strong></p>
            <ol className="list-decimal space-y-1 ps-5 text-sm leading-7 text-gray-800">
              <li>{t('يراجع مقدم الخدمة إمكانية التنفيذ في الموعد المطلوب.')}</li>
              <li>{t('إذا وافق مبدئياً، يتواصل معك منسق لتحديد الموعد والسعر النهائي، وقد يزيد السعر.')}</li>
              <li>{t('لا يُؤكد الحجز ولا تُحمَّل أي رسوم إلا بعد أن تعتمد السعر النهائي وتكمل الدفع.')}</li>
            </ol>
            <div className="flex flex-wrap gap-3"><Link href={`/exceptions/${result.id}`} className={primary + ' inline-block'}>{t('متابعة الطلب')}</Link><button ref={first} type="button" className={secondary} onClick={p.onClose}>{t('إغلاق')}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
