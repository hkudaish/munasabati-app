'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  Search,
  Filter,
  User,
  Building2,
  FileText,
  Zap,
  ArrowRight,
  Settings,
  AlertOctagon,
  Eye,
  SlidersHorizontal,
  Bell,
  Activity,
  Kanban,
  Table,
  CheckSquare,
  XCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type { OMSMasterOrder, OMSSuborder, OMSException, OMSSettings, OMSOrderStatus } from '@/lib/oms/types';

export default function OMSAdminCommandCenter() {
  const [orders, setOrders] = useState<OMSMasterOrder[]>([]);
  const [exceptions, setExceptions] = useState<OMSException[]>([]);
  const [settings, setSettings] = useState<OMSSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [activeTab, setActiveTab] = useState<'urgent' | 'all' | 'delayed'>('urgent');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSuborder, setSelectedSuborder] = useState<{ suborder: OMSSuborder; master: OMSMasterOrder } | null>(null);
  const [actionNote, setActionNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchOMSData = async () => {
    setLoading(true);
    try {
      const resOrders = await fetch('/api/oms/orders');
      const dataOrders = await resOrders.json();

      const resSettings = await fetch('/api/oms/settings');
      const dataSettings = await resSettings.json();

      if (dataOrders.success) setOrders(dataOrders.orders || []);
      if (dataSettings.success) setSettings(dataSettings.settings);
    } catch (e) {
      console.error('Failed to load OMS data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOMSData();
  }, []);

  const triggerWatchdogScan = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/oms/watchdog', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`تم تنفيذ المسح الذاتي بنجاح. رصد ${data.newExceptionsCount} استثناءات جديدة.`);
        fetchOMSData();
      }
    } catch (e) {
      setToastMessage('فشل تشغيل المراقبة الذاتية');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleStateTransition = async (targetState: string) => {
    if (!selectedSuborder) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/oms/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suborderId: selectedSuborder.suborder.id,
          targetState,
          role: 'ADMIN',
          noteAr: actionNote || 'تدخل إداري مباشر من لوحة التحكم التشغيلية',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`تم تحديث حالة الطلب إلى [${targetState}] بنجاح`);
        setSelectedSuborder(null);
        setActionNote('');
        fetchOMSData();
      } else {
        alert(data.errorAr || 'فشل تنفيذ الإجراء');
      }
    } catch (e) {
      alert('خطأ في الاتصال بالسيرفر');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const allSuborderRows = orders.flatMap((master) =>
    master.suborders.map((sub) => ({ sub, master }))
  );

  const totalOrders = allSuborderRows.length;
  const awaitingVendorCount = allSuborderRows.filter((r) => r.sub.omsStatus === 'AWAITING_ACCEPTANCE').length;
  const inProgressCount = allSuborderRows.filter((r) => r.sub.omsStatus === 'IN_PROGRESS').length;
  const readyCount = allSuborderRows.filter((r) => ['READY_FOR_DELIVERY', 'DELIVERED'].includes(r.sub.omsStatus)).length;
  const delayedCount = allSuborderRows.filter((r) => r.sub.isDelayed || r.sub.isAtRisk).length;
  const completedCount = allSuborderRows.filter((r) => ['COMPLETED', 'CLOSED'].includes(r.sub.omsStatus)).length;
  const disputedCount = allSuborderRows.filter((r) => r.sub.omsStatus === 'DISPUTED').length;

  const urgentSuborders = allSuborderRows.filter(
    (r) =>
      r.sub.isDelayed ||
      r.sub.isAtRisk ||
      r.sub.omsStatus === 'AWAITING_ACCEPTANCE' ||
      r.sub.omsStatus === 'DISPUTED' ||
      r.sub.omsStatus === 'UNRESPONSIVE_VENDOR'
  );

  const filteredSuborders = allSuborderRows.filter(({ sub, master }) => {
    if (activeTab === 'urgent') {
      return (
        sub.isDelayed ||
        sub.isAtRisk ||
        sub.omsStatus === 'AWAITING_ACCEPTANCE' ||
        sub.omsStatus === 'DISPUTED'
      );
    }
    if (activeTab === 'delayed') return sub.isDelayed || sub.isAtRisk;
    if (statusFilter !== 'ALL' && sub.omsStatus !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        sub.bookingNumber.toLowerCase().includes(q) ||
        master.orderNumber.toLowerCase().includes(q) ||
        master.customerName.toLowerCase().includes(q) ||
        sub.vendorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group suborders by Kanban Columns
  const kanbanColumns: { id: string; titleAr: string; color: string; items: typeof allSuborderRows }[] = [
    {
      id: 'AWAITING_ACCEPTANCE',
      titleAr: 'بانتظار القبول',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
      items: filteredSuborders.filter((r) => r.sub.omsStatus === 'AWAITING_ACCEPTANCE'),
    },
    {
      id: 'IN_PROGRESS',
      titleAr: 'قيد التنفيذ والعمل',
      color: 'border-blue-500/40 bg-blue-950/20 text-blue-400',
      items: filteredSuborders.filter((r) => ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_CUSTOMER_INFO'].includes(r.sub.omsStatus)),
    },
    {
      id: 'READY_DELIVERY',
      titleAr: 'التسليم والمراجعة',
      color: 'border-purple-500/40 bg-purple-950/20 text-purple-400',
      items: filteredSuborders.filter((r) => ['READY_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER_REVIEW'].includes(r.sub.omsStatus)),
    },
    {
      id: 'COMPLETED',
      titleAr: 'مكتمل ومغلق',
      color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
      items: filteredSuborders.filter((r) => ['COMPLETED', 'CLOSED'].includes(r.sub.omsStatus)),
    },
    {
      id: 'EXCEPTIONS_DISPUTES',
      titleAr: 'متأخرة / نزاعات',
      color: 'border-rose-500/40 bg-rose-950/20 text-rose-400',
      items: filteredSuborders.filter((r) => r.sub.isDelayed || r.sub.omsStatus === 'DISPUTED' || r.sub.omsStatus === 'UNRESPONSIVE_VENDOR'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-6 z-50 bg-amber-500 text-slate-950 font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Bell className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20 font-black">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-white">مركز التحكم التشغيلي للطلبات</h1>
              <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                OMS v2.0
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              نظام أتمتة الطلبات ومراقبة الموردين وإدارة اتفاقيات مستوى الخدمة (SLA Dashboard)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle: Kanban vs Table */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'kanban'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>لوحة Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>جدول البيانات</span>
            </button>
          </div>

          <button
            onClick={triggerWatchdogScan}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-amber-400 px-4 py-2 rounded-xl text-xs font-bold transition border border-amber-500/30 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>مسح المراقبة الذاتية</span>
          </button>

          <Link
            href="/admin/oms/settings"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <Settings className="w-4 h-4" />
            <span>قواعد الأتمتة</span>
          </Link>
        </div>
      </div>

      {/* Modern KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 my-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>إجمالي الطلبات</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalOrders}</div>
          <div className="text-[10px] text-slate-500 mt-1">خدمات مسجلة بالمنصة</div>
        </div>

        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-amber-400 text-xs mb-2">
            <span>بانتظار المورد</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{awaitingVendorCount}</div>
          <div className="text-[10px] text-amber-400/70 mt-1">مهلة التثبيت جارية</div>
        </div>

        <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-blue-400 text-xs mb-2">
            <span>قيد التنفيذ</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300">{inProgressCount}</div>
          <div className="text-[10px] text-blue-400/70 mt-1">تجهيز العمل القائم</div>
        </div>

        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4">
          <div className="flex items-center justify-between text-rose-400 text-xs mb-2">
            <span>مهددة / متأخرة</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300">{delayedCount}</div>
          <div className="text-[10px] text-rose-400/70 mt-1">تدخل العمليات الفوري</div>
        </div>

        <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-purple-400 text-xs mb-2">
            <span>نزاعات مفتوحة</span>
            <AlertOctagon className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">{disputedCount}</div>
          <div className="text-[10px] text-purple-400/70 mt-1">تحت التحقيق</div>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-2">
            <span>مكتملة ومستلمة</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{completedCount}</div>
          <div className="text-[10px] text-emerald-400/70 mt-1">تم إغلاقها بنجاح</div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('urgent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'urgent'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>طلبات تتطلب تدخلاً الآن ({urgentSuborders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>كافة الطلبات النشطة ({totalOrders})</span>
            </button>

            <button
              onClick={() => setActiveTab('delayed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'delayed'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>متأخرة عن SLA ({delayedCount})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الطلب، العميل، المورد..."
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pr-9 pl-4 py-2.5 focus:border-amber-500 outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:border-amber-500 outline-none"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="AWAITING_ACCEPTANCE">بانتظار قبول المورد</option>
              <option value="ACCEPTED">مقبول</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="READY_FOR_DELIVERY">جاهز للتسليم</option>
              <option value="DELIVERED">تم التسليم</option>
              <option value="DISPUTED">نزاع مفتوح</option>
              <option value="COMPLETED">مكتمل ومغلق</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Kanban vs Table */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-6">
          {kanbanColumns.map((col) => (
            <div key={col.id} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex flex-col h-[680px]">
              <div className={`p-3 rounded-2xl border ${col.color} flex items-center justify-between mb-4`}>
                <h3 className="font-bold text-xs">{col.titleAr}</h3>
                <span className="text-xs font-black bg-slate-950/80 px-2 py-0.5 rounded-full">
                  {col.items.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {col.items.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs font-medium">
                    لا توجد طلبات بمفردات هذا العمود
                  </div>
                ) : (
                  col.items.map(({ sub, master }) => {
                    const isRisk = sub.isDelayed || sub.isAtRisk;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSuborder({ suborder: sub, master })}
                        className={`bg-slate-950 border rounded-2xl p-4 space-y-3 cursor-pointer hover:border-amber-500/60 transition shadow-lg relative group ${
                          isRisk ? 'border-rose-500/60 bg-rose-950/10' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{sub.bookingNumber}</span>
                          <span className="text-[10px] text-slate-400">{master.cityNameAr}</span>
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-xs">{sub.vendorName}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">العميل: {master.customerName}</p>
                        </div>

                        {/* Items Summary */}
                        <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-800/50">
                          {sub.items.map((i) => i.serviceTitleAr).join(' • ')}
                        </div>

                        {/* SLA Indicator */}
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-slate-400">الإجمالي: <strong className="text-white">{sub.totalAmount.toLocaleString()} ر.س</strong></span>
                          {sub.isDelayed ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> متأخر
                            </span>
                          ) : (
                            <span className="text-emerald-400">ضمن المهلة</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Data Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">رقم الطلب والحجز</th>
                  <th className="p-4">العميل والمناسبة</th>
                  <th className="p-4">المورد والخدمة</th>
                  <th className="p-4">حالة الطلب</th>
                  <th className="p-4">المسؤول والإجراء التالي</th>
                  <th className="p-4">مؤشر SLA والمهلة</th>
                  <th className="p-4">المبلغ الإجمالي</th>
                  <th className="p-4 text-center">الإجراء والتدخل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">
                      جاري تحميل بيانات نظام إدارة الطلبات...
                    </td>
                  </tr>
                ) : filteredSuborders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">
                      لا توجد طلبات تطابق نتائج الفلترة الحالية
                    </td>
                  </tr>
                ) : (
                  filteredSuborders.map(({ sub, master }) => {
                    const isUrgent = sub.isDelayed || sub.isAtRisk || sub.omsStatus === 'AWAITING_ACCEPTANCE';
                    return (
                      <tr
                        key={sub.id}
                        className={`hover:bg-slate-800/50 transition ${isUrgent ? 'bg-rose-950/10' : ''}`}
                      >
                        <td className="p-4 font-mono">
                          <div className="font-bold text-white">{sub.bookingNumber}</div>
                          <div className="text-[10px] text-slate-500">الرئيسي: {master.orderNumber}</div>
                        </td>

                        <td className="p-4">
                          <div className="font-semibold text-white">{master.customerName}</div>
                          <div className="text-[10px] text-slate-400">{master.customerPhone} | {master.cityNameAr}</div>
                          <div className="text-[10px] text-amber-400">{master.eventDate}</div>
                        </td>

                        <td className="p-4">
                          <div className="font-semibold text-amber-300">{sub.vendorName}</div>
                          <div className="text-[10px] text-slate-400">إجمالي الحجز: {sub.totalAmount.toLocaleString()} ر.س</div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              sub.omsStatus === 'AWAITING_ACCEPTANCE'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : sub.omsStatus === 'IN_PROGRESS'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : sub.omsStatus === 'DELIVERED' || sub.omsStatus === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : sub.omsStatus === 'DISPUTED'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {sub.omsStatus}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="text-white font-medium">{sub.nextAction}</div>
                          <div className="text-[10px] text-slate-400">المسؤول: {sub.assignedRole}</div>
                        </td>

                        <td className="p-4">
                          {sub.isDelayed ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              متأخر عن SLA
                            </span>
                          ) : sub.isAtRisk ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5" />
                              مهدد بالتأخير
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">ضمن المهلة المحددة</span>
                          )}
                        </td>

                        <td className="p-4 font-mono text-white font-bold">
                          {sub.totalAmount.toLocaleString()} ر.س
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedSuborder({ suborder: sub, master })}
                            className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1.5 mx-auto"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            إجراء وتدخل
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Drawer Modal */}
      {selectedSuborder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">التدخل التشغيلي للطلب: {selectedSuborder.suborder.bookingNumber}</h3>
                <p className="text-xs text-slate-400">المورد: {selectedSuborder.suborder.vendorName} | العميل: {selectedSuborder.master.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedSuborder(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">الحالة الحالية:</span>
                  <span className="text-amber-400 font-bold">{selectedSuborder.suborder.omsStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الإجراء المتوقع التالي:</span>
                  <span className="text-white font-medium">{selectedSuborder.suborder.nextAction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الطرف المسؤول حالياً:</span>
                  <span className="text-white font-medium">{selectedSuborder.suborder.assignedRole}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">ملاحظة التدخل والإجراء الإداري (مطلوبة للتدقيق):</label>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="اكتب سبب الإجراء أو قرار التدخل..."
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 focus:border-amber-500 outline-none h-24"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => handleStateTransition('ACCEPTED')}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition"
                >
                  قبول نيابة عن المورد
                </button>

                <button
                  onClick={() => handleStateTransition('IN_PROGRESS')}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition"
                >
                  بدء التنفيذ فوراً
                </button>

                <button
                  onClick={() => handleStateTransition('REASSIGNMENT_REQUESTED')}
                  disabled={isProcessing}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold py-2.5 px-3 rounded-xl transition"
                >
                  إعادة إسناد لمورد بديل
                </button>

                <button
                  onClick={() => handleStateTransition('COMPLETED')}
                  disabled={isProcessing}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition"
                >
                  اعتماد اكتمال الطلب
                </button>

                <button
                  onClick={() => handleStateTransition('CANCELLED')}
                  disabled={isProcessing}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition col-span-2 sm:col-span-1"
                >
                  إلغاء الطلب والاسترجاع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
