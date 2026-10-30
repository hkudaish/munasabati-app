'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';
import { card, danger, field, fmt, primary, secondary } from '@/components/exceptions/common';

const STATES: Record<string, string> = { PENDING: 'بانتظار المراجعة', INFO_REQUIRED: 'مطلوب استكمال البيانات', APPROVED: 'معتمد', REJECTED: 'مرفوض', ON_HOLD: 'المراجعة معلقة' };
const TONE: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-900', INFO_REQUIRED: 'bg-sky-100 text-sky-900', APPROVED: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-900', ON_HOLD: 'bg-gray-200 text-gray-800' };
const HIST: Record<string, string> = { REGISTERED: 'تسجيل الحساب', APPROVE: 'اعتماد', REQUEST_INFO: 'طلب استكمال بيانات', REJECT: 'رفض', HOLD: 'تعليق', REOPEN: 'إعادة فتح المراجعة', RESUBMITTED: 'أرسل المورد بياناته', STATUS_CHANGED: 'تغيير الحالة التشغيلية' };

/** The platform's review of vendor accounts: who is waiting, the details to check, and the decision with a reason the vendor will read. */
export default function VendorApprovals() {
  const t = useT();
  const [data, setData] = useState<any>(null), [state, setState] = useState('PENDING'), [error, setError] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => { try { setData(await requestJSON('/api/admin/vendor-approvals?state=' + state)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [state, t]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (vendorId: string, decision: string) => { setBusy(true); setMsg(''); setError(''); try { await requestJSON('/api/admin/vendor-approvals', 'POST', { vendorId, decision, note: notes[vendorId] ?? '' }); setNotes(n => ({ ...n, [vendorId]: '' })); setMsg(t('تم حفظ القرار وإبلاغ المورد.')); await load(); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر حفظ القرار')); } finally { setBusy(false); } };
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <h1 className="font-cairo text-2xl font-black text-saudi-green-950">{t('اعتماد حسابات الموردين')}</h1>
      <p className="text-sm leading-7 text-gray-700">{t('اعتماد الحساب منفصل عن اعتماد نشر كل خدمة. المورد غير المعتمد لا يستطيع نشر خدمات أو استقبال حجوزات.')}</p>
      <div role="tablist" aria-label={t('حالة الاعتماد')} className="flex flex-wrap gap-2">{['PENDING', 'INFO_REQUIRED', 'ON_HOLD', 'REJECTED', 'APPROVED', ''].map(s => <button key={s || 'all'} role="tab" aria-selected={state === s} className={`rounded-full border px-4 py-2 text-sm font-bold ${state === s ? 'border-saudi-green-800 bg-saudi-green-50' : 'border-gray-300 bg-white'}`} onClick={() => setState(s)}>{s ? t(STATES[s]) : t('الكل')}{s && data?.counts?.[s] ? ` (${data.counts[s]})` : ''}</button>)}</div>
      {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">{msg}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {data && !data.vendors.length && <p className={card}>{t('لا توجد حسابات في هذه الحالة.')}</p>}
      {data?.vendors.map((v: any) => (
        <article key={v.vendorId} className={card + ' space-y-3'}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold">{v.businessName}</h2><p className="text-sm text-gray-600">{v.businessNameEn}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[v.state]}`}>{t(STATES[v.state])}</span></div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-gray-600">{t('المسؤول')}</dt><dd>{v.ownerName} <span dir="ltr">{v.contactPhone}</span></dd></div><div><dt className="text-gray-600">{t('المدينة والقسم')}</dt><dd>{v.cityId} · {v.categoryId}</dd></div><div><dt className="text-gray-600">{t('تاريخ التسجيل')}</dt><dd>{fmt(v.createdAt)}</dd></div><div><dt className="text-gray-600">{t('البريد')}</dt><dd dir="ltr">{v.ownerEmail ?? '—'}</dd></div><div><dt className="text-gray-600">{t('الخدمات المسجلة')}</dt><dd>{v.services}</dd></div><div><dt className="text-gray-600">{t('الحالة التشغيلية')}</dt><dd>{v.status}</dd></div></dl>
          {v.bioAr && <p className="text-sm leading-7">{v.bioAr}</p>}
          {v.note && <p className="rounded-lg bg-saudi-sand-100 p-2 text-sm">{t('آخر ملاحظة')}: {v.note}</p>}
          <label className="block text-sm font-bold">{t('سبب القرار (يصل إلى المورد)')}<input className={field + ' mt-1 font-normal'} maxLength={500} value={notes[v.vendorId] ?? ''} onChange={e => setNotes(n => ({ ...n, [v.vendorId]: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-2">
            {v.state !== 'APPROVED' && <button className={primary} disabled={busy} onClick={() => decide(v.vendorId, 'approve')}>{t('اعتماد الحساب')}</button>}
            {v.state !== 'INFO_REQUIRED' && <button className={secondary} disabled={busy || !(notes[v.vendorId] ?? '').trim()} onClick={() => decide(v.vendorId, 'request_info')}>{t('طلب استكمال البيانات')}</button>}
            {v.state !== 'ON_HOLD' && <button className={secondary} disabled={busy || !(notes[v.vendorId] ?? '').trim()} onClick={() => decide(v.vendorId, 'hold')}>{t('تعليق المراجعة')}</button>}
            {v.state !== 'REJECTED' && <button className={danger} disabled={busy || !(notes[v.vendorId] ?? '').trim()} onClick={() => decide(v.vendorId, 'reject')}>{t('رفض')}</button>}
            {['REJECTED', 'ON_HOLD', 'INFO_REQUIRED'].includes(v.state) && <button className={secondary} disabled={busy} onClick={() => decide(v.vendorId, 'reopen')}>{t('إعادة فتح المراجعة')}</button>}
          </div>
          {v.history?.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-bold">{t('السجل')}</summary><ul className="mt-2 space-y-1">{v.history.map((h: any, i: number) => <li key={i} className="border-s-4 border-saudi-sand-300 ps-3">{t(HIST[h.action] ?? h.action)}{h.to ? ` → ${t(STATES[h.to] ?? h.to)}` : ''} · {fmt(h.at)}{h.by ? ` · ${h.by}` : ''}{h.note ? ` — ${h.note}` : ''}</li>)}</ul></details>}
        </article>
      ))}
    </div>
  );
}
