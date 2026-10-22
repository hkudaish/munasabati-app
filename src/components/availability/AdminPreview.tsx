'use client';
import React, { useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { CAPACITY_AR, ENTITY_AR, REASON_AR, STATUS_AR, STATUS_TONE } from './labels';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const INTENTS: [string, string][] = [['BOOK', 'حجز جديد'], ['VIEW', 'تصفح فقط'], ['CONFIRM', 'تأكيد حجز قائم'], ['MODIFY', 'تعديل موعد حجز قائم']];

/** "View as customer": the decision for any place, service, vendor, date and quantity, with the reasoning and, optionally, an unsaved policy applied. */
export default function AdminPreview({ data }: { data: any }) {
  const [f, setF] = useState({ countryCode: '', cityId: '', serviceId: '', offerId: '', vendorId: '', date: '', time: '', quantity: '1', intent: 'BOOK', hypType: '', hypId: '', hypStatus: 'DISABLED' });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cities = data.places.cities.filter((c: any) => !f.countryCode || c.countryCode === f.countryCode);
  const hypEntities: { id: string; name: string }[] = data.entities[f.hypType] ?? [];
  const run = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const hypothetical = f.hypType && f.hypStatus ? [{ entityType: f.hypType, entityId: f.hypType === 'PLATFORM' ? 'platform' : f.hypId, configuredStatus: f.hypStatus, reason: 'معاينة غير محفوظة' }] : [];
      setResult(await requestJSON('/api/system-admin/availability/preview', 'POST', { countryCode: f.countryCode || undefined, cityId: f.cityId || undefined, serviceId: f.offerId ? undefined : f.serviceId || undefined, offerId: f.offerId || undefined, vendorId: f.vendorId || undefined, date: f.date || undefined, time: f.time || undefined, quantity: Number(f.quantity) || 1, intent: f.intent, hypothetical }));
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذرت المعاينة'); } finally { setBusy(false); }
  };
  const d = result?.decision;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <form className="space-y-3 rounded-2xl border bg-white p-4" onSubmit={e => { e.preventDefault(); void run(); }} aria-label="معاينة كعميل">
        <h3 className="font-black">عرض الخدمة كما يراها العميل</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">الدولة<select className={input} value={f.countryCode} onChange={e => setF({ ...f, countryCode: e.target.value, cityId: '' })}><option value="">—</option>{data.places.countries.map((c: any) => <option key={c.code} value={c.code}>{c.nameAr}</option>)}</select></label>
          <label className="text-sm">مدينة الفعالية / التسليم<select className={input} value={f.cityId} onChange={e => setF({ ...f, cityId: e.target.value })}><option value="">غير محددة</option>{cities.map((c: any) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label>
          <label className="col-span-2 text-sm">الخدمة<select className={input} value={f.serviceId} onChange={e => setF({ ...f, serviceId: e.target.value })}><option value="">اختر…</option>{data.entities.SERVICE.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-sm">المورد (اختياري)<select className={input} value={f.vendorId} onChange={e => setF({ ...f, vendorId: e.target.value })}><option value="">حسب الخدمة</option>{data.entities.VENDOR.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="text-sm">معرّف عرض (اختياري)<input className={input} dir="ltr" value={f.offerId} onChange={e => setF({ ...f, offerId: e.target.value })} /></label>
          <label className="text-sm">التاريخ<input className={input} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label className="text-sm">الوقت<input className={input} type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></label>
          <label className="text-sm">الكمية<input className={input} type="number" min={1} value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} /></label>
          <label className="text-sm">العملية<select className={input} value={f.intent} onChange={e => setF({ ...f, intent: e.target.value })}>{INTENTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <fieldset className="space-y-2 rounded-xl bg-slate-50 p-3"><legend className="text-xs font-black">جرّب سياسة غير محفوظة (اختياري)</legend>
          <div className="grid grid-cols-3 gap-2">
            <select aria-label="نطاق السياسة التجريبية" className={input} value={f.hypType} onChange={e => setF({ ...f, hypType: e.target.value, hypId: '' })}><option value="">بلا</option>{['PLATFORM', 'MODULE', 'CATEGORY', 'SERVICE', 'VENDOR'].map(t => <option key={t} value={t}>{ENTITY_AR[t]}</option>)}</select>
            <select aria-label="كيان السياسة التجريبية" className={input} disabled={!f.hypType || f.hypType === 'PLATFORM'} value={f.hypId} onChange={e => setF({ ...f, hypId: e.target.value })}><option value="">—</option>{hypEntities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <select aria-label="حالة السياسة التجريبية" className={input} value={f.hypStatus} onChange={e => setF({ ...f, hypStatus: e.target.value })}>{data.statuses.filter((s: string) => s !== 'PARTIALLY_AVAILABLE').map((s: string) => <option key={s} value={s}>{STATUS_AR[s]}</option>)}</select>
          </div></fieldset>
        <button disabled={busy || !(f.serviceId || f.offerId)} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">اعرض النتيجة</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
      <section className="space-y-3 rounded-2xl border bg-white p-4" aria-label="نتيجة المعاينة" aria-live="polite">
        {!d && <p className="text-sm text-gray-500">اختر الخدمة والمكان ثم اعرض النتيجة.</p>}
        {d && <>
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-sm font-black ${STATUS_TONE[d.effectiveStatus]}`}>{STATUS_AR[d.effectiveStatus]}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${d.canBook ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{d.canBook ? 'يمكن الحجز' : 'لا يمكن الحجز'}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{d.isVisible ? 'ظاهرة للعامة' : 'مخفية عن العامة'}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{CAPACITY_AR[d.capacityStatus]}{d.remainingCapacity != null ? ` (المتبقي ${d.remainingCapacity})` : ''}</span></div>
          <dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-gray-500">الحالة المضبوطة</dt><dd className="font-bold">{STATUS_AR[d.configuredStatus]}</dd></div><div><dt className="text-xs text-gray-500">يحتاج تحديد مكان</dt><dd className="font-bold">{d.needsLocation ? 'نعم' : 'لا'}</dd></div></dl>
          {(d.message.ar || d.message.en) && <div className="rounded-xl bg-slate-50 p-3 text-sm"><p>{d.message.ar}</p><p dir="ltr" className="text-gray-600">{d.message.en}</p></div>}
          <div><h4 className="mb-1 text-sm font-black">أسباب القرار</h4>{d.reasonCodes.length ? <ul className="space-y-1 text-sm">{d.reasonCodes.map((c: string) => <li key={c}><code className="text-xs">{c}</code> — {REASON_AR[c] ?? ''}</li>)}</ul> : <p className="text-sm text-gray-500">لا قيود.</p>}</div>
          {Object.keys(d.restrictions).length > 0 && <div><h4 className="mb-1 text-sm font-black">القيود السارية</h4><pre dir="ltr" className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(d.restrictions, null, 2)}</pre></div>}
          <details><summary className="cursor-pointer text-sm font-black">تسلسل التقييم ({d.trace.length} خطوة)</summary><ol className="mt-2 space-y-1 text-xs">{d.trace.map((t: any, i: number) => <li key={i}><b>{t.layer}</b>{t.status ? ` · ${STATUS_AR[t.status]}` : ''} — {t.note}{t.policyId ? ` (${String(t.policyId).slice(0, 8)})` : ''}</li>)}</ol></details>
        </>}
      </section>
    </div>
  );
}
