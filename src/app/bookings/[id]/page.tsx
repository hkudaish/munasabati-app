'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  Sparkles,
  Upload,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { OMSMasterOrder, OMSSuborder } from '@/lib/oms/types';
import { LumaOMSAssistant } from '@/components/ai/LumaOMSAssistant';

export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const id = params?.id as string;

  const [masterOrder, setMasterOrder] = useState<OMSMasterOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLuma, setShowLuma] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/oms/orders');
      const data = await res.json();
      if (data.success && data.orders) {
        const found = data.orders.find(
          (o: OMSMasterOrder) =>
            o.id === id ||
            o.orderNumber === id ||
            o.suborders.some((s) => s.id === id || s.bookingNumber === id)
        );
        if (found) setMasterOrder(found);
      }
    } catch (e) {
      console.error('Error fetching order:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleCustomerApprove = async (suborderId: string) => {
    try {
      const res = await fetch('/api/oms/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborderId,
          targetState: 'COMPLETED',
          role: 'CUSTOMER',
          noteAr: 'قام العميل بمعاينة المخرجات واعتماد اكتمال الخدمة بنجاح',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage('شكراً لك! تم اعتماد استلام الخدمة واكتمال الطلب بنجاح.');
        fetchOrder();
      }
    } catch (e) {
      alert('حدث خطأ أثناء اعتماد الاستلام');
    }
  };

  const handleOpenDispute = async (suborderId: string) => {
    const reason = prompt('يرجى كتابة الملاحظات أو سبب فتح النزاع على الخدمة:');
    if (!reason) return;

    try {
      const res = await fetch('/api/oms/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborderId,
          targetState: 'DISPUTED',
          role: 'CUSTOMER',
          noteAr: reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage('تم تسجيل ملاحظتك ورفع الطلب إلى فريق العمليات للحل الفوري.');
        fetchOrder();
      }
    } catch (e) {
      alert('حدث خطأ أثناء تسجيل الشكوى');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">جاري تحميل تفاصيل تتبع الطلب...</p>
        </div>
      </div>
    );
  }

  if (!masterOrder) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4" dir="rtl">
        <FileText className="w-12 h-12 text-slate-600" />
        <h2 className="text-xl font-bold text-white">الطلب غير موجود أو تعذر الوصول إليه</h2>
        <Link href="/bookings" className="bg-amber-500 text-slate-950 px-6 py-2.5 rounded-xl font-bold text-xs">
          العودة لحجوزاتي
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      {toastMessage && (
        <div className="fixed top-6 left-6 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/bookings"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white">تتبع الطلب: {masterOrder.orderNumber}</h1>
              <p className="text-xs text-slate-400">تاريخ المناسبة: {masterOrder.eventDate} | المدينة: {masterOrder.cityNameAr}</p>
            </div>
          </div>

          <button
            onClick={() => setShowLuma(!showLuma)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>المساعد لُـمى</span>
          </button>
        </div>

        {/* Luma Assistant Drawer */}
        {showLuma && masterOrder.suborders.length > 0 && (
          <LumaOMSAssistant
            suborder={masterOrder.suborders[0]}
            masterOrder={masterOrder}
            onClose={() => setShowLuma(false)}
          />
        )}

        {/* Lifecycle Visual Timeline Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-sm">مراحل تنفيذ الطلب الرئيسي</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center space-y-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white">1. تأكيد الدفع</div>
              <div className="text-[10px] text-slate-500">تم التأكيد</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center space-y-1">
              <Clock className="w-5 h-5 text-amber-400 mx-auto" />
              <div className="text-xs font-bold text-white">2. توجيه الموردين</div>
              <div className="text-[10px] text-amber-400 font-semibold">جارية المتابعة</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center space-y-1">
              <Building2 className="w-5 h-5 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-400">3. التنفيذ والعمل</div>
              <div className="text-[10px] text-slate-500">بانتظار الاكتمال</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center space-y-1">
              <ShieldCheck className="w-5 h-5 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-400">4. التسليم والاعتماد</div>
              <div className="text-[10px] text-slate-500">فترة المراجعة</div>
            </div>
          </div>
        </div>

        {/* Suborders Multi-Vendor Breakdown */}
        <div className="space-y-4">
          <h3 className="font-bold text-white text-base">خدمات الموردين في طلبك ({masterOrder.suborders.length})</h3>

          {masterOrder.suborders.map((sub) => (
            <div
              key={sub.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-amber-300 text-base">{sub.vendorName}</h4>
                  <p className="text-xs text-slate-400 font-mono">رقم الحجز: {sub.bookingNumber}</p>
                </div>

                <span className="bg-slate-950 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto">
                  حالة الخدمة: {sub.omsStatus}
                </span>
              </div>

              {/* Deliverables URL if uploaded */}
              {sub.deliverablesUrl && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between">
                  <div className="text-xs text-emerald-300 font-bold">
                    قام المورد برفع مخرجات الخدمة والملفات النهائية.
                  </div>
                  <a
                    href={sub.deliverablesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <span>معاينة الملفات</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Customer Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {['READY_FOR_DELIVERY', 'DELIVERED'].includes(sub.omsStatus) && (
                  <button
                    onClick={() => handleCustomerApprove(sub.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    اعتماد استلام الخدمة واكتمال الطلب
                  </button>
                )}

                <button
                  onClick={() => handleOpenDispute(sub.id)}
                  className="bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold px-4 py-2.5 rounded-xl text-xs border border-rose-500/30 transition"
                >
                  تقديم ملاحظة / فتح نزاع
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
