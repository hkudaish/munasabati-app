'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/i18n/Link';
import { useRouter } from 'next/navigation';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

import { ACTION_LABELS, ExceptionAction, PRIORITY_LABELS, STAGE_LABELS, STATUS_LABELS, offerTotals } from '@/lib/exceptions/machine';
import { OFFER_ACCEPT_TEXT } from '@/lib/exceptions/texts';
import { Countdown, StatusBadge, Stepper, card, danger, field, fmt, primary, riyals, secondary, useDuration } from './common';

type F = Record<string, string>;
const OFFER_STATUS: Record<string, string> = { DRAFT: 'مسودة', SENT: 'بانتظار قرارك', ACCEPTED: 'معتمد', DECLINED: 'مرفوض', EXPIRED: 'منتهي', SUPERSEDED: 'استُبدل بإصدار أحدث', WITHDRAWN: 'مسحوب' };
const STEP_STATUS: Record<string, string> = { PENDING: 'بانتظار القرار', APPROVED: 'تمت الموافقة', REJECTED: 'مرفوض', SUPERSEDED: 'أُلغي' };
const APPROVER: Record<string, string> = { PROVIDER: 'مقدم الخدمة', PLATFORM: 'إدارة المنصة', CUSTOMER: 'العميل', SYSTEM: 'النظام' };
const ROLE: Record<string, string> = { customer: 'العميل', provider: 'مقدم الخدمة', platform: 'إدارة المنصة', supervisor: 'مشرف الحجوزات', coordinator: 'المنسق', system: 'النظام' };
const CHANNEL: Record<string, string> = { PHONE: 'اتصال هاتفي', WHATSAPP: 'واتساب', SMS: 'رسالة نصية', EMAIL: 'بريد إلكتروني', NOTE: 'ملاحظة داخلية' };
const PARTY: Record<string, string> = { CUSTOMER: 'العميل', VENDOR: 'المورد', INTERNAL: 'داخلي' };
const NEXT: Record<string, string> = {
  awaiting_provider_approval: 'ينتظر الطلب موافقة مقدم الخدمة على إمكانية التنفيذ. هذه موافقة مبدئية ولا تعني تأكيد الحجز.',
  information_required: 'نحتاج منك معلومات إضافية لمتابعة الطلب.', alternative_proposed: 'اقترح مقدم الخدمة موعداً بديلاً. اقبله أو ارفضه.',
  feasibility_approved: 'وافق مقدم الخدمة مبدئياً. سيُسند الطلب إلى منسق لتحديد السعر والموعد النهائيين.', assigned_to_coordinator: 'أُسند الطلب إلى منسق سيتواصل معك لتحديد الموعد والسعر النهائيين.',
  negotiating: 'يتفاوض المنسق مع مقدم الخدمة لتحديد الموعد والسعر النهائيين.', offer_prepared: 'يجهّز المنسق العرض النهائي لإرساله إليك.',
  awaiting_customer_approval: 'راجع العرض النهائي أدناه ثم اعتمده أو ارفضه.', customer_approved: 'اعتمدت العرض.', awaiting_payment: 'اعتمدت العرض. لا يُؤكد الحجز إلا بعد استيفاء الدفعة المطلوبة قبل انتهاء المهلة.',
  offer_expired: 'انتهت صلاحية العرض. يمكن للمنسق إعادة فتح التفاوض وإصدار عرض جديد.', completed: 'اكتمل الطلب وتم تأكيد الحجز بالموعد والسعر المعتمدين.',
  rejected: 'رُفض الطلب. إن كان لك حجز أصلي فهو ما زال ساريًا بشروطه.', customer_declined: 'رفضت العرض. إن كان لك حجز أصلي فهو ما زال ساريًا بشروطه.', cancelled: 'أُلغي الطلب.', execution_unavailable: 'تعذر تنفيذ الخدمة في الموعد المطلوب.',
};

export default function ExceptionDetail({ id }: { id: string }) {
  const t = useT(), dur = useDuration(), router = useRouter();
  const [d, setD] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [f, setF] = useState<F>({ channel: 'PHONE', party: 'CUSTOMER', priority: '3' }), [coordinators, setCoordinators] = useState<any[]>([]);
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }));
  const load = useCallback(async () => { try { setD(await requestJSON('/api/exceptions/' + id)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [id, t]);
  useEffect(() => { void load(); }, [load]);
  const can = (a: ExceptionAction | string) => !!d?.actions.some((x: any) => x.action === a);
  useEffect(() => { if (d && (can('ASSIGN') || can('REASSIGN'))) requestJSON('/api/exceptions/coordinators').then(r => setCoordinators(r.coordinators)).catch(() => { }); }, [d?.request.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: string, extra: Record<string, unknown> = {}, done?: string) => {
    setBusy(true); setNotice(''); setError('');
    try { await requestJSON('/api/exceptions/' + id, 'POST', { action, version: d.request.version, note: f.note ?? '', ...extra }); setF(x => ({ channel: x.channel, party: x.party, priority: x.priority })); setNotice(done ?? t('تم تنفيذ الإجراء.')); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('تعذر تنفيذ الإجراء')); await load(); } finally { setBusy(false); }
  };
  const toCart = async () => { setBusy(true); setError(''); try { await requestJSON(`/api/exceptions/${id}/cart`, 'POST'); window.dispatchEvent(new Event('commerce-cart-updated')); router.push('/commerce/cart'); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر إضافة الحجز إلى السلة')); setBusy(false); } };

  if (!d) return <div className="mx-auto max-w-4xl p-4 sm:p-8">{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p> : <p>{t('جارٍ التحميل…')}</p>}</div>;
  const r = d.request, s = d.summary, offers: any[] = d.offers, staff = d.isStaff, isCustomer = d.isCustomer;
  const sent = offers.find(o => o.status === 'SENT'), accepted = offers.find(o => o.status === 'ACCEPTED'), draft = offers.find(o => o.status === 'DRAFT');
  const price = r.body.priceInfo ?? {}, base = r.kind === 'RESCHEDULE' ? price.currentSubtotal : price.subtotal;
  let preview: ReturnType<typeof offerTotals> | null = null; try { if (base !== undefined) preview = offerTotals({ baseAmount: base, exceptionFee: Math.round(Number(f.fee || 0) * 100), discount: Math.round(Number(f.discount || 0) * 100), vatBps: price.taxBps ?? 1500 }); } catch { preview = null; }
  const expired = sent && +new Date(sent.expiresAt) <= Date.now();
  const alt = r.body.alternative;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-gray-600"><Link href="/exceptions" className="underline">{t('طلبات الاستثناء وتعديل المواعيد')}</Link></p>
          <h1 className="font-cairo text-2xl font-black text-saudi-green-950">{r.kind === 'RESCHEDULE' ? t('طلب تعديل موعد') : t('طلب استثناء من مدة الحجز المسبق')}</h1>
          <p className="text-gray-800"><span dir="ltr" className="font-mono">{r.number}</span> — {r.body.titleAr}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <Stepper stage={s.stage} status={r.status} />
      <p role="status" className={`${card} bg-saudi-sand-100 leading-8`}>{isCustomer ? t(NEXT[r.status] ?? STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]) : t(STATUS_LABELS[r.status as keyof typeof STATUS_LABELS])}{r.dueAt && !['completed', 'rejected', 'cancelled', 'customer_declined', 'execution_unavailable'].includes(r.status) && <> — {t('المهلة')}: <Countdown iso={r.dueAt} /></>}</p>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}

      {r.status === 'information_required' && r.body.infoRequest && <section className={card + ' space-y-3 border-amber-300 bg-amber-50'}><h2 className="font-bold">{t('المطلوب منك')}</h2><p>{r.body.infoRequest.note}</p>{can('PROVIDE_INFO') && <><label className="block text-sm font-bold">{t('معلوماتك')}<textarea rows={3} maxLength={2000} className={field + ' mt-1 font-normal'} value={f.info ?? ''} onChange={e => set('info', e.target.value)} /></label><button className={primary} disabled={busy || !(f.info ?? '').trim()} onClick={() => run('PROVIDE_INFO', { info: f.info })}>{t('إرسال المعلومات')}</button></>}</section>}
      {r.status === 'alternative_proposed' && alt && <section className={card + ' space-y-3 border-amber-300 bg-amber-50'}><h2 className="font-bold">{t('موعد بديل مقترح')}</h2><p dir="ltr" className="font-bold">{alt.date} {alt.time}</p>{alt.note && <p>{alt.note}</p>}{can('ACCEPT_ALTERNATIVE') && <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy} onClick={() => run('ACCEPT_ALTERNATIVE')}>{t('قبول الموعد البديل')}</button><button className={danger} disabled={busy} onClick={() => run('DECLINE_ALTERNATIVE')}>{t('رفض الموعد البديل')}</button></div>}</section>}

      <section className={card + ' space-y-3'} aria-labelledby="facts"><h2 id="facts" className="font-bold">{t('تفاصيل الطلب')}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-600">{t('الخدمة')}</dt><dd className="font-bold">{r.body.titleAr}</dd></div>
          <div><dt className="text-gray-600">{t('مقدم الخدمة')}</dt><dd className="font-bold">{s.vendorName ?? t('منصة مناسبتي')}</dd></div>
          <div><dt className="text-gray-600">{r.kind === 'RESCHEDULE' ? t('الموعد الجديد المطلوب') : t('موعد التنفيذ المطلوب')}</dt><dd className="font-bold" dir="ltr">{r.requestedDate} {r.requestedTime}</dd></div>
          {r.kind === 'RESCHEDULE' && <div><dt className="text-gray-600">{t('الموعد الحالي للحجز')}</dt><dd className="font-bold">{fmt(r.originalStartAt)}</dd></div>}
          <div><dt className="text-gray-600">{t('المدة المسبقة المعتمدة')}</dt><dd className="font-bold">{dur(r.requiredNoticeMinutes)}</dd></div>
          <div><dt className="text-gray-600">{t('المتبقي وقت التقديم')}</dt><dd className="font-bold">{dur(r.remainingNoticeMinutes)}</dd></div>
          <div><dt className="text-gray-600">{t('السبب')}</dt><dd>{r.reason}</dd></div>
          <div><dt className="text-gray-600">{t('الحاجة العاجلة')}</dt><dd>{r.urgencyDetails}</dd></div>
          {r.customerNotes && <div><dt className="text-gray-600">{t('ملاحظات العميل')}</dt><dd>{r.customerNotes}</dd></div>}
          {r.body.occasion?.date && <div><dt className="text-gray-600">{t('موعد المناسبة')}</dt><dd dir="ltr">{r.body.occasion.date} {r.body.occasion.time}</dd></div>}
          <div><dt className="text-gray-600">{t('تاريخ الطلب')}</dt><dd>{fmt(r.createdAt)}</dd></div>
          {staff && <><div><dt className="text-gray-600">{t('العميل')}</dt><dd className="font-bold">{s.customerName} <span dir="ltr" className="font-normal">{r.customerPhone}</span></dd></div><div><dt className="text-gray-600">{t('المنسق')}</dt><dd>{s.coordinatorName ?? t('لم يُسند بعد')}</dd></div><div><dt className="text-gray-600">{t('الأولوية')}</dt><dd>{t(PRIORITY_LABELS[r.priority as 1])}</dd></div></>}
          {r.bookingRequestId && <div><dt className="text-gray-600">{t('الحجز المرتبط')}</dt><dd><Link className="underline" href="/commerce/orders">{t('عرض الطلبات والحجوزات')}</Link></dd></div>}
        </dl>
      </section>

      {offers.length > 0 && <section className="space-y-3" aria-labelledby="offers"><h2 id="offers" className="font-bold">{t('عروض السعر النهائي')}</h2>
        {offers.map(o => {
          const diff = o.total - o.previousTotal;
          return <article key={o.id} className={card + ' space-y-3'}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{t('الإصدار')} {o.version}</h3><span className="rounded-full bg-saudi-sand-100 px-3 py-1 text-xs font-bold">{t(OFFER_STATUS[o.status] ?? o.status)}</span></div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-gray-600">{t('الموعد المتفق عليه')}</dt><dd className="font-bold" dir="ltr">{o.terms.date} {o.terms.time}</dd></div>
              {o.expiresAt && <div><dt className="text-gray-600">{t('صلاحية العرض')}</dt><dd>{fmt(o.expiresAt)} {o.status === 'SENT' && <>(<Countdown iso={o.expiresAt} />)</>}</dd></div>}
            </dl>
            <table className="w-full text-sm"><tbody>
              <tr><td className="py-1">{t('السعر الأساسي')}</td><td className="text-end" dir="ltr">{riyals(o.baseAmount)}</td></tr>
              <tr><td className="py-1">{t('رسوم الاستثناء')}</td><td className="text-end" dir="ltr">{riyals(o.exceptionFee)}</td></tr>
              {o.discount > 0 && <tr><td className="py-1">{t('الخصم')}</td><td className="text-end" dir="ltr">−{riyals(o.discount)}</td></tr>}
              <tr><td className="py-1">{t('ضريبة القيمة المضافة')}</td><td className="text-end" dir="ltr">{riyals(o.vatAmount)}</td></tr>
              <tr className="border-t font-bold"><td className="py-1">{t('السعر الإجمالي النهائي (ر.س)')}</td><td className="text-end" dir="ltr">{riyals(o.total)}</td></tr>
              {r.kind === 'RESCHEDULE' && <tr><td className="py-1">{t('الفرق عن سعر الحجز الحالي')}</td><td className="text-end" dir="ltr">{riyals(Math.max(0, diff))}</td></tr>}
            </tbody></table>
            <div className="space-y-1 text-sm text-gray-800"><p><strong>{t('الدفع')}:</strong> {o.terms.paymentAr}</p><p><strong>{t('الإلغاء')}:</strong> {o.terms.cancellationAr}</p><p><strong>{t('التعديل')}:</strong> {o.terms.modificationAr}</p>{o.terms.noteAr && <p>{o.terms.noteAr}</p>}</div>
            {isCustomer && o.status === 'SENT' && o.id === sent?.id && !expired && can('CUSTOMER_ACCEPT') && (
              <div className="space-y-3 rounded-xl bg-saudi-sand-100 p-3">
                <p className="text-sm leading-7">{t(OFFER_ACCEPT_TEXT)}</p>
                <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0" checked={f.confirm === '1'} onChange={e => set('confirm', e.target.checked ? '1' : '')} />{t('أوافق صراحةً على هذا العرض بسعره النهائي وموعده وشروطه')}</label>
                <label className="block text-sm">{t('ملاحظة (اختياري)')}<input className={field + ' mt-1'} maxLength={500} value={f.decisionNote ?? ''} onChange={e => set('decisionNote', e.target.value)} /></label>
                <div className="flex flex-wrap gap-3">
                  <button className={primary} disabled={busy || f.confirm !== '1'} onClick={() => run('CUSTOMER_ACCEPT', { offerVersion: o.version, confirm: true })}>{t('اعتماد العرض')}</button>
                  <button className={secondary} disabled={busy} onClick={() => run('CUSTOMER_RENEGOTIATE', { offerVersion: o.version, note: f.decisionNote ?? '' })}>{t('طلب إعادة التفاوض')}</button>
                  <button className={danger} disabled={busy} onClick={() => run('CUSTOMER_DECLINE', { offerVersion: o.version, note: f.decisionNote ?? '' })}>{t('رفض العرض')}</button>
                </div>
              </div>)}
            {isCustomer && o.status === 'SENT' && expired && <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900">{t('انتهت صلاحية هذا العرض.')}</p>}
          </article>;
        })}
      </section>}

      {isCustomer && r.status === 'awaiting_payment' && accepted && <section className={card + ' space-y-3 border-sky-300 bg-sky-50'}><h2 className="font-bold">{t('الخطوة التالية: الدفع')}</h2>
        {r.body.paymentDueAt && <p>{t('المهلة')}: {fmt(r.body.paymentDueAt)} (<Countdown iso={r.body.paymentDueAt} />)</p>}
        {r.kind === 'NOTICE' ? <><p className="text-sm leading-7">{t('أضف الحجز المعتمد إلى سلتك، وسيُحتسب بالسعر المتفق عليه نفسه، ثم أكمل الشراء وسدّد الدفعة المطلوبة. يتأكد الحجز بعد اعتماد الإدارة للدفع.')}</p><button className={primary} disabled={busy} onClick={toCart}>{t('متابعة الحجز والدفع')}</button></>
          : <><p className="text-sm leading-7">{t('يبقى حجزك على موعده الحالي حتى يكتمل سداد فرق السعر، ثم يُطبّق الموعد الجديد تلقائياً. حوّل المبلغ وسجّله مع إدارة المنصة من صفحة الطلبات.')}</p><p className="font-bold" dir="ltr">{riyals(Math.max(0, accepted.total - accepted.previousTotal))}</p><Link href="/commerce/orders" className={primary + ' inline-block'}>{t('الطلبات والمدفوعات')}</Link></>}
      </section>}

      {(staff || d.isProvider) && <StaffPanel d={d} f={f} set={set} run={run} busy={busy} coordinators={coordinators} preview={preview} draft={draft} can={can} />}

      {can('CANCEL') && <section className={card + ' space-y-3'}><h2 className="font-bold">{t('إلغاء الطلب')}</h2><label className="block text-sm">{t('السبب')}{!isCustomer && ' *'}<input className={field + ' mt-1'} maxLength={500} value={f.cancelNote ?? ''} onChange={e => set('cancelNote', e.target.value)} /></label><button className={danger} disabled={busy || (!isCustomer && !(f.cancelNote ?? '').trim())} onClick={() => { if (window.confirm(t('هل تريد إلغاء هذا الطلب؟'))) void run('CANCEL', { note: f.cancelNote ?? '' }); }}>{t('إلغاء الطلب')}</button></section>}

      <section className={card + ' space-y-3'} aria-labelledby="steps"><h2 id="steps" className="font-bold">{t('الموافقات')}</h2>
        <ul className="space-y-2 text-sm">{d.steps.map((x: any) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-saudi-sand-100 p-2"><span><strong>{t(STAGE_LABELS[x.stage as keyof typeof STAGE_LABELS])}</strong> — {t(APPROVER[x.approverType])}</span><span>{t(STEP_STATUS[x.status])}{x.decidedAt && <> · {fmt(x.decidedAt)}</>}{x.note && <> · {x.note}</>}</span></li>)}</ul>
      </section>

      <section className={card + ' space-y-3'} aria-labelledby="timeline"><h2 id="timeline" className="font-bold">{t('سجل الإجراءات')}</h2>
        <ol className="space-y-2 text-sm">{d.events.map((e: any) => <li key={e.id} className="border-s-4 border-saudi-sand-300 ps-3"><p className="font-bold">{t(ACTION_LABELS[e.action as ExceptionAction] ?? e.action)}{e.toStatus && e.toStatus !== e.fromStatus && <> → {t(STATUS_LABELS[e.toStatus as keyof typeof STATUS_LABELS] ?? e.toStatus)}</>}</p><p className="text-gray-600">{fmt(e.createdAt)} · {e.actorName ?? t(ROLE[e.actorRole] ?? e.actorRole)} ({t(ROLE[e.actorRole] ?? e.actorRole)}){e.body?.note ? ` — ${e.body.note}` : ''}</p></li>)}</ol>
      </section>

      {staff && d.consents.length > 0 && <section className={card + ' space-y-2'}><h2 className="font-bold">{t('إقرارات العميل')}</h2><ul className="space-y-2 text-sm">{d.consents.map((c: any) => <li key={c.id} className="rounded-lg bg-saudi-sand-100 p-2"><p className="font-bold">{c.kind}{c.offerVersion ? ` — v${c.offerVersion}` : ''} · {fmt(c.createdAt)}</p><p>{c.text}</p></li>)}</ul></section>}
    </div>
  );
}

/** What providers, coordinators, supervisors and administrators can do on a request, shown only if the server allows it for them now. */
function StaffPanel({ d, f, set, run, busy, coordinators, preview, draft, can }: any) {
  const t = useT(), r = d.request;
  const note = (k = 'note') => <label className="block text-sm">{t('ملاحظة')}<input className={field + ' mt-1'} maxLength={1000} value={f[k] ?? ''} onChange={e => set(k, e.target.value)} /></label>;
  return (
    <section className={card + ' space-y-5'} aria-labelledby="work"><h2 id="work" className="font-bold">{t('إجراءات المتابعة')}</h2>
      {d.tasks?.length > 0 && <p className="text-sm">{t('مهمة المنسق')}: {d.tasks[0].coordinatorName ?? '—'} · {t('المهلة')}: <Countdown iso={d.tasks[0].dueAt} />{d.tasks[0].escalationLevel > 0 && <strong className="text-red-700"> · {t('مستوى التصعيد')} {d.tasks[0].escalationLevel}</strong>}</p>}
      {can('APPROVE_FEASIBILITY') && <div className="space-y-2"><h3 className="font-bold">{t('الموافقة التشغيلية على إمكانية التنفيذ')}</h3><p className="text-sm text-gray-700">{t('راجع التوفر والطاقة والمواد والفريق والموقع. هذه موافقة مبدئية ولا تؤكد الحجز.')}</p>{note()}<button className={primary} disabled={busy} onClick={() => run('APPROVE_FEASIBILITY')}>{t('موافقة مبدئية')}</button></div>}
      {can('PROPOSE_ALTERNATIVE') && <div className="space-y-2"><h3 className="font-bold">{t('اقتراح موعد بديل')}</h3><div className="grid grid-cols-2 gap-3"><input type="date" aria-label={t('التاريخ')} className={field} value={f.altDate ?? ''} onChange={e => set('altDate', e.target.value)} /><input type="time" aria-label={t('الوقت')} className={field} value={f.altTime ?? ''} onChange={e => set('altTime', e.target.value)} /></div><button className={secondary} disabled={busy || !f.altDate || !f.altTime} onClick={() => run('PROPOSE_ALTERNATIVE', { date: f.altDate, time: f.altTime })}>{t('اقتراح الموعد')}</button></div>}
      {can('REQUEST_INFO') && <div className="space-y-2"><h3 className="font-bold">{t('طلب معلومات إضافية من العميل')}</h3>{note('infoNote')}<button className={secondary} disabled={busy || !(f.infoNote ?? '').trim()} onClick={() => run('REQUEST_INFO', { note: f.infoNote })}>{t('طلب المعلومات')}</button></div>}
      {(can('REJECT') || can('MARK_UNAVAILABLE')) && <div className="space-y-2"><h3 className="font-bold">{can('REJECT') ? t('رفض الطلب') : t('تعذر التنفيذ')}</h3>{note('rejectNote')}<button className={danger} disabled={busy || !(f.rejectNote ?? '').trim()} onClick={() => run(can('REJECT') ? 'REJECT' : 'MARK_UNAVAILABLE', { note: f.rejectNote })}>{can('REJECT') ? t('رفض مع السبب') : t('تسجيل تعذر التنفيذ')}</button></div>}
      {(can('ASSIGN') || can('REASSIGN')) && <div className="space-y-2"><h3 className="font-bold">{t('إسناد إلى منسق')}</h3><select className={field} value={f.coordinatorId ?? ''} onChange={e => set('coordinatorId', e.target.value)}><option value="">{t('اختر المنسق')}</option>{coordinators.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.open})</option>)}</select><button className={secondary} disabled={busy || !f.coordinatorId} onClick={() => run(can('ASSIGN') ? 'ASSIGN' : 'REASSIGN', { coordinatorId: f.coordinatorId })}>{t('إسناد')}</button></div>}
      {can('START_NEGOTIATION') && <button className={primary} disabled={busy} onClick={() => run('START_NEGOTIATION')}>{t('بدء التفاوض')}</button>}
      {can('REOPEN_NEGOTIATION') && <button className={primary} disabled={busy} onClick={() => run('REOPEN_NEGOTIATION')}>{t('إعادة فتح التفاوض')}</button>}
      {can('PREPARE_OFFER') && <div className="space-y-3"><h3 className="font-bold">{t('إعداد عرض السعر النهائي')}</h3>
        <div className="grid gap-3 sm:grid-cols-4"><label className="block text-sm">{t('التاريخ المتفق عليه')}<input type="date" className={field + ' mt-1'} value={f.offerDate ?? r.requestedDate} onChange={e => set('offerDate', e.target.value)} /></label><label className="block text-sm">{t('الوقت')}<input type="time" className={field + ' mt-1'} value={f.offerTime ?? r.requestedTime} onChange={e => set('offerTime', e.target.value)} /></label><label className="block text-sm">{t('رسوم الاستثناء (ر.س)')}<input type="number" min="0" step="0.01" className={field + ' mt-1'} value={f.fee ?? ''} onChange={e => set('fee', e.target.value)} /></label><label className="block text-sm">{t('خصم من الرسوم (ر.س)')}<input type="number" min="0" step="0.01" className={field + ' mt-1'} value={f.discount ?? ''} onChange={e => set('discount', e.target.value)} /></label></div>
        {preview && <p className="rounded-xl bg-saudi-sand-100 p-3 text-sm">{t('السعر الأساسي')}: <span dir="ltr">{riyals(preview.baseAmount)}</span> + {t('الرسوم')}: <span dir="ltr">{riyals(preview.exceptionFee - preview.discount)}</span> + {t('الضريبة')}: <span dir="ltr">{riyals(preview.vatAmount)}</span> = <strong dir="ltr">{riyals(preview.total)}</strong></p>}
        <label className="block text-sm">{t('شروط الدفع')}<textarea rows={2} className={field + ' mt-1'} value={f.paymentAr ?? ''} onChange={e => set('paymentAr', e.target.value)} /></label>
        <label className="block text-sm">{t('شروط الإلغاء')}<textarea rows={2} className={field + ' mt-1'} value={f.cancellationAr ?? ''} onChange={e => set('cancellationAr', e.target.value)} /></label>
        <label className="block text-sm">{t('شروط التعديل')}<textarea rows={2} className={field + ' mt-1'} value={f.modificationAr ?? ''} onChange={e => set('modificationAr', e.target.value)} /></label>
        <button className={primary} disabled={busy} onClick={() => run('PREPARE_OFFER', { date: f.offerDate ?? r.requestedDate, time: f.offerTime ?? r.requestedTime, exceptionFee: Math.round(Number(f.fee || 0) * 100), discount: Math.round(Number(f.discount || 0) * 100), paymentAr: f.paymentAr, cancellationAr: f.cancellationAr, modificationAr: f.modificationAr })}>{draft ? t('إعداد إصدار جديد') : t('حفظ العرض')}</button></div>}
      {can('APPROVE_OFFER') && draft && <button className={secondary} disabled={busy} onClick={() => run('APPROVE_OFFER')}>{t('اعتماد العرض كمشرف')}</button>}
      {can('SEND_OFFER') && draft && <div className="space-y-2"><h3 className="font-bold">{t('إرسال العرض إلى العميل')}</h3><p className="text-sm">{t('الإصدار')} {draft.version} — <strong dir="ltr">{riyals(draft.total)}</strong>. {t('بعد الإرسال لا يمكن تعديل هذا الإصدار؛ أي تغيير يتطلب إصداراً جديداً.')}</p><button className={primary} disabled={busy} onClick={() => run('SEND_OFFER')}>{t('إرسال العرض')}</button></div>}
      {(d.negotiation?.length > 0 || can('PREPARE_OFFER') || can('START_NEGOTIATION')) && d.isStaff && <div className="space-y-3"><h3 className="font-bold">{t('سجل التواصل والتفاوض')}</h3>
        <ul className="space-y-2 text-sm">{d.negotiation.map((n: any) => <li key={n.id} className="rounded-lg bg-saudi-sand-100 p-2"><strong>{t(CHANNEL[n.channel])} · {t(PARTY[n.party])}</strong> — {n.outcome}<span className="block text-xs text-gray-600">{fmt(n.createdAt)} · {n.actorName}</span></li>)}</ul>
        <div className="grid gap-3 sm:grid-cols-3"><select aria-label={t('القناة')} className={field} value={f.channel} onChange={e => set('channel', e.target.value)}>{Object.keys(CHANNEL).map(k => <option key={k} value={k}>{t(CHANNEL[k])}</option>)}</select><select aria-label={t('الطرف')} className={field} value={f.party} onChange={e => set('party', e.target.value)}>{Object.keys(PARTY).map(k => <option key={k} value={k}>{t(PARTY[k])}</option>)}</select></div>
        <label className="block text-sm">{t('نتيجة التواصل')}<textarea rows={2} className={field + ' mt-1'} value={f.outcome ?? ''} onChange={e => set('outcome', e.target.value)} /></label>
        <button className={secondary} disabled={busy || !(f.outcome ?? '').trim()} onClick={() => run('LOG_CONTACT', { channel: f.channel, party: f.party, outcome: f.outcome })}>{t('تسجيل التواصل')}</button></div>}
      {d.isStaff && d.actors.some((a: string) => ['supervisor', 'platform'].includes(a)) && r.status !== 'completed' && <div className="space-y-2"><h3 className="font-bold">{t('أولوية المتابعة')}</h3><div className="flex flex-wrap gap-3"><select aria-label={t('الأولوية')} className={field + ' max-w-xs'} value={f.priority} onChange={e => set('priority', e.target.value)}>{[1, 2, 3, 4].map(p => <option key={p} value={p}>{t(PRIORITY_LABELS[p as 1])}</option>)}</select><button className={secondary} disabled={busy} onClick={() => run('SET_PRIORITY', { priority: Number(f.priority) })}>{t('تغيير الأولوية')}</button></div></div>}
    </section>
  );
}
