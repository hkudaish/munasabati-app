'use client';
import React from 'react';

/* Plain-language editor for an offer's pricing policy. The stored format is unchanged (halalas, basis points, minutes);
   this component only translates it into riyals, percentages, hours and weekdays.
   Commission, VAT and revenue shares are set by the platform and are never shown here. */

const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm focus:border-saudi-green-800';
const ghost = 'rounded-lg border px-3 py-1.5 text-xs font-bold text-saudi-green-900 hover:bg-saudi-sand-100';
const remove = 'shrink-0 rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50';
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const OPTION_TYPES: [string, string][] = [['FIXED', 'مبلغ ثابت'], ['PER_HOUR', 'عن كل ساعة'], ['PER_GUEST', 'عن كل ضيف'], ['PER_UNIT', 'عن كل وحدة']];
const MODES: [string, string, string][] = [['DIRECT', 'تأكيد فوري', 'يُحجز الموعد مباشرة بعد الدفع.'], ['APPROVAL', 'بموافقتي', 'يصلني الطلب وأوافق عليه قبل الدفع.'], ['QUOTE', 'عرض سعر', 'أحدد السعر لكل طلب.'], ['INQUIRY', 'استفسار', 'أتواصل مع العميل قبل أي حجز.']];

const riyal = (halalas: number) => (Number(halalas) || 0) / 100;
const toHalalas = (value: string) => Math.max(0, Math.round(Number(value || 0) * 100));
const hours = (minutes: number) => Math.round(((Number(minutes) || 0) / 60) * 100) / 100;
const toMinutes = (value: string) => Math.max(0, Math.round(Number(value || 0) * 60));
const percent = (bps: number) => (Number(bps) || 0) / 100;
const toBps = (value: string) => Math.min(10000, Math.max(0, Math.round(Number(value || 0) * 100)));
const clock = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minuteOf = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const rid = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

function Section({ title, hint, open = false, children }: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return <details open={open} className="rounded-xl border p-3">
    <summary className="cursor-pointer font-bold">{title}</summary>
    {hint && <p className="my-2 text-xs leading-6 text-gray-600">{hint}</p>}
    <div className="mt-3 space-y-3">{children}</div>
  </details>;
}
const Label = ({ text, children }: { text: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-xs font-bold text-gray-700">{text}</span>{children}</label>;
const Num = ({ value, onChange, step = 1, min = 0, max }: { value: number; onChange: (v: string) => void; step?: number; min?: number; max?: number }) => <input type="number" inputMode="decimal" className={field} min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)} />;

export default function OfferSettings({ body, set, cities }: { body: any; set: (key: string, value: any) => void; cities: { id: string; nameAr: string }[] }) {
  const policy = body.policy;
  const setPolicy = (patch: any) => set('policy', { ...policy, ...patch });
  const setIn = (group: 'calendar' | 'cancellation', patch: any) => setPolicy({ [group]: { ...policy[group], ...patch } });
  const list = <T,>(key: string, items: T[], index: number, patch: Partial<T>) => setPolicy({ [key]: items.map((item, n) => (n === index ? { ...item, ...patch } : item)) });
  const drop = (key: string, items: any[], index: number) => setPolicy({ [key]: items.filter((_, n) => n !== index) });
  const model: string = body.model;

  // ---- payments ----
  const milestones: any[] = policy.paymentMilestones;
  const paid = policy.depositBps + milestones.reduce((n, m) => n + m.percentBps, 0);
  const balance = (deposit: number, rows: any[]) => rows.map((m, i) => (i === rows.length - 1 ? { ...m, percentBps: Math.max(0, 10000 - deposit - rows.slice(0, -1).reduce((n, x) => n + x.percentBps, 0)) } : m));
  const setDeposit = (bps: number) => setPolicy({ depositBps: bps, paymentMilestones: balance(bps, milestones) });

  // ---- seasons and city prices ----
  const seasons: any[] = body.seasons ?? [];
  const setSeasons = (next: any[]) => set('seasons', next);
  const cityAmounts: Record<string, number> = policy.cityAmounts ?? {};
  const unusedCities = cities.filter(c => cityAmounts[c.id] === undefined);
  const [blackout, setBlackout] = React.useState('');
  const cal = policy.calendar;
  const allDay = cal.startMinute === 0 && cal.endMinute === 1440;

  return <div className="space-y-3" aria-label="إعدادات العرض">
    <Section open title="طريقة استقبال الطلبات" hint="اختر كيف يصلك الطلب وما الذي يحدث قبل تأكيد الحجز.">
      <div className="grid gap-2 sm:grid-cols-2">{MODES.map(([value, name, text]) => <label key={value} className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${policy.bookingMode === value ? 'border-saudi-green-800 bg-saudi-green-50' : ''}`}><input type="radio" name="bookingMode" checked={policy.bookingMode === value} onChange={() => setPolicy({ bookingMode: value })} /><span><b>{name}</b><span className="block text-xs text-gray-600">{text}</span></span></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label text="أقل مدة (ساعات)"><Num step={0.25} value={hours(policy.minDurationMinutes)} onChange={v => setPolicy({ minDurationMinutes: Math.max(1, toMinutes(v)) })} /></Label>
        <Label text="أقصى مدة (ساعات)"><Num step={0.25} value={hours(policy.maxDurationMinutes)} onChange={v => setPolicy({ maxDurationMinutes: toMinutes(v) })} /></Label>
        <Label text="مهلة ردّي على الطلب (ساعات)"><Num value={policy.requestExpiryHours} onChange={v => setPolicy({ requestExpiryHours: Math.max(1, Number(v) || 1) })} /></Label>
        {(policy.bookingMode === 'QUOTE' || policy.bookingMode === 'INQUIRY' || policy.pricingMode === 'STARTING_AT') && <Label text="صلاحية عرض السعر (ساعات)"><Num value={policy.quoteValidityHours} onChange={v => setPolicy({ quoteValidityHours: Math.max(1, Number(v) || 1) })} /></Label>}
        {model === 'DURATION' && <Label text="وحدة التسعير (دقيقة)"><Num value={policy.unitMinutes} onChange={v => setPolicy({ unitMinutes: Math.max(1, Number(v) || 1) })} /></Label>}
        {model === 'NIGHT' && <Label text="مدة الليلة (ساعات)"><Num step={0.5} value={hours(body.nightMinutes)} onChange={v => set('nightMinutes', Math.max(1, toMinutes(v)))} /></Label>}
        {model === 'QUANTITY' && <><Label text="أقل كمية"><Num min={1} value={body.minQuantity} onChange={v => set('minQuantity', Math.max(1, Number(v) || 1))} /></Label><Label text="أكبر كمية"><Num min={1} value={body.maxQuantity} onChange={v => set('maxQuantity', Math.max(1, Number(v) || 1))} /></Label></>}
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={body.exclusiveVendor !== false} onChange={e => set('exclusiveVendor', e.target.checked)} />لا أقبل أكثر من حجز في الوقت نفسه (أزل العلامة إن كانت طاقتك تسمح بحجوزات متزامنة)</label>
    </Section>

    <Section title="الدفع والعربون" hint="العربون يُدفع عند الحجز، وتُوزَّع بقية المبلغ على دفعات. يجب أن يكون المجموع 100%.">
      <div className="grid gap-3 sm:grid-cols-2"><Label text="العربون عند الحجز (%)"><Num step={1} max={100} value={percent(policy.depositBps)} onChange={v => setDeposit(toBps(v))} /></Label><Label text="خصم على السعر (%)"><Num step={0.5} max={100} value={percent(policy.discountBps)} onChange={v => setPolicy({ discountBps: toBps(v) })} /></Label></div>
      {milestones.map((m, i) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Label text="اسم الدفعة"><input className={field} maxLength={100} value={m.nameAr} onChange={e => list('paymentMilestones', milestones, i, { nameAr: e.target.value })} /></Label>
        <Label text="قبل التنفيذ بـ (ساعات)"><Num value={m.beforeHours} onChange={v => list('paymentMilestones', milestones, i, { beforeHours: Number(v) || 0 })} /></Label>
        <Label text="النسبة (%)"><Num step={1} max={100} value={percent(m.percentBps)} onChange={v => list('paymentMilestones', milestones, i, { percentBps: toBps(v) })} /></Label>
        <button type="button" className={remove} disabled={milestones.length <= 1} onClick={() => setPolicy({ paymentMilestones: balance(policy.depositBps, milestones.filter((_, n) => n !== i)) })}>حذف</button>
      </div>)}
      <div className="flex flex-wrap items-center gap-3"><button type="button" className={ghost} disabled={milestones.length >= 12} onClick={() => setPolicy({ paymentMilestones: [...milestones, { nameAr: 'دفعة إضافية', beforeHours: 48, percentBps: 0 }] })}>+ دفعة</button><button type="button" className={ghost} onClick={() => setPolicy({ paymentMilestones: balance(policy.depositBps, milestones) })}>موازنة الدفعة الأخيرة تلقائياً</button>
        <span role="status" className={`text-xs font-bold ${paid === 10000 ? 'text-green-800' : 'text-red-700'}`}>{paid === 10000 ? 'المجموع 100% ✓' : `المجموع ${percent(paid)}% — يجب أن يساوي 100%`}</span></div>
    </Section>

    <Section title="الإلغاء والاسترداد">
      <div className="grid gap-3 sm:grid-cols-2"><Label text="إلغاء مجاني قبل الموعد بـ (ساعات)"><Num value={policy.cancellation.freeBeforeHours} onChange={v => setIn('cancellation', { freeBeforeHours: Number(v) || 0 })} /></Label><Label text="نسبة الاسترداد بعد انتهاء الإلغاء المجاني (%)"><Num max={100} value={percent(policy.cancellation.refundBps)} onChange={v => setIn('cancellation', { refundBps: toBps(v) })} /></Label></div>
    </Section>

    <Section title="أيام وأوقات العمل" hint="يتحكم في المواعيد التي يستطيع العميل اختيارها.">
      <fieldset><legend className="mb-1 text-xs font-bold text-gray-700">أيام العمل</legend><div className="flex flex-wrap gap-2">{DAYS.map((name, day) => { const on = cal.workingDays.includes(day); return <label key={day} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs ${on ? 'border-saudi-green-800 bg-saudi-green-50 font-bold' : ''}`}><input type="checkbox" className="sr-only" checked={on} onChange={() => { const next = on ? cal.workingDays.filter((d: number) => d !== day) : [...cal.workingDays, day].sort(); if (next.length) setIn('calendar', { workingDays: next }); }} />{name}</label>; })}</div></fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={e => setIn('calendar', e.target.checked ? { startMinute: 0, endMinute: 1440 } : { startMinute: 9 * 60, endMinute: 22 * 60 })} />أستقبل الحجوزات على مدار اليوم</label>
      {!allDay && <div className="grid gap-3 sm:grid-cols-2"><Label text="من الساعة"><input type="time" className={field} value={clock(cal.startMinute)} onChange={e => setIn('calendar', { startMinute: minuteOf(e.target.value) })} /></Label><Label text="إلى الساعة"><input type="time" className={field} value={clock(cal.endMinute)} onChange={e => setIn('calendar', { endMinute: minuteOf(e.target.value) })} /></Label></div>}
      <div className="grid gap-3 sm:grid-cols-3"><Label text="أقل إشعار قبل الحجز (ساعات)"><Num value={cal.minNoticeHours} onChange={v => setIn('calendar', { minNoticeHours: Number(v) || 0 })} /></Label><Label text="أبعد حجز مسبق (أيام)"><Num value={cal.maxAdvanceDays} onChange={v => setIn('calendar', { maxAdvanceDays: Number(v) || 0 })} /></Label><Label text="فاصل بين الحجوزات (دقائق)"><Num value={cal.bufferMinutes} onChange={v => setIn('calendar', { bufferMinutes: Number(v) || 0 })} /></Label></div>
      <div className="space-y-2"><p className="text-xs font-bold text-gray-700">أيام الإجازة والإغلاق</p><div className="flex flex-wrap gap-2">{cal.blackoutDates.map((d: string) => <span key={d} className="flex items-center gap-1 rounded-lg bg-saudi-sand-100 px-2 py-1 text-xs" dir="ltr">{d}<button type="button" aria-label={`إزالة ${d}`} className="text-red-700" onClick={() => setIn('calendar', { blackoutDates: cal.blackoutDates.filter((x: string) => x !== d) })}>×</button></span>)}</div>
        <div className="flex gap-2"><input type="date" aria-label="تاريخ إجازة" className={field} value={blackout} onChange={e => setBlackout(e.target.value)} /><button type="button" className={ghost} disabled={!blackout || cal.blackoutDates.includes(blackout)} onClick={() => { setIn('calendar', { blackoutDates: [...cal.blackoutDates, blackout].sort() }); setBlackout(''); }}>إضافة</button></div></div>
    </Section>

    <Section title="الإضافات والرسوم" hint="الإضافات اختيارية للعميل (مثل ساعة تصوير إضافية). الرسوم تُضاف دائماً (مثل رسوم تجهيز).">
      <p className="text-xs font-bold text-gray-700">الإضافات الاختيارية</p>
      {policy.options.map((o: any, i: number) => <div key={o.id} className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1.2fr_1fr_auto]">
        <Label text="الاسم"><input className={field} maxLength={200} value={o.nameAr} onChange={e => list('options', policy.options, i, { nameAr: e.target.value })} /></Label>
        <Label text="السعر (ريال)"><Num step={0.5} value={riyal(o.amount)} onChange={v => list('options', policy.options, i, { amount: toHalalas(v) })} /></Label>
        <Label text="يُحسب"><select className={field} value={o.pricingMode} onChange={e => list('options', policy.options, i, { pricingMode: e.target.value })}>{OPTION_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Label>
        <Label text="أكبر كمية"><Num min={1} value={o.maxQuantity} onChange={v => list('options', policy.options, i, { maxQuantity: Math.max(1, Number(v) || 1) })} /></Label>
        <button type="button" className={remove} onClick={() => drop('options', policy.options, i)}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={policy.options.length >= 50} onClick={() => setPolicy({ options: [...policy.options, { id: rid('opt-'), nameAr: '', amount: 0, pricingMode: 'FIXED', maxQuantity: 1 }] })}>+ إضافة اختيارية</button>
      <p className="pt-2 text-xs font-bold text-gray-700">رسوم ثابتة</p>
      {policy.fees.map((f: any, i: number) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[3fr_1fr_auto]"><Label text="اسم الرسم"><input className={field} maxLength={200} value={f.nameAr} onChange={e => list('fees', policy.fees, i, { nameAr: e.target.value })} /></Label><Label text="المبلغ (ريال)"><Num step={0.5} value={riyal(f.amount)} onChange={v => list('fees', policy.fees, i, { amount: toHalalas(v) })} /></Label><button type="button" className={remove} onClick={() => drop('fees', policy.fees, i)}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={policy.fees.length >= 30} onClick={() => setPolicy({ fees: [...policy.fees, { nameAr: '', amount: 0 }] })}>+ إضافة رسم</button>
    </Section>

    {(model === 'PACKAGE' || policy.packages.length > 0) && <Section open={model === 'PACKAGE'} title="باقات الخدمة" hint="تظهر للعميل كخيارات جاهزة بسعر ومدة لكل باقة. اختر نموذج البيع «خيارات باقات الخدمة» لتفعيلها.">
      {policy.packages.map((p: any, i: number) => <div key={p.id} className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]"><Label text="اسم الباقة"><input className={field} maxLength={200} value={p.nameAr} onChange={e => list('packages', policy.packages, i, { nameAr: e.target.value })} /></Label><Label text="السعر (ريال)"><Num step={0.5} value={riyal(p.amount)} onChange={v => list('packages', policy.packages, i, { amount: toHalalas(v) })} /></Label><Label text="المدة (ساعات)"><Num step={0.25} value={hours(p.durationMinutes)} onChange={v => list('packages', policy.packages, i, { durationMinutes: toMinutes(v) })} /></Label><button type="button" className={remove} onClick={() => drop('packages', policy.packages, i)}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={policy.packages.length >= 50} onClick={() => setPolicy({ packages: [...policy.packages, { id: rid('pkg-'), nameAr: '', amount: 0, durationMinutes: policy.durationMinutes }] })}>+ إضافة باقة</button>
    </Section>}

    <Section title="المواسم والأسعار الخاصة" hint="سعر الموسم يحلّ محل السعر الأساسي في تواريخه، وسعر المدينة يحلّ محله لطلبات تلك المدينة.">
      <p className="text-xs font-bold text-gray-700">المواسم</p>
      {seasons.map((s, i) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><Label text="من"><input type="date" className={field} value={s.from} onChange={e => setSeasons(seasons.map((x, n) => (n === i ? { ...x, from: e.target.value } : x)))} /></Label><Label text="إلى"><input type="date" className={field} value={s.until} onChange={e => setSeasons(seasons.map((x, n) => (n === i ? { ...x, until: e.target.value } : x)))} /></Label><Label text="السعر (ريال)"><Num step={0.5} value={riyal(s.amount)} onChange={v => setSeasons(seasons.map((x, n) => (n === i ? { ...x, amount: toHalalas(v) } : x)))} /></Label><button type="button" className={remove} onClick={() => setSeasons(seasons.filter((_, n) => n !== i))}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={seasons.length >= 30} onClick={() => { const today = new Date().toISOString().slice(0, 10); setSeasons([...seasons, { from: today, until: today, amount: policy.baseAmount }]); }}>+ إضافة موسم</button>
      <p className="pt-2 text-xs font-bold text-gray-700">أسعار المدن</p>
      {Object.entries(cityAmounts).map(([id, value]) => <div key={id} className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_auto]"><span className="pb-2 text-sm">{cities.find(c => c.id === id)?.nameAr ?? id}</span><Label text="السعر (ريال)"><Num step={0.5} value={riyal(value)} onChange={v => setPolicy({ cityAmounts: { ...cityAmounts, [id]: toHalalas(v) } })} /></Label><button type="button" className={remove} onClick={() => { const { [id]: _gone, ...rest } = cityAmounts; setPolicy({ cityAmounts: rest }); }}>حذف</button></div>)}
      {unusedCities.length > 0 && <select aria-label="إضافة سعر لمدينة" className={field} value="" onChange={e => { if (e.target.value) setPolicy({ cityAmounts: { ...cityAmounts, [e.target.value]: policy.baseAmount } }); }}><option value="">+ سعر خاص لمدينة…</option>{unusedCities.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select>}
    </Section>

    <Section title="المدة الإضافية" hint="إن زاد العميل عن المدة المشمولة في السعر، يُضاف مبلغ عن كل وحدة إضافية. اترك السعر صفراً لتعطيلها.">
      <div className="grid gap-3 sm:grid-cols-3"><Label text="المدة المشمولة (ساعات)"><Num step={0.25} value={hours(body.includedMinutes)} onChange={v => set('includedMinutes', toMinutes(v))} /></Label><Label text="الوحدة الإضافية (دقيقة)"><Num min={1} value={body.extraUnitMinutes} onChange={v => set('extraUnitMinutes', Math.max(1, Number(v) || 1))} /></Label><Label text={`سعر كل ${body.extraUnitMinutes} دقيقة إضافية (ريال)`}><Num step={0.5} value={riyal(body.extraMinuteAmount)} onChange={v => set('extraMinuteAmount', toHalalas(v))} /></Label></div>
    </Section>

    <Section title="معلومات يطلبها العميل" hint="حقول يجب على العميل تعبئتها عند الطلب (مثل عنوان الموقع أو مقاس الفستان).">
      {policy.requiredFields.map((f: any, i: number) => <div key={f.key} className="grid items-end gap-2 sm:grid-cols-[3fr_1.2fr_auto]"><Label text="السؤال"><input className={field} maxLength={200} value={f.labelAr} onChange={e => list('requiredFields', policy.requiredFields, i, { labelAr: e.target.value })} /></Label><Label text="نوع الإجابة"><select className={field} value={f.type} onChange={e => list('requiredFields', policy.requiredFields, i, { type: e.target.value })}><option value="text">نص</option><option value="number">رقم</option><option value="boolean">نعم / لا</option></select></Label><button type="button" className={remove} onClick={() => drop('requiredFields', policy.requiredFields, i)}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={policy.requiredFields.length >= 30} onClick={() => setPolicy({ requiredFields: [...policy.requiredFields, { key: rid('f'), labelAr: '', type: 'text' }] })}>+ إضافة سؤال</button>
    </Section>

    <Section title="الشروط والسياسات المكتوبة" hint="تظهر للعميل قبل الحجز.">
      {([['requirementsAr', 'متطلبات الخدمة'], ['paymentTermsAr', 'شروط الدفع'], ['cancellationTermsAr', 'شروط الإلغاء']] as const).map(([key, text]) => <Label key={key} text={text}><textarea rows={3} maxLength={8000} className={field} value={policy[key] ?? ''} onChange={e => setPolicy({ [key]: e.target.value })} /></Label>)}
    </Section>
  </div>;
}

/** Photos, videos and a sample audio clip for a service, as plain link lists. */
export function ServiceMedia({ body, set }: { body: any; set: (key: string, value: any) => void }) {
  const urls = (key: 'images' | 'videoUrls', title: string, hint: string, max: number) => {
    const items: string[] = body[key] ?? [];
    return <div className="space-y-2"><p className="text-xs font-bold text-gray-700">{title}</p><p className="text-xs text-gray-600">{hint}</p>
      {items.map((url, i) => <div key={i} className="flex items-center gap-2">{key === 'images' && url && /^https?:/.test(url) && <img src={url} alt="" className="h-10 w-10 rounded-lg object-cover" />}<input type="url" dir="ltr" aria-label={`${title} ${i + 1}`} className={field} placeholder="https://" value={url} onChange={e => set(key, items.map((x, n) => (n === i ? e.target.value : x)))} /><button type="button" className={remove} onClick={() => set(key, items.filter((_, n) => n !== i))}>حذف</button></div>)}
      <button type="button" className={ghost} disabled={items.length >= max} onClick={() => set(key, [...items, ''])}>+ إضافة رابط</button></div>;
  };
  return <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">الصور والفيديو والعينة الصوتية</summary>
    <div className="mt-3 space-y-4">
      {urls('images', 'روابط الصور', 'الصورة الأولى هي الغلاف. استخدم روابط مباشرة للصور.', 20)}
      {urls('videoUrls', 'روابط الفيديو', 'رابط يوتيوب أو فيميو أو ملف فيديو مباشر.', 10)}
      <Label text="عينة صوتية (اختياري)"><input type="url" dir="ltr" className={field} placeholder="https://" value={body.previewAudioUrl ?? ''} onChange={e => set('previewAudioUrl', e.target.value)} /></Label>
    </div></details>;
}
