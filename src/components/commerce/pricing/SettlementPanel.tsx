'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';

const box = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 space-y-3 shadow-card';
const field = 'rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm';
const riyal = (halala: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format((halala ?? 0) / 100);
const FUND: Record<string, string> = { PLATFORM: 'المنصة', VENDOR: 'المورد', SHARED: 'مشترك', PACKAGE: 'الباقة' };

/** Who bore each discount and what that leaves payable to each vendor (before refunds), straight from the quotes stored with the orders. */
export default function SettlementPanel() {
  const [data, setData] = useState<any>(null), [from, setFrom] = useState(''), [to, setTo] = useState(''), [error, setError] = useState('');
  const load = useCallback(async () => { try { const q = new URLSearchParams(); if (from) q.set('from', from); if (to) q.set('to', new Date(to + 'T23:59:59').toISOString()); setData(await requestJSON('/api/commerce/pricing/settlement' + (q.toString() ? '?' + q : ''))); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التحميل'); } }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <p role="alert" className="rounded-xl border bg-amber-50 p-3">{error}</p>;
  if (!data) return <p>جارٍ التحميل…</p>;
  return (
    <div className="space-y-4">
      <section className={box}><div className="flex flex-wrap items-end gap-3"><h3 className="me-auto font-bold">تسوية الخصومات مع الموردين</h3><label className="text-sm">من<input type="date" className={field + ' block'} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">إلى<input type="date" className={field + ' block'} value={to} onChange={e => setTo(e.target.value)} /></label></div>
        <p className="text-xs text-gray-600">{data.note}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-2">المورد</th><th>طلبات</th><th>القيمة الإجمالية</th><th>إجمالي الخصومات</th><th>ممول من المورد</th><th>ممول من المنصة</th><th>الصافي</th><th>العمولة</th><th>المستحق</th></tr></thead><tbody>
          {data.vendors.map((v: any) => <tr key={v.vendorId ?? 'none'} className="border-t"><td className="p-2">{v.vendorName}</td><td>{v.orders}</td><td>{riyal(v.gross)}</td><td>{riyal(v.discounts)}</td><td>{riyal(v.vendorFunded)}</td><td>{riyal(v.platformFunded)}</td><td>{riyal(v.net)}</td><td>{riyal(v.commission)}</td><td className="font-bold">{riyal(v.payable)}</td></tr>)}
          {!data.vendors.length && <tr><td className="p-4 text-gray-500" colSpan={9}>لا طلبات في هذه الفترة.</td></tr>}</tbody></table></div></section>
      {data.campaigns.length > 0 && <section className={box}><h4 className="font-bold">الحملات والتمويل</h4><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-1">الحملة / القاعدة</th><th>التمويل</th><th>مرات الاستخدام</th><th>إجمالي الخصم</th></tr></thead><tbody>{data.campaigns.map((c: any, i: number) => <tr key={i} className="border-t"><td className="p-1">{c.name}</td><td>{FUND[c.fundingType] ?? c.fundingType}</td><td>{c.uses}</td><td>{riyal(c.amount)}</td></tr>)}</tbody></table></section>}
    </div>
  );
}
