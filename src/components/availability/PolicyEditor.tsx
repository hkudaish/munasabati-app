'use client';
import React, { useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { BOOKING_AR, DAYS_AR, ENTITY_AR, GEO_EFFECT_AR, SCHEDULE_AR, STATUS_AR, VISIBILITY_AR } from './labels';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const small = 'rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-slate-50';
const toLocal = (iso?: string | null) => (iso ? new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const num = (v: string) => (v === '' ? undefined : Number(v));
const csv = (v: string) => v.split(/[،,\s]+/).map(x => x.trim()).filter(Boolean);

interface GeoRow { kind: string; value: string; effect: string; status: string; cap: string; slots: string }
interface SchedRow { kind: string; dayOfWeek: string; startTime: string; endTime: string; startDate: string; endDate: string; maxBookings: string }
function fromPolicy(p: any, preset: any) {
  const src = p ?? preset ?? {};
  const r = src.restrictionConfig ?? {};
  return {
    entityType: src.entityType ?? 'SERVICE', entityId: src.entityId ?? '', configuredStatus: src.configuredStatus ?? 'ACTIVE', visibilityMode: src.visibilityMode ?? 'AUTO', bookingMode: src.bookingMode ?? 'ENABLED', priority: String(src.priority ?? 0),
    effectiveFrom: toLocal(src.effectiveFrom), effectiveUntil: toLocal(src.effectiveUntil), reason: src.reason ?? '', msgAr: src.publicMessage?.ar ?? '', msgEn: src.publicMessage?.en ?? '', autoActivate: !!src.autoActivate,
    existingBookings: src.suspensionPolicy?.existingBookings ?? 'CONTINUE', expectedResumeDate: src.suspensionPolicy?.expectedResumeDate ?? '',
    cities: (r.cities ?? []) as string[], vendorIds: (r.vendorIds ?? []) as string[], offerIds: (r.offerIds ?? []).join(', '), maxBookingsPerDay: r.maxBookingsPerDay != null ? String(r.maxBookingsPerDay) : '', allowedTimeSlots: (r.allowedTimeSlots ?? []).join(', '), maxQuantity: r.maxQuantity != null ? String(r.maxQuantity) : '', minLeadHours: r.minLeadHours != null ? String(r.minLeadHours) : '', launchDate: r.launchDate ?? '',
    geoRules: ((src.geoRules ?? []) as any[]).map((g: any): GeoRow => ({ kind: g.cityId ? 'city' : g.regionId ? 'region' : 'country', value: g.cityId ?? g.regionId ?? g.countryCode ?? '', effect: g.geographicEffect, status: g.statusOverride ?? '', cap: g.restrictionConfig?.maxBookingsPerDay != null ? String(g.restrictionConfig.maxBookingsPerDay) : '', slots: (g.restrictionConfig?.allowedTimeSlots ?? []).join(', ') })),
    schedules: ((src.schedules ?? []) as any[]).map((s: any): SchedRow => ({ kind: s.kind, dayOfWeek: s.dayOfWeek == null ? '' : String(s.dayOfWeek), startTime: s.startTime ?? '', endTime: s.endTime ?? '', startDate: s.startDate ?? '', endDate: s.endDate ?? '', maxBookings: s.maxBookings != null ? String(s.maxBookings) : '' })),
  };
}
type Form = ReturnType<typeof fromPolicy>;
function payload(f: Form) {
  const restriction: Record<string, unknown> = {};
  if (f.cities.length) restriction.cities = f.cities;
  if (f.vendorIds.length) restriction.vendorIds = f.vendorIds;
  if (csv(f.offerIds).length) restriction.offerIds = csv(f.offerIds);
  if (num(f.maxBookingsPerDay) !== undefined) restriction.maxBookingsPerDay = num(f.maxBookingsPerDay);
  if (csv(f.allowedTimeSlots).length) restriction.allowedTimeSlots = csv(f.allowedTimeSlots);
  if (num(f.maxQuantity) !== undefined) restriction.maxQuantity = num(f.maxQuantity);
  if (num(f.minLeadHours) !== undefined) restriction.minLeadHours = num(f.minLeadHours);
  if (f.launchDate) restriction.launchDate = f.launchDate;
  return {
    entityType: f.entityType, entityId: f.entityType === 'PLATFORM' ? 'platform' : f.entityId.trim(), configuredStatus: f.configuredStatus, visibilityMode: f.visibilityMode, bookingMode: f.bookingMode, priority: Number(f.priority) || 0,
    effectiveFrom: toIso(f.effectiveFrom), effectiveUntil: toIso(f.effectiveUntil), reason: f.reason.trim() || null, autoActivate: f.autoActivate,
    publicMessage: { ar: f.msgAr.trim() || undefined, en: f.msgEn.trim() || undefined }, restrictionConfig: restriction,
    suspensionPolicy: { existingBookings: f.existingBookings, ...(f.expectedResumeDate ? { expectedResumeDate: f.expectedResumeDate } : {}) },
    geoRules: f.geoRules.filter(g => g.value).map(g => ({ ...(g.kind === 'city' ? { cityId: g.value } : g.kind === 'region' ? { regionId: g.value } : { countryCode: g.value }), geographicEffect: g.effect, statusOverride: g.status || null, restrictionConfig: { ...(num(g.cap) !== undefined ? { maxBookingsPerDay: num(g.cap) } : {}), ...(csv(g.slots).length ? { allowedTimeSlots: csv(g.slots) } : {}) } })),
    schedules: f.schedules.map(s => ({ kind: s.kind, dayOfWeek: s.dayOfWeek === '' ? null : Number(s.dayOfWeek), startTime: s.startTime || null, endTime: s.endTime || null, startDate: s.startDate || null, endDate: s.endDate || null, maxBookings: num(s.maxBookings) ?? null })),
  };
}

export default function PolicyEditor({ data, initial, preset, onClose, onSaved }: { data: any; initial?: any; preset?: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => fromPolicy(initial, preset));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setF(prev => ({ ...prev, ...patch }));
  const editing = !!initial;
  const entities: { id: string; name: string }[] = data.entities[f.entityType] ?? [];
  const toggle = (key: 'cities' | 'vendorIds', id: string) => set({ [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id] } as Partial<Form>);
  const placeOptions = (kind: string) => (kind === 'city' ? data.places.cities.map((c: any) => [c.id, c.nameAr]) : kind === 'region' ? data.places.regions.map((r: any) => [r.id, r.nameAr]) : data.places.countries.map((c: any) => [c.code, c.nameAr]));
  const save = async () => {
    setBusy(true); setError('');
    try {
      if (editing) await requestJSON('/api/system-admin/availability', 'PATCH', { id: initial.id, expectedVersion: initial.version, policy: payload(f) });
      else await requestJSON('/api/system-admin/availability', 'POST', payload(f));
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); }
  };
  const risky = f.configuredStatus !== 'ACTIVE' && (f.entityType === 'PLATFORM' || f.entityType === 'MODULE');
  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? 'تعديل سياسة الإتاحة' : 'سياسة إتاحة جديدة'} className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-3">
      <form dir="rtl" className="my-6 w-full max-w-4xl space-y-5 rounded-2xl bg-white p-5" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-black">{editing ? 'تعديل سياسة الإتاحة' : 'سياسة إتاحة جديدة'}</h2><button type="button" className="text-sm underline" onClick={onClose}>إغلاق</button></div>
        {risky && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-900">هذا التغيير يوقف المعاملات الجديدة {f.entityType === 'PLATFORM' ? 'في المنصة كاملة' : 'في هذه الوحدة'}. الحجوزات القائمة تتبع «سياسة الحجوزات القائمة» أدناه. اكتب سبباً واضحاً.</p>}

        <section className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">النطاق<select className={input} value={f.entityType} disabled={editing} onChange={e => set({ entityType: e.target.value, entityId: e.target.value === 'PLATFORM' ? 'platform' : '' })}>{data.entityTypes.map((t: string) => <option key={t} value={t}>{ENTITY_AR[t]}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">الكيان{['OFFER', 'PACKAGE'].includes(f.entityType) ? <input className={input} dir="ltr" disabled={editing} placeholder={f.entityType === 'OFFER' ? 'معرّف العرض' : 'معرّف الباقة'} value={f.entityId} onChange={e => set({ entityId: e.target.value })} /> : <select className={input} disabled={editing || f.entityType === 'PLATFORM'} value={f.entityId} onChange={e => set({ entityId: e.target.value })}><option value="">اختر…</option>{entities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</label>
          <label className="text-sm">الحالة المضبوطة<select className={input} value={f.configuredStatus} onChange={e => set({ configuredStatus: e.target.value })}>{data.statuses.filter((s: string) => !editing || s === initial.configuredStatus || data.transitions[initial.configuredStatus].includes(s)).map((s: string) => <option key={s} value={s}>{STATUS_AR[s]}</option>)}</select></label>
          <label className="text-sm">الظهور للعامة<select className={input} value={f.visibilityMode} onChange={e => set({ visibilityMode: e.target.value })}>{Object.entries(VISIBILITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">أهلية الحجز<select className={input} value={f.bookingMode} onChange={e => set({ bookingMode: e.target.value })}>{Object.entries(BOOKING_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">الأولوية (-100 إلى 100)<input className={input} type="number" min={-100} max={100} value={f.priority} onChange={e => set({ priority: e.target.value })} /></label>
          <label className="text-sm">يسري من<input className={input} type="datetime-local" value={f.effectiveFrom} onChange={e => set({ effectiveFrom: e.target.value })} /></label>
          <label className="text-sm">حتى<input className={input} type="datetime-local" value={f.effectiveUntil} onChange={e => set({ effectiveUntil: e.target.value })} /></label>
          <label className="text-sm sm:col-span-3">السبب{f.configuredStatus === 'TEMPORARILY_SUSPENDED' ? ' (مطلوب)' : ''}<input className={input} maxLength={500} value={f.reason} onChange={e => set({ reason: e.target.value })} /></label>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">الرسالة للعامة (عربي)<input className={input} maxLength={300} value={f.msgAr} onChange={e => set({ msgAr: e.target.value })} /></label>
          <label className="text-sm">Public message (English)<input className={input} dir="ltr" maxLength={300} value={f.msgEn} onChange={e => set({ msgEn: e.target.value })} /></label>
        </section>

        {['TEMPORARILY_SUSPENDED', 'DISABLED', 'MAINTENANCE', 'COMING_SOON'].includes(f.configuredStatus) && <section className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
          <label className="text-sm">الحجوزات القائمة<select className={input} value={f.existingBookings} onChange={e => set({ existingBookings: e.target.value })}><option value="CONTINUE">تستمر (تأكيد وتعديل)</option><option value="REVIEW">تحتاج مراجعة إداري</option><option value="BLOCK">تُمنع</option></select></label>
          {f.configuredStatus === 'TEMPORARILY_SUSPENDED' && <label className="text-sm">الاستئناف المتوقع<input className={input} type="date" value={f.expectedResumeDate} onChange={e => set({ expectedResumeDate: e.target.value })} /></label>}
          {f.configuredStatus === 'COMING_SOON' && <><label className="text-sm">تاريخ الإطلاق<input className={input} type="date" value={f.launchDate} onChange={e => set({ launchDate: e.target.value })} /></label><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.autoActivate} onChange={e => set({ autoActivate: e.target.checked })} />تفعيل تلقائي بعد تاريخ الإطلاق (بشرط جاهزية الخدمة)</label></>}
        </section>}

        {(f.configuredStatus === 'PARTIALLY_AVAILABLE' || f.bookingMode === 'CONDITIONAL') && <section className="space-y-3 rounded-xl border p-3">
          <h3 className="text-sm font-black">قيود الإتاحة الجزئية (قيد واحد على الأقل)</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">حد الحجوزات اليومي<input className={input} type="number" min={0} value={f.maxBookingsPerDay} onChange={e => set({ maxBookingsPerDay: e.target.value })} /></label>
            <label className="text-sm">أقصى كمية<input className={input} type="number" min={0} value={f.maxQuantity} onChange={e => set({ maxQuantity: e.target.value })} /></label>
            <label className="text-sm">أقل مهلة حجز (ساعات)<input className={input} type="number" min={0} value={f.minLeadHours} onChange={e => set({ minLeadHours: e.target.value })} /></label>
            <label className="text-sm">فترات الحجز المتاحة<input className={input} dir="ltr" placeholder="16:00-20:00, 21:00-23:00" value={f.allowedTimeSlots} onChange={e => set({ allowedTimeSlots: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">عروض محددة (معرّفات مفصولة بفاصلة)<input className={input} dir="ltr" value={f.offerIds} onChange={e => set({ offerIds: e.target.value })} /></label>
          </div>
          <fieldset><legend className="mb-1 text-xs font-bold">مدن محددة</legend><div className="flex flex-wrap gap-2">{data.places.cities.map((c: any) => <label key={c.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.cities.includes(c.id)} onChange={() => toggle('cities', c.id)} />{c.nameAr}</label>)}</div></fieldset>
          <fieldset><legend className="mb-1 text-xs font-bold">موردون محددون</legend><div className="flex flex-wrap gap-2">{data.entities.VENDOR.map((v: any) => <label key={v.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.vendorIds.includes(v.id)} onChange={() => toggle('vendorIds', v.id)} />{v.name}</label>)}</div></fieldset>
        </section>}
        {f.configuredStatus !== 'PARTIALLY_AVAILABLE' && f.bookingMode !== 'CONDITIONAL' && <label className="block text-sm">حد الحجوزات اليومي (اختياري، يُحتسب للسعة وليس للحالة)<input className={`${input} max-w-xs`} type="number" min={0} value={f.maxBookingsPerDay} onChange={e => set({ maxBookingsPerDay: e.target.value })} /></label>}

        <section className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black">القواعد الجغرافية</h3><button type="button" className={small} onClick={() => set({ geoRules: [...f.geoRules, { kind: 'city', value: '', effect: 'ALLOW', status: '', cap: '', slots: '' }] })}>+ قاعدة</button></div>
          <p className="text-xs text-gray-600">المدينة تتقدم على المنطقة والمنطقة على الدولة؛ المنع يتقدم على السماح عند التساوي. المكان هو مكان الفعالية أو التسليم، وليس موقع الزائر.</p>
          {f.geoRules.map((g, i) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1.4fr_1fr_1.2fr_.8fr_1fr_auto]">
            <select aria-label="نوع المكان" className={input} value={g.kind} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, kind: e.target.value, value: '' } : x)) })}><option value="city">مدينة</option><option value="region">منطقة</option><option value="country">دولة</option></select>
            <select aria-label="المكان" className={input} value={g.value} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, value: e.target.value } : x)) })}><option value="">اختر…</option>{placeOptions(g.kind).map(([id, name]: string[]) => <option key={id} value={id}>{name}</option>)}</select>
            <select aria-label="الأثر" className={input} value={g.effect} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, effect: e.target.value } : x)) })}>{Object.entries(GEO_EFFECT_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label="حالة هذا المكان" className={input} value={g.status} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, status: e.target.value } : x)) })}><option value="">بلا تغيير للحالة</option>{data.statuses.map((s: string) => <option key={s} value={s}>{STATUS_AR[s]}</option>)}</select>
            <input aria-label="حد يومي في هذا المكان" className={input} type="number" min={0} placeholder="حد يومي" value={g.cap} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, cap: e.target.value } : x)) })} />
            <input aria-label="فترات في هذا المكان" className={input} dir="ltr" placeholder="16:00-20:00" value={g.slots} onChange={e => set({ geoRules: f.geoRules.map((x, n) => (n === i ? { ...x, slots: e.target.value } : x)) })} />
            <button type="button" className="px-2 text-xs text-red-700" onClick={() => set({ geoRules: f.geoRules.filter((_, n) => n !== i) })}>حذف</button></div>)}
        </section>

        <section className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-black">الجداول الزمنية</h3><button type="button" className={small} onClick={() => set({ schedules: [...f.schedules, { kind: 'OPERATING', dayOfWeek: '', startTime: '', endTime: '', startDate: '', endDate: '', maxBookings: '' }] })}>+ جدول</button></div>
          <p className="text-xs text-gray-600">ساعات التشغيل بتوقيت الرياض (تدعم الفترات الليلية مثل 22:00–02:00). الإغلاق والإجازة والصيانة المجدولة بتواريخ. «الحد الأقصى للحجوزات» يحدد السعة اليومية.</p>
          {f.schedules.map((s, i) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[1.3fr_1fr_.9fr_.9fr_1fr_1fr_.8fr_auto]">
            <select aria-label="نوع الجدول" className={input} value={s.kind} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, kind: e.target.value } : x)) })}>{Object.entries(SCHEDULE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label="اليوم" className={input} value={s.dayOfWeek} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, dayOfWeek: e.target.value } : x)) })}><option value="">كل الأيام</option>{DAYS_AR.map((d, k) => <option key={k} value={k}>{d}</option>)}</select>
            <input aria-label="من الساعة" className={input} type="time" value={s.startTime} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, startTime: e.target.value } : x)) })} />
            <input aria-label="إلى الساعة" className={input} type="time" value={s.endTime} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, endTime: e.target.value } : x)) })} />
            <input aria-label="من تاريخ" className={input} type="date" value={s.startDate} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, startDate: e.target.value } : x)) })} />
            <input aria-label="إلى تاريخ" className={input} type="date" value={s.endDate} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, endDate: e.target.value } : x)) })} />
            <input aria-label="الحد الأقصى للحجوزات" className={input} type="number" min={0} placeholder="سعة" value={s.maxBookings} onChange={e => set({ schedules: f.schedules.map((x, n) => (n === i ? { ...x, maxBookings: e.target.value } : x)) })} />
            <button type="button" className="px-2 text-xs text-red-700" onClick={() => set({ schedules: f.schedules.filter((_, n) => n !== i) })}>حذف</button></div>)}
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{editing ? 'حفظ التعديل' : 'إنشاء السياسة'}</button><button type="button" className="text-sm underline" onClick={onClose}>إلغاء</button></div>
      </form>
    </div>
  );
}
