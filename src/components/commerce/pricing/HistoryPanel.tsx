'use client';
import { useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';

const box = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 space-y-3 shadow-card';
const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm';
const btn = 'rounded-xl bg-saudi-green-800 px-4 py-2 text-sm font-bold text-white hover:bg-saudi-green-900 disabled:opacity-50';
const riyal = (halala: number | null) => (halala === null ? '—' : new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(halala / 100));
const day = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const STATE: Record<string, string> = { SCHEDULED: 'مجدول', APPLIED: 'طُبّق', CANCELLED: 'أُلغي' };

/** Price change history and scheduled price changes, per offer or per package, with how many carts a change would touch. */
export default function HistoryPanel() {
  const [catalog, setCatalog] = useState<any>(null), [manage, setManage] = useState<any>(null), [target, setTarget] = useState(''), [data, setData] = useState<any>(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(''), [when, setWhen] = useState('');
  useEffect(() => { void Promise.all([requestJSON('/api/commerce/catalog'), requestJSON('/api/commerce/manage')]).then(([c, m]) => { setCatalog(c); setManage(m); }).catch(e => setNotice(e.message)); }, []);
  const load = async (value: string) => { setTarget(value); setData(null); if (!value) return; const [kind, id] = value.split(':'); try { setData(await requestJSON(`/api/commerce/pricing/history?${kind}Id=${encodeURIComponent(id)}`)); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التحميل'); } };
  const schedule = async () => {
    setBusy(true); setNotice('');
    try { const r = await requestJSON('/api/commerce/pricing/schedule', 'POST', { offerId: target.split(':')[1], newBaseAmount: Math.round(Number(amount)), effectiveFrom: new Date(when).toISOString() }); setNotice(`تمت الجدولة. ${r.affectedCarts} سلة تحوي هذا العرض وسيُبلَّغ أصحابها عند التطبيق.`); setAmount(''); setWhen(''); await load(target); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'تعذرت الجدولة'); } finally { setBusy(false); }
  };
  const cancel = async (id: string) => { setBusy(true); try { await requestJSON('/api/commerce/pricing/schedule', 'POST', { action: 'cancel', id }); await load(target); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الإلغاء'); } finally { setBusy(false); } };
  if (!catalog || !manage) return <p>جارٍ التحميل…</p>;
  const ownOffers = (manage.offers ?? []) as any[];
  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
      <section className={box}><h3 className="font-bold">سجل تغيّرات الأسعار والجدولة</h3>
        <label className="block text-sm">اختر عرضاً أو باقة<select className={field} value={target} onChange={e => void load(e.target.value)}><option value="">— اختر —</option><optgroup label="العروض">{ownOffers.map((o: any) => <option key={o.id} value={'offer:' + o.id}>{o.body.nameAr}</option>)}</optgroup><optgroup label="الباقات">{manage.packages.map((p: any) => <option key={p.id} value={'package:' + p.id}>{p.body.nameAr}</option>)}</optgroup></select></label>
        {data && <p className={`rounded-xl p-3 text-sm ${data.affectedCarts ? 'bg-amber-50' : 'bg-saudi-sand-50'}`}>سلال العملاء التي تحوي هذا العنصر الآن: <strong>{data.affectedCarts}</strong>{data.affectedCarts ? ' — أي تغيير في سعره سيُسجَّل ويُبلَّغ به أصحابها ولن يُحمَّلوا زيادة دون موافقتهم.' : ''}</p>}</section>
      {data?.kind === 'OFFER' && <>
        <section className={box}><h4 className="font-bold">إصدارات السعر</h4><p className="text-sm">السعر الحالي: <strong>{riyal(data.current)}</strong></p>
          <table className="w-full text-sm"><thead><tr className="text-start"><th className="p-1">الإصدار</th><th>السعر الأساسي</th><th>التاريخ</th></tr></thead><tbody>{data.versions.map((v: any) => <tr key={v.version} className="border-t"><td className="p-1">v{v.version}</td><td>{riyal(v.baseAmount)}</td><td>{day(v.createdAt)}</td></tr>)}</tbody></table></section>
        <section className={box}><h4 className="font-bold">جدولة تغيير في السعر الأساسي</h4>
          <div className="flex flex-wrap items-end gap-2"><label className="text-sm">السعر الجديد (هللة)<input type="number" min={0} className={field} value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="text-sm">يسري من<input type="datetime-local" className={field} value={when} onChange={e => setWhen(e.target.value)} /></label><button className={btn} disabled={busy || !amount || !when} onClick={() => void schedule()}>جدولة</button></div>
          <ul className="space-y-1 text-sm">{data.schedules.map((s: any) => <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b py-1"><span>{riyal(s.newBaseAmount)} من {day(s.effectiveFrom)}{s.previousBaseAmount !== null ? ` (كان ${riyal(s.previousBaseAmount)})` : ''}</span><span>{STATE[s.status]}{s.status === 'SCHEDULED' && <button className="ms-2 text-red-800 underline" disabled={busy} onClick={() => void cancel(s.id)}>إلغاء</button>}</span></li>)}{!data.schedules.length && <li className="text-gray-500">لا تغييرات مجدولة.</li>}</ul></section></>}
      {data?.kind === 'PACKAGE' && <section className={box}><h4 className="font-bold">إصدارات سياسة التسعير</h4><ul className="space-y-1 text-sm">{data.policies.map((p: any) => <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-1"><span>v{p.version} · {p.model}{p.fixedPrice ? ' · ' + riyal(p.fixedPrice) : ''}{p.discountBps ? ' · ' + p.discountBps / 100 + '%' : ''}{p.discountAmount ? ' · ' + riyal(p.discountAmount) : ''}</span><span>{p.status} · من {day(p.effectiveFrom)}{p.effectiveUntil ? ' إلى ' + day(p.effectiveUntil) : ''}</span></li>)}</ul></section>}
    </div>
  );
}
