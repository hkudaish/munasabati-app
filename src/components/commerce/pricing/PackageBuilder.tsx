'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import PriceSummary from '../PriceSummary';

const box = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 space-y-3 shadow-card';
const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm';
const btn = 'rounded-xl bg-saudi-green-800 px-4 py-2 text-sm font-bold text-white hover:bg-saudi-green-900 disabled:opacity-50';
const ghost = 'rounded-xl border border-saudi-sand-300 px-3 py-1.5 text-sm font-bold hover:bg-saudi-sand-100 disabled:opacity-50';
const riyal = (halala: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format((halala ?? 0) / 100);
const MODELS: [string, string, string][] = [
  ['SUM', 'مجموع المكونات', 'يُحسب السعر من أسعار المكونات المختارة ويتغير بتغيرها'],
  ['FIXED_PRICE', 'سعر ثابت للباقة', 'سعر واحد (شامل الضريبة) للمكونات الإلزامية؛ لا يتأثر بتغير أسعار الخدمات المنفردة'],
  ['PERCENT', 'خصم نسبة مئوية', 'نسبة من المبلغ المؤهل للخصم (دون الرسوم والضريبة)'],
  ['FIXED_AMOUNT', 'خصم بمبلغ ثابت', 'مبلغ يُخصم من الباقة ولا يتجاوز المبلغ المؤهل'],
  ['TIERED', 'شرائح حسب عدد الخدمات', 'نسبة خصم تزداد بزيادة عدد الخدمات المؤهلة'],
];
const KINDS: [string, string][] = [['FIXED', 'ثابتة'], ['CUSTOMIZABLE', 'قابلة للتخصيص (ابنِ باقتك)'], ['BUDGET', 'حسب الميزانية'], ['PROMOTIONAL', 'ترويجية'], ['SUGGESTED', 'مقترحة']];

interface Item { id: string; offerId: string; quantity: number; durationMinutes: number; optional: boolean; substitutions: string[]; offsetMinutes: number; sortOrder: number }
const newId = () => crypto.randomUUID();

export default function PackageBuilder({ isAdmin, openRules }: { isAdmin: boolean; openRules: (packageId: string) => void }) {
  const [catalog, setCatalog] = useState<any>(null), [manage, setManage] = useState<any>(null), [selected, setSelected] = useState<string>(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [search, setSearch] = useState('');
  const [info, setInfo] = useState<any>(null), [items, setItems] = useState<Item[]>([]), [policy, setPolicy] = useState<any>(null), [policies, setPolicies] = useState<any>(null);
  const [city, setCity] = useState('riyadh'), [preview, setPreview] = useState<any>(null), [picker, setPicker] = useState('');

  const load = useCallback(async () => { const [c, m] = await Promise.all([requestJSON('/api/commerce/catalog'), requestJSON('/api/commerce/manage')]); setCatalog(c); setManage(m); }, []);
  useEffect(() => { void load().catch(e => setNotice(e.message)); }, [load]);
  const offerById = useMemo(() => new Map<string, any>([...(catalog?.offers ?? []), ...(manage?.offers ?? [])].map((o: any) => [o.id, o])), [catalog, manage]);
  const serviceById = useMemo(() => new Map<string, any>([...(catalog?.services ?? []), ...(manage?.services ?? [])].map((s: any) => [s.id, s])), [catalog, manage]);
  const offerLabel = (id: string) => { const o = offerById.get(id), s = o && serviceById.get(o.serviceId); return o ? `${o.body.nameAr} — ${s?.body.titleAr ?? ''}${s?.providerName ? ' (' + s.providerName + ')' : ''} · ${riyal(o.body.policy?.baseAmount)}` : id; };
  const pack = manage?.packages.find((p: any) => p.id === selected);

  const open = async (id: string) => {
    setSelected(id); setPreview(null); setNotice('');
    const p = manage.packages.find((x: any) => x.id === id);
    setInfo({ ...p.body }); const rows = (manage.items ?? []).filter((i: any) => i.packageId === id).map((i: any, n: number) => ({ id: i.id, offerId: i.offerId, quantity: i.body.quantity, durationMinutes: i.body.durationMinutes, optional: !!i.body.optional, substitutions: i.body.substitutions ?? [], offsetMinutes: i.body.offsetMinutes ?? 0, sortOrder: i.body.sortOrder ?? n }));
    setItems(rows.sort((a: Item, b: Item) => a.sortOrder - b.sortOrder));
    const pol = await requestJSON('/api/commerce/pricing/policies?packageId=' + encodeURIComponent(id)); setPolicies(pol);
    const cur = pol.current; setPolicy({ model: cur.model, fixedPrice: cur.fixedPrice ?? '', discountPercent: cur.discountBps ? cur.discountBps / 100 : '', discountAmount: cur.discountAmount ?? '', config: cur.config ?? {}, effectiveFrom: '', effectiveUntil: '' });
  };
  const create = () => {
    const id = newId(); setSelected('new:' + id); setPolicies(null); setPreview(null);
    setInfo({ nameAr: '', descriptionAr: '', kind: 'CUSTOMIZABLE', published: false, termsAr: '', images: [], budgetMax: 0 }); setItems([]); setPolicy({ model: 'SUM', fixedPrice: '', discountPercent: '', discountAmount: '', config: {}, effectiveFrom: '', effectiveUntil: '' });
  };
  const duplicate = () => {
    if (!pack) return; const id = newId(); setSelected('new:' + id); setPolicies(null); setPreview(null);
    setInfo({ ...info, nameAr: info.nameAr + ' (نسخة)', published: false }); setItems(items.map((i, n) => ({ ...i, id: newId(), sortOrder: n })));
    setNotice('هذه نسخة غير منشورة من الباقة، عدّل ما تشاء ثم احفظ.');
  };
  const isNew = selected.startsWith('new:'), packageId = isNew ? selected.slice(4) : selected;
  const update = (i: number, patch: Partial<Item>) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => { const k = i + d; if (k < 0 || k >= items.length) return; const next = [...items]; [next[i], next[k]] = [next[k], next[i]]; setItems(next.map((x, n) => ({ ...x, sortOrder: n }))); };
  const addItem = (optional: boolean) => {
    if (!picker) return; const o = offerById.get(picker); if (!o) return;
    if (items.some(i => i.offerId === picker)) { setNotice('هذا المكون مضاف مسبقاً'); return; }
    setItems([...items, { id: newId(), offerId: picker, quantity: 1, durationMinutes: o.body.policy?.durationMinutes ?? 60, optional, substitutions: [], offsetMinutes: 0, sortOrder: items.length }]); setPicker(''); setSearch('');
  };

  // ----- checks shown before anything is published
  const required = items.filter(i => !i.optional), problems: string[] = [];
  if (!info?.nameAr?.trim()) problems.push('اكتب اسم الباقة'); if (!info?.descriptionAr?.trim()) problems.push('اكتب وصف الباقة');
  if (!required.length) problems.push('أضف مكوناً إلزامياً واحداً على الأقل');
  if (policy?.model === 'FIXED_PRICE' && (info?.kind !== 'FIXED' || items.some(i => i.optional || i.substitutions.length))) problems.push('السعر الثابت يتطلب باقة «ثابتة» بلا مكونات اختيارية أو بدائل');
  if (policy?.model === 'FIXED_PRICE' && !(Number(policy.fixedPrice) > 0)) problems.push('أدخل السعر الثابت');
  if (policy?.model === 'PERCENT' && !(Number(policy.discountPercent) > 0 && Number(policy.discountPercent) <= 100)) problems.push('أدخل نسبة خصم بين 0 و100');
  if (policy?.model === 'FIXED_AMOUNT' && !(Number(policy.discountAmount) > 0)) problems.push('أدخل مبلغ الخصم');
  if (policy?.model === 'TIERED' && !(policy.config?.tiers?.length)) problems.push('أضف شريحة خصم واحدة على الأقل');
  const cityCover = (() => { const sets = required.map(i => new Set<string>(serviceById.get(offerById.get(i.offerId)?.serviceId)?.body.cities ?? [])); if (!sets.length) return [] as string[]; return Array.from(sets[0]).filter(c => sets.every(s => s.has(c))); })();
  if (required.length && !cityCover.length) problems.push('لا توجد مدينة تغطيها كل المكونات الإلزامية معاً');

  const policyPayload = () => ({ model: policy.model, fixedPrice: policy.fixedPrice === '' ? undefined : Math.round(Number(policy.fixedPrice)), discountPercent: policy.discountPercent === '' ? undefined : Number(policy.discountPercent), discountAmount: policy.discountAmount === '' ? undefined : Math.round(Number(policy.discountAmount)), config: policy.config, effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString() : undefined, effectiveUntil: policy.effectiveUntil ? new Date(policy.effectiveUntil).toISOString() : undefined });
  const runPreview = async () => {
    if (!items.length) { setNotice('أضف مكونات لمعاينة السعر'); return; }
    setBusy(true); setNotice('');
    try {
      // the preview works on the saved package; the unsaved pricing strategy is applied on top of it
      const line = { packageId, cityId: city, quantity: 1, guestCount: 1, choices: {}, date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), time: '18:00' };
      setPreview(await requestJSON('/api/commerce/pricing/preview', 'POST', { line, policy: policyPayload() }));
    } catch (e) { setPreview(null); setNotice(e instanceof Error ? e.message : 'تعذرت المعاينة (احفظ الباقة أولاً)'); } finally { setBusy(false); }
  };
  const save = async (publish: boolean | null) => {
    if (problems.length) { setNotice(problems[0]); return; }
    setBusy(true); setNotice('');
    try {
      const body = { ...info, published: publish === null ? !!info.published : publish, discountBps: 0, fixedTotal: 0 };
      const existing = !isNew && pack ? pack : null;
      const r = await requestJSON('/api/commerce/manage', 'POST', { kind: 'PACKAGE', id: packageId, ...(existing ? { version: existing.version } : {}), body, items: items.map((i, n) => ({ ...i, sortOrder: n })) });
      const savedId = r.entity.id;
      // the pricing strategy is its own versioned policy; a change is activated now (or on its start date)
      const same = policies && JSON.stringify({ m: policies.current.model, f: policies.current.fixedPrice ?? '', d: policies.current.discountBps ?? '', a: policies.current.discountAmount ?? '', c: policies.current.config ?? {} }) === JSON.stringify({ m: policy.model, f: policy.fixedPrice === '' ? '' : Math.round(Number(policy.fixedPrice)), d: policy.discountPercent === '' ? '' : Math.round(Number(policy.discountPercent) * 100), a: policy.discountAmount === '' ? '' : Math.round(Number(policy.discountAmount)), c: policy.config ?? {} });
      let carts = 0;
      if (!same && !(isNew && policy.model === 'SUM')) { const p = await requestJSON('/api/commerce/pricing/policies', 'POST', { packageId: savedId, activate: true, ...policyPayload() }); carts = p.affectedCarts ?? 0; }
      await load(); setSelected(savedId);
      setNotice(publish === true ? 'نُشرت الباقة.' : publish === false ? 'أُوقفت الباقة مؤقتاً.' : 'تم الحفظ.' + (carts ? ` تنبيه: ${carts} سلة تحوي هذه الباقة ستتأثر أسعارها وسيُبلَّغ أصحابها.` : ''));
      const fresh = await requestJSON('/api/commerce/manage'); setManage(fresh);
      const pol = await requestJSON('/api/commerce/pricing/policies?packageId=' + encodeURIComponent(savedId)); setPolicies(pol);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); }
  };
  const setCfg = (patch: any) => setPolicy({ ...policy, config: { ...policy.config, ...patch } });
  const tiers: { minCount: number; bps: number }[] = policy?.config?.tiers ?? [];

  if (!manage || !catalog) return <p>جارٍ التحميل…</p>;
  const choices = Array.from(offerById.values()).filter(o => o.body.allowPackages !== false && o.body.enabled !== false && (isAdmin || serviceById.get(o.serviceId)?.ownerId === undefined || true)).filter(o => !search || offerLabel(o.id).includes(search));
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-2">
        <div className="flex gap-2"><button className={btn} onClick={create}>+ باقة جديدة</button></div>
        <ul className="space-y-1.5">{manage.packages.map((p: any) => <li key={p.id}><button onClick={() => void open(p.id)} className={`w-full rounded-xl border p-3 text-start text-sm ${selected === p.id ? 'border-saudi-green-800 bg-saudi-green-50' : 'border-saudi-sand-300 bg-white'}`}><strong>{p.body.nameAr}</strong><span className="block text-xs text-gray-600">{p.body.published ? 'منشورة' : 'غير منشورة'} · {KINDS.find(k => k[0] === p.body.kind)?.[1]}</span></button></li>)}{!manage.packages.length && <li className="text-sm text-gray-500">لا توجد باقات بعد.</li>}</ul>
      </aside>
      {!selected || !info ? <p className="rounded-2xl border border-dashed border-saudi-sand-300 p-8 text-center text-gray-600">اختر باقة من القائمة أو أنشئ باقة جديدة.</p> : (
        <div className="space-y-4">
          {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}

          <section className={box} aria-label="معلومات الباقة"><h3 className="font-bold">١. معلومات الباقة</h3>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">الاسم<input className={field} value={info.nameAr} onChange={e => setInfo({ ...info, nameAr: e.target.value })} /></label>
              <label className="text-sm">النوع<select className={field} value={info.kind} onChange={e => setInfo({ ...info, kind: e.target.value })}>{KINDS.map(k => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select></label></div>
            <label className="block text-sm">الوصف<textarea className={field} value={info.descriptionAr} onChange={e => setInfo({ ...info, descriptionAr: e.target.value })} /></label></section>

          <section className={box} aria-label="المكونات"><h3 className="font-bold">٢. الخدمات المضمّنة و٣. الإضافات الاختيارية</h3>
            <div className="flex flex-wrap gap-2"><input className={field + ' sm:w-64'} placeholder="ابحث عن خدمة أو مورد" value={search} onChange={e => setSearch(e.target.value)} aria-label="بحث عن مكون" />
              <select className={field + ' sm:flex-1'} value={picker} onChange={e => setPicker(e.target.value)} aria-label="اختر مكوناً"><option value="">— اختر عرضاً —</option>{choices.slice(0, 80).map(o => <option key={o.id} value={o.id}>{offerLabel(o.id)}</option>)}</select>
              <button className={btn} disabled={!picker} onClick={() => addItem(false)}>إضافة إلزامي</button><button className={ghost} disabled={!picker} onClick={() => addItem(true)}>إضافة اختياري</button></div>
            <ul className="space-y-2">{items.map((it, i) => (
              <li key={it.id} className="grid items-center gap-2 rounded-xl border border-saudi-sand-300 p-3 sm:grid-cols-[1fr_5rem_6rem_auto]">
                <span className="text-sm"><strong>{offerLabel(it.offerId)}</strong><span className={`ms-2 rounded-full px-2 text-xs ${it.optional ? 'bg-amber-100' : 'bg-saudi-green-100'}`}>{it.optional ? 'اختياري' : 'إلزامي'}</span></span>
                <label className="text-xs">الكمية<input type="number" min={1} className={field} value={it.quantity} onChange={e => update(i, { quantity: Math.max(1, Number(e.target.value)) })} /></label>
                <label className="text-xs">المدة (د)<input type="number" min={1} className={field} value={it.durationMinutes} onChange={e => update(i, { durationMinutes: Math.max(1, Number(e.target.value)) })} /></label>
                <span className="flex gap-1"><button className={ghost} aria-label="تحريك للأعلى" onClick={() => move(i, -1)}>↑</button><button className={ghost} aria-label="تحريك للأسفل" onClick={() => move(i, 1)}>↓</button><button className={ghost} onClick={() => update(i, { optional: !it.optional })}>{it.optional ? 'اجعله إلزامياً' : 'اجعله اختيارياً'}</button><button className="text-sm text-red-800 underline" onClick={() => setItems(items.filter((_, k) => k !== i))}>حذف</button></span>
              </li>))}{!items.length && <li className="text-sm text-gray-500">لم تُضف مكونات بعد.</li>}</ul></section>

          <section className={box} aria-label="اختيار المورد"><h3 className="font-bold">٤. اختيار المورد (بدائل مسموحة)</h3>
            <p className="text-xs text-gray-600">يستطيع العميل استبدال المكون بأحد البدائل التي تحددها هنا (مثلاً مصور آخر). كل مكون يحتفظ بسعره ومورده.</p>
            {items.map((it, i) => <label key={it.id} className="block text-sm"><span className="font-bold">{offerLabel(it.offerId)}</span>
              <select multiple className={field + ' h-24'} value={it.substitutions} onChange={e => update(i, { substitutions: Array.from(e.target.selectedOptions).map(o => o.value) })}>{choices.filter(o => o.id !== it.offerId).slice(0, 80).map(o => <option key={o.id} value={o.id}>{offerLabel(o.id)}</option>)}</select></label>)}</section>

          <section className={box} aria-label="استراتيجية التسعير"><h3 className="font-bold">٥. استراتيجية التسعير</h3>
            <div className="grid gap-2 sm:grid-cols-2">{MODELS.map(([m, label, hint]) => <label key={m} className={`cursor-pointer rounded-xl border p-3 text-sm ${policy.model === m ? 'border-saudi-green-800 bg-saudi-green-50' : 'border-saudi-sand-300'}`}><input type="radio" name="model" checked={policy.model === m} onChange={() => setPolicy({ ...policy, model: m })} /> <strong>{label}</strong><span className="block text-xs text-gray-600">{hint}</span></label>)}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {policy.model === 'FIXED_PRICE' && <label className="text-sm">السعر الثابت (هللة، شامل الضريبة)<input type="number" min={1} className={field} value={policy.fixedPrice} onChange={e => setPolicy({ ...policy, fixedPrice: e.target.value })} /></label>}
              {policy.model === 'PERCENT' && <label className="text-sm">نسبة الخصم %<input type="number" min={0} max={100} step="0.01" className={field} value={policy.discountPercent} onChange={e => setPolicy({ ...policy, discountPercent: e.target.value })} /></label>}
              {policy.model === 'FIXED_AMOUNT' && <label className="text-sm">مبلغ الخصم (هللة)<input type="number" min={1} className={field} value={policy.discountAmount} onChange={e => setPolicy({ ...policy, discountAmount: e.target.value })} /></label>}
              <label className="text-sm">يبدأ من (اختياري)<input type="datetime-local" className={field} value={policy.effectiveFrom} onChange={e => setPolicy({ ...policy, effectiveFrom: e.target.value })} /></label>
              <label className="text-sm">ينتهي في (اختياري)<input type="datetime-local" className={field} value={policy.effectiveUntil} onChange={e => setPolicy({ ...policy, effectiveUntil: e.target.value })} /></label>
            </div>
            {policy.model === 'TIERED' && <div className="space-y-2"><p className="text-xs text-gray-600">الشرائح تتصاعد في العدد والنسبة؛ تُطبَّق أعلى شريحة مستوفاة.</p>
              {tiers.map((t, i) => <div key={i} className="flex flex-wrap items-center gap-2 text-sm">من <input type="number" min={1} className={field + ' w-20'} value={t.minCount} onChange={e => setCfg({ tiers: tiers.map((x, k) => (k === i ? { ...x, minCount: Number(e.target.value) } : x)) })} /> خدمات: خصم <input type="number" min={0} max={100} step="0.5" className={field + ' w-24'} value={t.bps / 100} onChange={e => setCfg({ tiers: tiers.map((x, k) => (k === i ? { ...x, bps: Math.round(Number(e.target.value) * 100) } : x)) })} /> % <button className="text-red-800 underline" onClick={() => setCfg({ tiers: tiers.filter((_, k) => k !== i) })}>حذف</button></div>)}
              <button className={ghost} onClick={() => setCfg({ tiers: [...tiers, { minCount: (tiers.at(-1)?.minCount ?? 0) + 1, bps: Math.min(10000, (tiers.at(-1)?.bps ?? 0) + 500) }] })}>+ شريحة</button>
              <label className="ms-4 text-sm"><input type="checkbox" checked={policy.config.countBy === 'QUANTITY'} onChange={e => setCfg({ countBy: e.target.checked ? 'QUANTITY' : 'DISTINCT' })} /> العدّ بالكمية بدل الخدمات المختلفة</label></div>}
            {['PERCENT', 'FIXED_AMOUNT', 'TIERED'].includes(policy.model) && <fieldset className="text-sm"><legend className="font-bold">المكونات المؤهلة للخصم (الكل إن لم تحدد)</legend><div className="flex flex-wrap gap-3">{items.map(it => <label key={it.id}><input type="checkbox" checked={(policy.config.eligibleOfferIds ?? []).includes(it.offerId)} onChange={e => { const cur: string[] = policy.config.eligibleOfferIds ?? []; setCfg({ eligibleOfferIds: e.target.checked ? [...cur, it.offerId] : cur.filter(x => x !== it.offerId) }); }} /> {offerById.get(it.offerId)?.body.nameAr}</label>)}</div></fieldset>}
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <label>أقل عدد مكونات<input type="number" min={0} className={field} value={policy.config.minComponents ?? ''} onChange={e => setCfg({ minComponents: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label>أكثر عدد مكونات<input type="number" min={1} className={field} value={policy.config.maxComponents ?? ''} onChange={e => setCfg({ maxComponents: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label className="self-end"><input type="checkbox" checked={policy.config.allowPromotions !== false} onChange={e => setCfg({ allowPromotions: e.target.checked })} /> تسمح بالعروض الترويجية فوق سعرها</label>
              <label>جهة تمويل خصم الباقة<select className={field} value={policy.config.funding ?? 'VENDOR'} onChange={e => setCfg({ funding: e.target.value })}><option value="VENDOR">الموردون</option>{isAdmin && <option value="PLATFORM">المنصة</option>}{isAdmin && <option value="SHARED">مشترك</option>}</select></label>
            </div></section>

          <section className={box} aria-label="الخصومات والعروض"><h3 className="font-bold">٦. الخصومات والعروض</h3>
            <p className="text-sm text-gray-700">خصم الباقة أعلاه لا يجتمع تلقائياً مع الرموز الترويجية: يحصل العميل على الأوفر له، إلا إذا سمحت قاعدة الخصم بالجمع صراحة.</p>
            {!isNew && <button className={ghost} onClick={() => openRules(packageId)}>إنشاء قاعدة خصم لهذه الباقة</button>}</section>

          <section className={box} aria-label="التوفر والتغطية"><h3 className="font-bold">٧. التوفر والتغطية الجغرافية</h3>
            <p className="text-sm">المدن التي تغطيها كل المكونات الإلزامية: {cityCover.length ? cityCover.map(c => (catalog.cities.find((x: any) => x.id === c)?.nameAr ?? c)).join('، ') : 'لا توجد'}</p>
            <p className="text-xs text-gray-600">التوفر في موعد معين يُفحص لحظة الطلب بمحرك الإتاحة؛ مكون إلزامي غير متاح يمنع الطلب دون حذف اختيارات العميل، والمكون الاختياري غير المتاح يُستبعد ويُعاد حساب السعر.</p></section>

          <section className={box} aria-label="معاينة العميل"><h3 className="font-bold">٨. معاينة السعر كما يراه العميل</h3>
            <div className="flex flex-wrap items-end gap-2"><label className="text-sm">المدينة<select className={field} value={city} onChange={e => setCity(e.target.value)}>{(cityCover.length ? cityCover : catalog.cities.map((c: any) => c.id)).map((c: string) => <option key={c} value={c}>{catalog.cities.find((x: any) => x.id === c)?.nameAr ?? c}</option>)}</select></label>
              <button className={btn} disabled={busy || isNew} onClick={() => void runPreview()}>معاينة</button>{isNew && <span className="text-xs text-gray-600">احفظ الباقة أولاً لمعاينتها.</span>}</div>
            {preview && <div className="grid gap-3 lg:grid-cols-2"><PriceSummary pricing={preview.customerView.pricing} names={Object.fromEntries(items.map(i => [i.offerId, offerById.get(i.offerId)?.body.nameAr ?? '']))} />
              {preview.internal && <div className="rounded-2xl border border-saudi-sand-300 p-4 text-sm"><h4 className="font-bold">تمويل الخصومات (للإدارة)</h4><p>المنصة: {riyal(preview.internal.funding.platform)}</p>{Object.entries(preview.internal.funding.vendors).map(([v, a]) => <p key={v}>مورد {v.slice(0, 6)}: {riyal(a as number)}</p>)}</div>}</div>}</section>

          <section className={box} aria-label="النشر"><h3 className="font-bold">٩. التحقق والنشر</h3>
            {problems.length ? <ul className="list-disc ps-5 text-sm text-red-800">{problems.map(p => <li key={p}>{p}</li>)}</ul> : <p className="text-sm text-green-800">لا مشكلات: الباقة جاهزة للحفظ والنشر.</p>}
            {policies && policies.affectedCarts > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm">{policies.affectedCarts} سلة تحوي هذه الباقة الآن: أي تغيير في السعر سيُسجَّل ويُبلَّغ به أصحابها ولن يُحمَّلوا زيادة قبل موافقتهم.</p>}
            <div className="flex flex-wrap gap-2"><button className={btn} disabled={busy || problems.length > 0} onClick={() => void save(true)}>حفظ ونشر</button><button className={ghost} disabled={busy || problems.length > 0} onClick={() => void save(null)}>حفظ</button>{!isNew && info.published && <button className={ghost} disabled={busy} onClick={() => void save(false)}>إيقاف مؤقت</button>}{!isNew && <button className={ghost} onClick={duplicate}>نسخ كقالب</button>}</div>
            {policies && <details className="text-sm"><summary className="cursor-pointer font-bold">إصدارات السعر ({policies.policies.length})</summary><ul className="mt-2 space-y-1">{policies.policies.map((p: any) => <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-1"><span>v{p.version} · {MODELS.find(m => m[0] === p.model)?.[1]}{p.fixedPrice ? ' · ' + riyal(p.fixedPrice) : ''}{p.discountBps ? ' · ' + p.discountBps / 100 + '%' : ''}{p.discountAmount ? ' · ' + riyal(p.discountAmount) : ''}</span><span>{p.status === 'ACTIVE' ? 'نشط' : p.status === 'ARCHIVED' ? 'مؤرشف' : 'مسودة'} · من {new Date(p.effectiveFrom).toLocaleDateString('ar-SA')}{p.effectiveUntil ? ' إلى ' + new Date(p.effectiveUntil).toLocaleDateString('ar-SA') : ''}</span></li>)}</ul></details>}</section>
        </div>
      )}
    </div>
  );
}
