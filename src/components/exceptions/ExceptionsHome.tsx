'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/i18n/Link';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

import { PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '@/lib/exceptions/machine';
import { Countdown, StatusBadge, card, field, fmt, primary, riyals, secondary, useDuration } from './common';

const APPROVAL: Record<string, string> = { NONE: '—', PENDING: 'بانتظار القرار', APPROVED: 'معتمد', REJECTED: 'مرفوض' };
const PAYMENT: Record<string, string> = { NONE: '—', PENDING: 'بانتظار الدفع', DONE: 'مكتمل' };
// the dashboard counters: what each one counts and the filter it applies when pressed
const CARDS: { key: string; label: string; filter: Record<string, string> }[] = [
  { key: 'total', label: 'إجمالي طلبات الاستثناء', filter: {} },
  { key: 'submitted', label: 'الطلبات الجديدة', filter: { status: 'submitted' } },
  { key: 'underReview', label: 'قيد المراجعة', filter: { status: 'under_review,information_required' } },
  { key: 'awaitingProvider', label: 'بانتظار موافقة المورد', filter: { status: 'awaiting_provider_approval' } },
  { key: 'feasibilityApproved', label: 'حصلت على موافقة تشغيلية', filter: { status: 'feasibility_approved,assigned_to_coordinator,negotiating,offer_prepared,awaiting_customer_approval,customer_approved,awaiting_payment,confirmed,completed' } },
  { key: 'awaitingPrice', label: 'بانتظار تحديد السعر', filter: { status: 'feasibility_approved,assigned_to_coordinator,offer_prepared' } },
  { key: 'negotiating', label: 'قيد التفاوض', filter: { status: 'negotiating' } },
  { key: 'awaitingCustomer', label: 'بانتظار موافقة العميل', filter: { status: 'awaiting_customer_approval' } },
  { key: 'awaitingPayment', label: 'بانتظار الدفع', filter: { status: 'customer_approved,awaiting_payment' } },
  { key: 'confirmed', label: 'الطلبات المؤكدة', filter: { status: 'confirmed,completed' } },
  { key: 'rejected', label: 'الطلبات المرفوضة', filter: { status: 'rejected,execution_unavailable,customer_declined' } },
  { key: 'cancelled', label: 'الطلبات الملغاة', filter: { status: 'cancelled' } },
  { key: 'late', label: 'الطلبات المتأخرة', filter: { late: '1' } },
  { key: 'reschedule', label: 'طلبات تعديل المواعيد', filter: { kind: 'RESCHEDULE' } },
];

export default function ExceptionsHome({ admin = false }: { admin?: boolean }) {
  const t = useT(), dur = useDuration();
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Record<string, string>>({}), [q, setQ] = useState(''), [sort, setSort] = useState('createdAt'), [coordinators, setCoordinators] = useState<any[]>([]);
  const query = useCallback(() => { const p = new URLSearchParams({ stats: '1', limit: '100', sort, ...filter }); if (q.trim()) p.set('q', q.trim()); return p; }, [filter, q, sort]);
  const load = useCallback(async () => { try { setData(await requestJSON('/api/exceptions?' + query().toString())); setError(''); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [query, t]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 60000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { if (data?.staff) requestJSON('/api/exceptions/coordinators').then(r => setCoordinators(r.coordinators)).catch(() => { }); }, [data?.staff]);
  const sweep = async () => { try { const r = await requestJSON('/api/exceptions/sweep', 'POST', {}); setNotice(r.result.disabled ? t('الميزة غير مفعلة حالياً.') : `${t('تم الفحص')}: ${r.result.offersExpired} ${t('عروض منتهية')}، ${r.result.escalated} ${t('تصعيدات')}.`); await load(); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التنفيذ')); } };
  const setF = (k: string, v: string) => setFilter(x => { const n = { ...x }; if (v) n[k] = v; else delete n[k]; return n; });

  if (!data) return <div className="mx-auto max-w-6xl p-4 sm:p-8">{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p> : <p>{t('جارٍ التحميل…')}</p>}</div>;
  const rows: any[] = data.requests, staff = data.staff, stats = data.stats;
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cairo text-2xl font-black text-saudi-green-950">{staff ? t('إدارة طلبات الاستثناء وتعديل المواعيد') : t('طلبات الاستثناء وتعديل المواعيد')}</h1>
        <div className="flex flex-wrap gap-2">{staff && admin && <button className={secondary} onClick={sweep}>{t('تشغيل فحص المهل الآن')}</button>}{staff && <a className={secondary} href={'/api/exceptions/export?' + query().toString()}>{t('تصدير CSV')}</a>}</div>
      </div>
      {!staff && <p className="text-sm leading-7 text-gray-700">{t('هنا تتابع طلبات الاستثناء من مدة الحجز المسبق وطلبات تعديل مواعيد الحجوزات. لا يتأكد أي حجز إلا بعد موافقة مقدم الخدمة واعتمادك للسعر النهائي وإتمام الدفع.')}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}

      {staff && stats && <section aria-label={t('المؤشرات')} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {CARDS.map(c => { const active = JSON.stringify(filter) === JSON.stringify(c.filter) && !(c.key === 'total' && Object.keys(filter).length); return <button key={c.key} type="button" aria-pressed={active} onClick={() => setFilter(c.filter)} className={`rounded-xl border p-3 text-start ${active ? 'border-saudi-green-800 bg-saudi-green-50 ring-1 ring-saudi-green-800' : 'border-saudi-sand-300 bg-white hover:bg-gray-50'} ${c.key === 'late' && stats.late ? 'border-red-300' : ''}`}><span className={`block text-2xl font-black ${c.key === 'late' && stats.late ? 'text-red-700' : 'text-saudi-green-950'}`}>{stats[c.key] ?? 0}</span><span className="block text-xs leading-5 text-gray-700">{t(c.label)}</span></button>; })}
      </section>}

      {staff && <form className={card + ' grid gap-3 sm:grid-cols-2 lg:grid-cols-4'} onSubmit={e => { e.preventDefault(); void load(); }} role="search" aria-label={t('بحث وتصفية')}>
        <label className="block text-sm">{t('بحث')}<input className={field + ' mt-1'} value={q} onChange={e => setQ(e.target.value)} placeholder={t('الرقم أو العميل أو الخدمة')} /></label>
        <label className="block text-sm">{t('النوع')}<select className={field + ' mt-1'} value={filter.kind ?? ''} onChange={e => setF('kind', e.target.value)}><option value="">{t('الكل')}</option><option value="NOTICE">{t('استثناء')}</option><option value="RESCHEDULE">{t('تعديل موعد')}</option></select></label>
        <label className="block text-sm">{t('الحالة')}<select className={field + ' mt-1'} value={filter.status && !filter.status.includes(',') ? filter.status : ''} onChange={e => setF('status', e.target.value)}><option value="">{t('كل الحالات')}</option>{STATUSES.map(s => <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>)}</select></label>
        <label className="block text-sm">{t('المنسق')}<select className={field + ' mt-1'} value={filter.coordinatorId ?? ''} onChange={e => setF('coordinatorId', e.target.value)}><option value="">{t('الكل')}</option>{coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">{t('من تاريخ')}<input type="date" className={field + ' mt-1'} value={filter.from ?? ''} onChange={e => setF('from', e.target.value)} /></label>
        <label className="block text-sm">{t('إلى تاريخ')}<input type="date" className={field + ' mt-1'} value={filter.to ?? ''} onChange={e => setF('to', e.target.value)} /></label>
        <label className="block text-sm">{t('الترتيب')}<select className={field + ' mt-1'} value={sort} onChange={e => setSort(e.target.value)}><option value="createdAt">{t('الأحدث')}</option><option value="dueAt">{t('الأقرب مهلة')}</option><option value="startAt">{t('الأقرب موعداً')}</option><option value="priority">{t('الأعلى أولوية')}</option><option value="updatedAt">{t('آخر تحديث')}</option></select></label>
        <div className="flex items-end gap-2"><button className={primary}>{t('تطبيق')}</button><button type="button" className={secondary} onClick={() => { setFilter({}); setQ(''); }}>{t('مسح')}</button></div>
      </form>}

      {!rows.length && <p className={card + ' text-gray-700'}>{staff ? t('لا توجد طلبات مطابقة.') : t('لا توجد طلبات حتى الآن. يظهر هنا أي طلب استثناء أو تعديل موعد تقدمه.')}</p>}

      {staff ? rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-saudi-sand-300 bg-white">
          <table className="min-w-[1200px] w-full text-sm">
            <caption className="sr-only">{t('طلبات الاستثناء وتعديل المواعيد')}</caption>
            <thead className="bg-saudi-sand-100 text-start"><tr>{['الرقم', 'النوع', 'العميل', 'المورد', 'الخدمة', 'المدينة', 'الموعد المطلوب', 'المتبقي', 'السعر الأصلي', 'سعر العرض', 'الموافقة التشغيلية', 'اعتماد العميل', 'الدفع', 'المنسق', 'الإنشاء', 'آخر تحديث', 'الحالة'].map(h => <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 text-start font-bold">{t(h)}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.id} className={`border-t align-top ${r.late ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2"><Link className="font-mono underline" dir="ltr" href={`/exceptions/${r.id}`}>{r.number}</Link></td>
              <td className="px-3 py-2">{r.kind === 'RESCHEDULE' ? t('تعديل موعد') : t('استثناء')}</td>
              <td className="px-3 py-2">{r.customerName}</td><td className="px-3 py-2">{r.vendorName ?? t('المنصة')}</td><td className="px-3 py-2">{r.titleAr}</td><td className="px-3 py-2">{r.cityId}</td>
              <td className="whitespace-nowrap px-3 py-2" dir="ltr">{r.requestedDate} {r.requestedTime}</td>
              <td className="whitespace-nowrap px-3 py-2">{r.remainingMinutes > 0 ? dur(r.remainingMinutes) : t('انقضى')}</td>
              <td className="px-3 py-2" dir="ltr">{riyals(r.originalTotal)}</td><td className="px-3 py-2" dir="ltr">{riyals(r.offerTotal)}</td>
              <td className="px-3 py-2">{t(APPROVAL[r.feasibilityStatus])}</td><td className="px-3 py-2">{t(APPROVAL[r.customerApprovalStatus])}</td><td className="px-3 py-2">{t(PAYMENT[r.paymentStatus])}</td>
              <td className="px-3 py-2">{r.coordinatorName ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">{fmt(r.createdAt)}</td><td className="whitespace-nowrap px-3 py-2">{fmt(r.updatedAt)}</td>
              <td className="px-3 py-2"><StatusBadge status={r.status} />{r.late && <span className="mt-1 block text-xs font-bold text-red-700">{t('متأخر')} · <Countdown iso={r.dueAt} /></span>}{r.priority <= 2 && <span className="mt-1 block text-xs">{t(PRIORITY_LABELS[r.priority as 1])}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">{rows.map(r => <li key={r.id}><Link href={`/exceptions/${r.id}`} className={card + ' block space-y-2 hover:bg-gray-50'}>
          <span className="flex flex-wrap items-center justify-between gap-2"><span dir="ltr" className="font-mono text-sm">{r.number}</span><StatusBadge status={r.status} /></span>
          <span className="block font-bold">{r.titleAr}</span>
          <span className="block text-sm text-gray-700">{r.kind === 'RESCHEDULE' ? t('طلب تعديل موعد') : t('طلب استثناء')} · <span dir="ltr">{r.requestedDate} {r.requestedTime}</span>{r.dueAt && !['completed', 'rejected', 'cancelled', 'customer_declined', 'execution_unavailable'].includes(r.status) && <> · <Countdown iso={r.dueAt} /></>}</span>
          {r.status === 'awaiting_customer_approval' && <span className="block text-sm font-bold text-sky-900">{t('بانتظار اعتمادك للسعر النهائي')}</span>}
          {r.status === 'awaiting_payment' && <span className="block text-sm font-bold text-sky-900">{t('اعتمدت العرض — أكمل الدفع لتأكيد الحجز')}</span>}
        </Link></li>)}</ul>
      )}
    </div>
  );
}
