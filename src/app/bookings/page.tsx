'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Calendar, ChevronLeft, RefreshCw, ShoppingBag, AlertCircle } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';
import { formatSaudiRiyal } from '@/lib/utils';
import type { OMSMasterOrder } from '@/lib/oms/types';
import { ORDER_STATUS_LABELS as labels } from '@/lib/oms/labels';
import { useApp } from '@/lib/store';

export default function BookingsPage() {
  const { currentUser, openOnboarding } = useApp();
  const [orders, setOrders] = useState<OMSMasterOrder[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const requestId = useRef(0);
  const cancelPending = useCallback(() => { requestId.current++; }, []);
  const load = useCallback(async () => {
    const attempt = ++requestId.current;
    setLoading(true); setError('');
    try { const data = await requestJSON('/api/oms/orders'); if (attempt === requestId.current) setOrders(data.orders); }
    catch (e) { if (attempt !== requestId.current) return; setError(e instanceof Error ? e.message : 'تعذر تحميل الطلبات'); setOrders([]); }
    finally { if (attempt === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => { setOrders([]); void load(); return cancelPending; }, [load, cancelPending, currentUser?.id]);
  const shown = orders.filter(o => tab === 'all' || (tab === 'completed' ? ['COMPLETED','CLOSED'].includes(o.omsStatus) : !['COMPLETED','CLOSED','CANCELLED'].includes(o.omsStatus)));
  return <div className="max-w-5xl mx-auto px-4 py-10 space-y-6" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-black text-saudi-green-950 font-cairo">طلباتي وحجوزاتي</h1><p className="mt-2 text-sm text-gray-600">تابع رد كل مورد وتنفيذ الخدمات المرتبطة بمناسبتك.</p></div>
      <button onClick={() => void load()} disabled={loading} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />تحديث</button>
    </div>
    <Link href="/commerce/orders" className="block rounded-xl border bg-white p-4 font-bold">الطلبات التجارية والحجوزات الجديدة ←</Link><Link href="/bookings/manage" className="block rounded-xl border bg-white p-4 font-bold text-emerald-900">الخدمات والحجوزات التفصيلية والتوفر والمتابعة ←</Link>
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm leading-7">إرسال الطلب لا يؤكد الحجز. الدفع الإلكتروني غير مفعّل حالياً، ولا يتم تسجيل دفع أو إصدار فاتورة دفع من هذه الصفحة.</div>
    <div className="flex gap-2" role="group" aria-label="تصفية الطلبات">{[['all','الكل'],['active','الجارية'],['completed','المكتملة']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={`px-5 py-2 rounded-xl text-sm font-bold ${tab === id ? 'bg-saudi-green-800 text-white' : 'bg-white border'}`}>{label}</button>)}</div>
    {loading ? <p role="status" className="text-center py-12">جاري تحميل الطلبات…</p> : error ? <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3"><p className="flex items-center gap-2"><AlertCircle size={18} />{error}</p>{!currentUser && <button className="btn-primary" onClick={() => openOnboarding('client')}>تسجيل الدخول</button>}</div> : shown.length === 0 ? <div className="text-center rounded-3xl bg-white border p-12 space-y-4"><ShoppingBag className="mx-auto text-gray-500" size={42}/><h2 className="font-bold">لا توجد طلبات في هذه القائمة</h2><Link href="/marketplace" className="inline-block btn-primary">تصفح الخدمات</Link></div> : shown.map(order => <article key={order.id} className="bg-white border border-saudi-sand-300 rounded-3xl p-5 sm:p-7 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-gray-600">رقم الطلب</p><p dir="ltr" className="font-mono text-xs break-all">{order.orderNumber}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold bg-saudi-sand-100">{labels[order.omsStatus] || 'قيد المتابعة'}</span></div>
      <div className="flex flex-wrap gap-5 text-sm"><span className="flex items-center gap-2"><Calendar size={16}/>{order.eventDate} • {order.eventTime} • {order.cityNameAr}</span><span className="font-bold">{formatSaudiRiyal(order.finalTotal)}</span><span>{order.paymentStatus === 'PAID' ? (order.isDepositOnly ? 'العربون مدفوع' : 'مدفوع') : 'غير مدفوع'}</span></div>
      <ul className="divide-y">{order.suborders.map(sub => <li key={sub.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-bold">{sub.vendorName}</span><span className="text-gray-600">{labels[sub.omsStatus] || 'قيد المتابعة'}</span></li>)}</ul>
      <Link href={`/bookings/${order.id}`} className="flex items-center gap-2 text-saudi-green-800 font-bold text-sm">تفاصيل الطلب ومتابعة الخدمات<ChevronLeft size={16}/></Link>
    </article>)}
    {orders.length >= 200 && <p className="text-sm text-gray-500">تظهر أحدث 200 طلب.</p>}
  </div>;
}
