'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import PriceSummary from '../PriceSummary';

const box = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 space-y-3 shadow-card';
const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm';
const btn = 'rounded-xl bg-saudi-green-800 px-4 py-2 text-sm font-bold text-white hover:bg-saudi-green-900 disabled:opacity-50';
const ghost = 'rounded-xl border border-saudi-sand-300 px-3 py-1.5 text-sm font-bold hover:bg-saudi-sand-100 disabled:opacity-50';
const riyal = (halala: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format((halala ?? 0) / 100);
const KINDS: [string, string][] = [['GENERAL', 'عام (تلقائي)'], ['PROMO_CODE', 'رمز ترويجي'], ['QUANTITY', 'حسب الكمية'], ['BUNDLE', 'حزمة خدمات متعددة'], ['TIMED', 'محدد بوقت'], ['CUSTOMER', 'أهلية العميل'], ['LOYALTY', 'ولاء']];
const STATUS: Record<string, string> = { DRAFT: 'مسودة (بانتظار التفعيل)', ACTIVE: 'نشطة', DISABLED: 'معطلة' };
const FUND: Record<string, string> = { PLATFORM: 'المنصة', VENDOR: 'المورد', SHARED: 'مشترك' };
const local = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const blank = (packageId?: string) => ({ name: '', kind: 'GENERAL', discountType: 'PERCENTAGE', value: 10, maximumDiscount: '', minimumSubtotal: '', priority: 0, stackable: false, stackingGroup: '', fundingType: 'PLATFORM', vendorShareBps: 0, code: '', startsAt: '', endsAt: '', usageLimit: '', perCustomerLimit: '', campaign: '', status: 'DRAFT', conditions: { minQuantity: '', maxQuantity: '', minServices: '', allowWithPackageDiscount: false, customer: { firstOrderOnly: false, minCompletedOrders: '' } } as any, targets: { packageIds: packageId ? [packageId] : [], serviceIds: [] as string[], offerIds: [] as string[], vendorIds: [] as string[] } });

export default function RulesPanel({ isAdmin, startPackage }: { isAdmin: boolean; startPackage: string }) {
  const [rules, setRules] = useState<any[] | null>(null), [form, setForm] = useState<any>(startPackage ? blank(startPackage) : null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [catalog, setCatalog] = useState<any>(null), [preview, setPreview] = useState<any>(null), [filter, setFilter] = useState('');
  const load = useCallback(async () => { const [r, c] = await Promise.all([requestJSON('/api/commerce/pricing/rules'), requestJSON('/api/commerce/catalog')]); setRules(r.rules); setCatalog(c); }, []);
  useEffect(() => { void load().catch(e => setNotice(e.message)); }, [load]);
  useEffect(() => { if (startPackage) setForm(blank(startPackage)); }, [startPackage]);
  if (!rules || !catalog) return <p>جارٍ التحميل…</p>;

  const edit = (r: any) => { setPreview(null); setForm({ ...r, id: r.id, value: r.discountType === 'PERCENTAGE' ? r.value : r.value, maximumDiscount: r.maximumDiscount ?? '', minimumSubtotal: r.minimumSubtotal || '', stackingGroup: r.stackingGroup ?? '', code: r.code ?? '', startsAt: local(r.startsAt), endsAt: local(r.endsAt), usageLimit: r.usageLimit ?? '', perCustomerLimit: r.perCustomerLimit ?? '', campaign: r.campaign ?? '', conditions: { minQuantity: r.conditions.minQuantity ?? '', maxQuantity: r.conditions.maxQuantity ?? '', minServices: r.conditions.minServices ?? '', allowWithPackageDiscount: !!r.conditions.allowWithPackageDiscount, cityIds: r.conditions.cityIds ?? [], customer: { firstOrderOnly: !!r.conditions.customer?.firstOrderOnly, minCompletedOrders: r.conditions.customer?.minCompletedOrders ?? '', customerIds: r.conditions.customer?.customerIds ?? [] } } }); };
  const payload = () => {
    const f = form, c = f.conditions, num = (x: any) => (x === '' || x === null || x === undefined ? undefined : Number(x)), cu = f.kind === 'CUSTOMER' || f.kind === 'LOYALTY' || c.customer.firstOrderOnly || c.customer.minCompletedOrders;
    return { id: f.id, version: f.version, name: f.name, kind: f.kind, discountType: f.discountType, value: Number(f.value), maximumDiscount: num(f.maximumDiscount), minimumSubtotal: num(f.minimumSubtotal), priority: Number(f.priority) || 0, stackable: !!f.stackable, stackingGroup: f.stackingGroup || undefined, fundingType: f.fundingType, vendorShareBps: Number(f.vendorShareBps) || 0, code: f.code || undefined, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined, usageLimit: num(f.usageLimit), perCustomerLimit: num(f.perCustomerLimit), campaign: f.campaign || undefined, status: f.status, targets: f.targets,
      conditions: { minQuantity: num(c.minQuantity), maxQuantity: num(c.maxQuantity), minServices: num(c.minServices), cityIds: c.cityIds, allowWithPackageDiscount: !!c.allowWithPackageDiscount, ...(cu ? { customer: { firstOrderOnly: !!c.customer.firstOrderOnly, minCompletedOrders: num(c.customer.minCompletedOrders), customerIds: c.customer.customerIds } } : {}) } };
  };
  const save = async () => { setBusy(true); setNotice(''); try { await requestJSON('/api/commerce/pricing/rules', 'POST', payload()); setForm(null); setNotice(isAdmin ? 'تم الحفظ.' : 'تم الحفظ كمسودة؛ سيفعّلها الإداري بعد المراجعة.'); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); } };
  const act = async (id: string, action: string) => { setBusy(true); try { await requestJSON('/api/commerce/pricing/rules', 'PATCH', { id, action }); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التنفيذ'); } finally { setBusy(false); } };
  const runPreview = async () => {
    const offer = (form.targets.offerIds[0] && catalog.offers.find((o: any) => o.id === form.targets.offerIds[0])) || catalog.offers[0]; if (!offer) { setNotice('لا توجد عروض للمعاينة'); return; }
    const service = catalog.services.find((s: any) => s.id === offer.serviceId), cityId = service?.body.cities?.[0] ?? 'riyadh';
    try { setPreview(await requestJSON('/api/commerce/pricing/preview', 'POST', { line: { offerId: form.targets.packageIds[0] ? undefined : offer.id, packageId: form.targets.packageIds[0] || undefined, cityId, quantity: Math.max(1, Number(form.conditions.minQuantity) || 1), guestCount: 1, date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), time: '18:00' }, rule: { ...payload(), status: 'ACTIVE' }, promoCodes: form.code ? [form.code] : [] })); setNotice(''); } catch (e) { setPreview(null); setNotice(e instanceof Error ? e.message : 'تعذرت المعاينة'); }
  };
  const toggle = (key: 'offerIds' | 'packageIds' | 'serviceIds', id: string) => setForm({ ...form, targets: { ...form.targets, [key]: form.targets[key].includes(id) ? form.targets[key].filter((x: string) => x !== id) : [...form.targets[key], id] } });
  const shown = rules.filter(r => !filter || r.status === filter || r.campaign === filter);
  const campaigns = Array.from(new Set(rules.map(r => r.campaign).filter(Boolean)));
  const set = (patch: any) => setForm({ ...form, ...patch }), setC = (patch: any) => setForm({ ...form, conditions: { ...form.conditions, ...patch } });

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
      {!form ? (
        <section className={box}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">قواعد الخصم والحملات</h3><div className="flex gap-2"><select className={field + ' w-44'} value={filter} onChange={e => setFilter(e.target.value)} aria-label="تصفية"><option value="">الكل</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}{campaigns.map(c => <option key={c as string} value={c as string}>حملة: {c as string}</option>)}</select><button className={btn} onClick={() => { setPreview(null); setForm(blank()); }}>+ قاعدة جديدة</button></div></div>
          {!isAdmin && <p className="text-xs text-gray-600">قواعدك تموّلها أنت وتقتصر على خدماتك، وتُحفظ مسودة حتى يفعّلها الإداري.</p>}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-2">الاسم</th><th>النوع</th><th>القيمة</th><th>الرمز</th><th>التمويل</th><th>الفترة</th><th>الاستخدام</th><th>الحالة</th><th /></tr></thead><tbody>
            {shown.map(r => <tr key={r.id} className="border-t"><td className="p-2"><strong>{r.name}</strong>{r.campaign && <span className="block text-xs text-gray-500">حملة: {r.campaign}</span>}</td><td>{KINDS.find(k => k[0] === r.kind)?.[1]}</td><td>{r.discountType === 'PERCENTAGE' ? r.value + '%' : riyal(r.value)}{r.stackable ? ' · يجتمع' : ''}</td><td dir="ltr">{r.code ?? '—'}</td><td>{FUND[r.fundingType]}</td><td className="text-xs">{r.startsAt ? new Date(r.startsAt).toLocaleDateString('ar-SA') : '—'} → {r.endsAt ? new Date(r.endsAt).toLocaleDateString('ar-SA') : '—'}</td><td>{r.redeemed}{r.usageLimit ? ' / ' + r.usageLimit : ''}</td><td>{STATUS[r.status]}</td>
              <td className="whitespace-nowrap"><button className="underline" onClick={() => edit(r)}>تعديل</button>{isAdmin && r.status !== 'ACTIVE' && <button className="ms-2 underline" disabled={busy} onClick={() => void act(r.id, 'activate')}>تفعيل</button>}{r.status === 'ACTIVE' && <button className="ms-2 text-red-800 underline" disabled={busy} onClick={() => void act(r.id, 'disable')}>تعطيل</button>}</td></tr>)}
            {!shown.length && <tr><td className="p-4 text-gray-500" colSpan={9}>لا توجد قواعد.</td></tr>}</tbody></table></div>
        </section>
      ) : (
        <section className={box} aria-label="قاعدة خصم">
          <h3 className="font-bold">{form.id ? 'تعديل قاعدة' : 'قاعدة خصم جديدة'}</h3>
          <p className="text-xs text-gray-600">اسم القاعدة يظهر للعميل في ملخص السعر، فاختر اسماً مفهوماً.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">الاسم<input className={field} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
            <label className="text-sm">النوع<select className={field} value={form.kind} onChange={e => set({ kind: e.target.value })}>{KINDS.map(k => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select></label>
            <label className="text-sm">طريقة الخصم<select className={field} value={form.discountType} onChange={e => set({ discountType: e.target.value })}><option value="PERCENTAGE">نسبة مئوية</option><option value="FIXED_AMOUNT">مبلغ ثابت (هللة)</option></select></label>
            <label className="text-sm">القيمة<input type="number" min={0} step={form.discountType === 'PERCENTAGE' ? '0.01' : '1'} className={field} value={form.value} onChange={e => set({ value: e.target.value })} /></label>
            <label className="text-sm">سقف الخصم (هللة)<input type="number" min={0} className={field} value={form.maximumDiscount} onChange={e => set({ maximumDiscount: e.target.value })} /></label>
            <label className="text-sm">حد أدنى للمبلغ المؤهل (هللة)<input type="number" min={0} className={field} value={form.minimumSubtotal} onChange={e => set({ minimumSubtotal: e.target.value })} /></label>
            <label className="text-sm">الرمز الترويجي<input dir="ltr" className={field} value={form.code} onChange={e => set({ code: e.target.value.toUpperCase() })} /></label>
            <label className="text-sm">يبدأ<input type="datetime-local" className={field} value={form.startsAt} onChange={e => set({ startsAt: e.target.value })} /></label>
            <label className="text-sm">ينتهي<input type="datetime-local" className={field} value={form.endsAt} onChange={e => set({ endsAt: e.target.value })} /></label>
            <label className="text-sm">حد الاستخدام الكلي<input type="number" min={1} className={field} value={form.usageLimit} onChange={e => set({ usageLimit: e.target.value })} /></label>
            <label className="text-sm">حد الاستخدام لكل عميل<input type="number" min={1} className={field} value={form.perCustomerLimit} onChange={e => set({ perCustomerLimit: e.target.value })} /></label>
            <label className="text-sm">الحملة (للتجميع)<input className={field} value={form.campaign} onChange={e => set({ campaign: e.target.value })} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">الأولوية (0 = غير محددة)<input type="number" min={0} className={field} value={form.priority} onChange={e => set({ priority: e.target.value })} /></label>
            <label className="text-sm">مجموعة التعارض<input className={field} value={form.stackingGroup} onChange={e => set({ stackingGroup: e.target.value })} placeholder="تُطبَّق أفضل قاعدة من المجموعة" /></label>
            <label className="self-end text-sm"><input type="checkbox" checked={form.stackable} onChange={e => set({ stackable: e.target.checked })} /> يجتمع مع خصومات أخرى</label>
            <label className="self-end text-sm"><input type="checkbox" checked={form.conditions.allowWithPackageDiscount} onChange={e => setC({ allowWithPackageDiscount: e.target.checked })} /> يجتمع مع خصم الباقة</label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">تمويل الخصم<select className={field} value={isAdmin ? form.fundingType : 'VENDOR'} disabled={!isAdmin} onChange={e => set({ fundingType: e.target.value })}>{isAdmin ? <><option value="PLATFORM">المنصة</option><option value="VENDOR">الموردون</option><option value="SHARED">مشترك</option></> : <option value="VENDOR">أنا (المورد)</option>}</select></label>
            {isAdmin && form.fundingType === 'SHARED' && <label className="text-sm">حصة المورد (نقاط أساس من 10000)<input type="number" min={0} max={10000} className={field} value={form.vendorShareBps} onChange={e => set({ vendorShareBps: e.target.value })} /></label>}
            <label className="text-sm">حد أدنى للكمية<input type="number" min={1} className={field} value={form.conditions.minQuantity} onChange={e => setC({ minQuantity: e.target.value })} /></label>
            <label className="text-sm">حد أقصى للكمية<input type="number" min={1} className={field} value={form.conditions.maxQuantity} onChange={e => setC({ maxQuantity: e.target.value })} /></label>
            <label className="text-sm">حد أدنى لعدد الخدمات<input type="number" min={1} className={field} value={form.conditions.minServices} onChange={e => setC({ minServices: e.target.value })} /></label>
            <label className="text-sm"><input type="checkbox" checked={form.conditions.customer.firstOrderOnly} onChange={e => setC({ customer: { ...form.conditions.customer, firstOrderOnly: e.target.checked } })} /> لأول طلب فقط</label>
            <label className="text-sm">أقل عدد طلبات سابقة (ولاء)<input type="number" min={1} className={field} value={form.conditions.customer.minCompletedOrders} onChange={e => setC({ customer: { ...form.conditions.customer, minCompletedOrders: e.target.value } })} /></label>
          </div>
          <fieldset className="text-sm"><legend className="font-bold">المدن المؤهلة (الكل إن لم تحدد)</legend><div className="flex flex-wrap gap-3">{catalog.cities.map((c: any) => <label key={c.id}><input type="checkbox" checked={(form.conditions.cityIds ?? []).includes(c.id)} onChange={e => setC({ cityIds: e.target.checked ? [...(form.conditions.cityIds ?? []), c.id] : (form.conditions.cityIds ?? []).filter((x: string) => x !== c.id) })} /> {c.nameAr}</label>)}</div></fieldset>
          <fieldset className="text-sm"><legend className="font-bold">المستهدف (الكل إن لم تحدد{!isAdmin ? '، وتقتصر على خدماتك' : ''})</legend>
            <details><summary className="cursor-pointer">العروض ({form.targets.offerIds.length})</summary><div className="mt-2 flex max-h-40 flex-wrap gap-3 overflow-y-auto">{catalog.offers.map((o: any) => <label key={o.id}><input type="checkbox" checked={form.targets.offerIds.includes(o.id)} onChange={() => toggle('offerIds', o.id)} /> {o.body.nameAr}</label>)}</div></details>
            <details><summary className="cursor-pointer">الباقات ({form.targets.packageIds.length})</summary><div className="mt-2 flex flex-wrap gap-3">{catalog.packages.map((p: any) => <label key={p.id}><input type="checkbox" checked={form.targets.packageIds.includes(p.id)} onChange={() => toggle('packageIds', p.id)} /> {p.body.nameAr}</label>)}</div></details></fieldset>
          <div className="flex flex-wrap gap-2"><button className={btn} disabled={busy} onClick={() => void save()}>حفظ</button><button className={ghost} disabled={busy} onClick={() => void runPreview()}>معاينة أثر القاعدة</button><button className={ghost} onClick={() => { setForm(null); setPreview(null); }}>إلغاء</button></div>
          {preview && <div className="grid gap-3 lg:grid-cols-2"><PriceSummary pricing={preview.customerView.pricing} names={Object.fromEntries(catalog.offers.map((o: any) => [o.id, o.body.nameAr]))} />{preview.internal && <div className="rounded-2xl border p-4 text-sm"><h4 className="font-bold">التمويل</h4><p>المنصة: {riyal(preview.internal.funding.platform)}</p>{Object.entries(preview.internal.funding.vendors).map(([v, a]) => <p key={v}>مورد {v.slice(0, 6)}: {riyal(a as number)}</p>)}</div>}</div>}
        </section>
      )}
    </div>
  );
}
