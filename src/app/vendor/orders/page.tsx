'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  FileText,
  Send,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Zap,
  Calendar,
  DollarSign,
  User,
} from 'lucide-react';
import type { OMSMasterOrder, OMSSuborder } from '@/lib/oms/types';

export default function SupplierOrderWorkspace() {
  const [orders, setOrders] = useState<OMSMasterOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'deliver' | 'all'>('pending');
  const [selectedSuborder, setSelectedSuborder] = useState<{ sub: OMSSuborder; master: OMSMasterOrder } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [deliverableUrl, setDeliverableUrl] = useState<string>('');
  const [proofNotes, setProofNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/oms/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error('Failed to fetch vendor orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAction = async (targetState: string, noteAr?: string) => {
    if (!selectedSuborder) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/oms/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborderId: selectedSuborder.sub.id,
          targetState,
          role: 'VENDOR',
          noteAr: noteAr || rejectReason || proofNotes || 'إجراء من المورد عبر مساحة العمل',
          deliverablesUrl: deliverableUrl || undefined,
          proofOfDelivery: proofNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`تم تحديث حالة الطلب بنجاح إلى [${targetState}]`);
        setSelectedSuborder(null);
        setRejectReason('');
        setDeliverableUrl('');
        setProofNotes('');
        fetchOrders();
      } else {
        alert(data.errorAr || 'فشل تنفيذ الإجراء');
      }
    } catch (e) {
      alert('خطأ أثناء التواصل مع السيرفر');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const allSuborders = orders.flatMap((m) => m.suborders.map((sub) => ({ sub, master: m })));

  const pendingSuborders = allSuborders.filter((r) => r.sub.omsStatus === 'AWAITING_ACCEPTANCE');
  const activeSuborders = allSuborders.filter((r) => ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_CUSTOMER_INFO'].includes(r.sub.omsStatus));
  const deliverableSuborders = allSuborders.filter((r) => ['READY_FOR_DELIVERY', 'DELIVERED'].includes(r.sub.omsStatus));

  const filtered = allSuborders.filter((r) => {
    if (activeTab === 'pending') return r.sub.omsStatus === 'AWAITING_ACCEPTANCE';
    if (activeTab === 'active') return ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_CUSTOMER_INFO'].includes(r.sub.omsStatus);
    if (activeTab === 'deliver') return ['READY_FOR_DELIVERY', 'DELIVERED'].includes(r.sub.omsStatus);
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-6 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">مساحة عمل الطلبات للموردين</h1>
              <p className="text-xs md:text-sm text-slate-400">إدارة الطلبات الجديدة والتنفيذ ورفع المخرجات والتواصل مع العملاء</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="bg-amber-950/40 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-amber-400">طلبات جديدة بانتظار القبول</div>
            <div className="text-3xl font-black text-white mt-1">{pendingSuborders.length}</div>
          </div>
          <Clock className="w-8 h-8 text-amber-400" />
        </div>

        <div className="bg-blue-950/40 border border-blue-500/30 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-400">طلبات قيد التنفيذ النشطة</div>
            <div className="text-3xl font-black text-white mt-1">{activeSuborders.length}</div>
          </div>
          <Zap className="w-8 h-8 text-blue-400" />
        </div>

        <div className="bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-400">جاهزة للتسليم / مسلّمة</div>
            <div className="text-3xl font-black text-white mt-1">{deliverableSuborders.length}</div>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-6 w-full sm:w-auto">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>جديدة بانتظار القبول ({pendingSuborders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>قيد التنفيذ ({activeSuborders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deliver')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'deliver' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>تسليم الخدمة ({deliverableSuborders.length})</span>
        </button>
      </div>

      {/* Orders List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-500">جاري تحميل طلباتك...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-slate-900 rounded-3xl border border-slate-800 text-slate-500">
            لا توجد طلبات حواها هذا القسم حالياً
          </div>
        ) : (
          filtered.map(({ sub, master }) => (
            <div
              key={sub.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-mono text-xs font-bold text-amber-400">{sub.bookingNumber}</span>
                <span className="text-[11px] bg-slate-950 px-3 py-1 rounded-full text-slate-300 font-bold">
                  {sub.omsStatus}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-white">{master.customerName}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>موعد الفعالية: <strong className="text-amber-300">{master.eventDate}</strong></span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span>المبلغ الإجمالي: <strong className="text-white">{sub.totalAmount.toLocaleString()} ر.س</strong></span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                {sub.items.map((item) => (
                  <div key={item.id} className="text-xs font-medium text-slate-300">
                    • {item.serviceTitleAr}
                  </div>
                ))}
              </div>

              {/* Actions depending on status */}
              <div className="pt-2">
                {sub.omsStatus === 'AWAITING_ACCEPTANCE' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAction('ACCEPTED', 'تم قبول الطلب من قبل المورد')}
                      disabled={isProcessing}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                    >
                      قبول الطلب
                    </button>
                    <button
                      onClick={() => setSelectedSuborder({ sub, master })}
                      className="bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold py-2.5 rounded-xl text-xs border border-rose-500/40 transition"
                    >
                      اعتذار وتوضيح
                    </button>
                  </div>
                )}

                {sub.omsStatus === 'ACCEPTED' && (
                  <button
                    onClick={() => handleAction('IN_PROGRESS', 'بدء تنفيذ الخدمة وتحضير التجهيزات')}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    بدء التنفيذ والعمل
                  </button>
                )}

                {['IN_PROGRESS', 'READY_FOR_DELIVERY'].includes(sub.omsStatus) && (
                  <button
                    onClick={() => setSelectedSuborder({ sub, master })}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع المخرجات وتسليم الخدمة</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload / Reject Modal */}
      {selectedSuborder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">إجراء على الطلب: {selectedSuborder.sub.bookingNumber}</h3>
              <button
                onClick={() => setSelectedSuborder(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {selectedSuborder.sub.omsStatus === 'AWAITING_ACCEPTANCE' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">يرجى توضيح سبب الاعتذار عن قبول الطلب ليتم توجيهه لمورد آخر دون التأثير على العميل:</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="سبب الاعتذار (عدم توفر الموعد، خارج التغطية...)"
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 focus:border-rose-500 outline-none h-24"
                />
                <button
                  onClick={() => handleAction('REJECTED', rejectReason)}
                  disabled={isProcessing}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl text-xs transition"
                >
                  تأكيد الاعتذار
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رابط المخرجات والملفات النهائية (Drive, Dropbox, Gallery):</label>
                  <input
                    type="url"
                    value={deliverableUrl}
                    onChange={(e) => setDeliverableUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">إثبات وملاحظات التسليم:</label>
                  <textarea
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    placeholder="تفاصيل التجهيز وإثبات إنجاز الخدمة للعميل..."
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 focus:border-amber-500 outline-none h-24"
                  />
                </div>

                <button
                  onClick={() => handleAction('DELIVERED')}
                  disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  تسليم الخدمة للعميل واعتماد الانتهاء
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
