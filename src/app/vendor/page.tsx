'use client';

import React, { useState } from 'react';
import {
  Store,
  ShieldCheck,
  DollarSign,
  Calendar,
  FileText,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Upload,
  Wallet,
  CalendarOff,
  ExternalLink,
  Package,
  Trash2,
  Users,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { Booking, RFQRequest } from '@/lib/types';
import { AddServiceModal } from '@/components/vendor/AddServiceModal';
import { VendorWalletModal } from '@/components/vendor/VendorWalletModal';

export default function VendorPortalPage() {
  const { vendors, bookings, rfqRequests, services, updateBookingStatus } = useApp();

  const currentVendor = vendors[0]; // Active demo vendor (ضيافة نجد الأصيلة)

  const [activeTab, setActiveTab] = useState<'bookings' | 'rfqs' | 'services' | 'availability' | 'verification'>('bookings');
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // Blackout dates state
  const [blackoutDates, setBlackoutDates] = useState<string[]>([
    '2026-09-23', // Saudi National Day
    '2026-10-15',
    '2026-10-16',
  ]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');

  // Verification document submission simulation state
  const [crInput, setCrInput] = useState(currentVendor.crNumber || '1010784920');
  const [vatInput, setVatInput] = useState(currentVendor.vatNumber || '310984920100003');
  const [ibanInput, setIbanInput] = useState('SA44 8000 0456 1234 5678 9012');
  const [isDocSaved, setIsDocSaved] = useState(false);

  // Quote submit form inside RFQ tab
  const [respondingRFQId, setRespondingRFQId] = useState<string | null>(null);
  const [quoteBasePrice, setQuoteBasePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteSentSuccess, setQuoteSentSuccess] = useState(false);

  const vendorBookings = bookings.filter((b) => b.vendorId === currentVendor.id || b.vendorName.includes('ضيافة'));
  const totalRevenue = vendorBookings.reduce((acc, b) => acc + b.totalAmount, 0);
  const vendorServices = services.filter((s) => s.vendorId === currentVendor.id || s.vendorName.includes('ضيافة'));

  const handleSendQuote = (e: React.FormEvent, rfq: RFQRequest) => {
    e.preventDefault();
    setQuoteSentSuccess(true);
    setTimeout(() => {
      setRespondingRFQId(null);
      setQuoteSentSuccess(false);
      setQuoteBasePrice('');
      setQuoteNotes('');
    }, 1500);
  };

  const handleAddBlackoutDate = (dateToAdd?: string) => {
    const d = dateToAdd || newBlackoutDate;
    if (d && !blackoutDates.includes(d)) {
      setBlackoutDates([...blackoutDates, d].sort());
      setNewBlackoutDate('');
    }
  };

  const handleRemoveBlackoutDate = (dateToRemove: string) => {
    setBlackoutDates(blackoutDates.filter((d) => d !== dateToRemove));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Vendor Profile Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={currentVendor.logo}
            alt={currentVendor.businessName}
            className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-sm"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black font-cairo text-saudi-green-950">
                {currentVendor.businessName}
              </h1>
              {currentVendor.verified && (
                <span className="bg-saudi-green-100 text-saudi-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-saudi-green-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  موثق رسمياً 🇸🇦
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {currentVendor.categoryNameAr} • {currentVendor.cityNameAr} • س.ت: {currentVendor.crNumber}
            </p>
          </div>
        </div>

        {/* Quick action buttons & Performance metrics */}
        <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-end">
          <Link
            href={`/vendor/${currentVendor.id}`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-900 border border-saudi-sand-300 flex items-center gap-1.5 transition"
          >
            <Eye className="w-3.5 h-3.5 text-saudi-gold-600" />
            <span>معاينة الملف العام</span>
          </Link>

          <button
            onClick={() => setIsWalletOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 shadow-sm flex items-center gap-1.5 transition"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>محفظة المستحقات</span>
          </button>

          <button
            onClick={() => setIsAddServiceOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-saudi-green-800 hover:bg-saudi-green-900 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-saudi-gold-300" />
            <span>إضافة خدمة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>إجمالي المبيعات والأرباح</span>
            <DollarSign className="w-4 h-4 text-saudi-green-800" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-green-950 block mt-2">
            {formatSAR(totalRevenue + 45000)}
          </span>
          <span className="text-[11px] text-green-700 font-semibold block mt-1">+18% عن الشهر الماضي</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>حجوزات هذا الشهر</span>
            <Calendar className="w-4 h-4 text-saudi-gold-600" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-gold-700 block mt-2">
            {vendorBookings.length + 8} مناسبات
          </span>
          <span className="text-[11px] text-gray-400 block mt-1">جميعها مؤكدة بعربون</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>طلبات تسعير (RFQ) نشطة</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black font-cairo text-blue-700 block mt-2">
            {rfqRequests.length} طلبات
          </span>
          <span className="text-[11px] text-gray-400 block mt-1">فرص حجز جديدة بانتظار عرضك</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>التقييم وسرعة الرد</span>
            <Star className="w-4 h-4 text-saudi-gold-500 fill-saudi-gold-500" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-gold-700 block mt-2">
            ★ {currentVendor.rating}
          </span>
          <span className="text-[11px] text-saudi-green-800 font-semibold block mt-1">
            رد فوري خلال {currentVendor.responseTimeMinutes} دقيقة ⚡
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-saudi-sand-300 flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'bookings'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-saudi-gold-600" />
          <span>جدول الحجوزات ({vendorBookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rfqs')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'rfqs'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 text-saudi-gold-600" />
          <span>طلبات عروض الأسعار الواردة ({rfqRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'services'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4 text-saudi-gold-600" />
          <span>خدماتي وباقاتي ({vendorServices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'availability'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <CalendarOff className="w-4 h-4 text-saudi-gold-600" />
          <span>جدول الإتاحة وأيام الإغلاق ({blackoutDates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'verification'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-saudi-gold-600" />
          <span>التوثيق والوثائق الرسمية</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {/* Bookings tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-cairo">
              الحجوزات القادمة والمؤكدة
            </h3>
            <div className="space-y-3">
              {vendorBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl p-5 border border-saudi-sand-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-saudi-gold-600">
                        {b.bookingNumber}
                      </span>
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {b.status === 'confirmed' ? 'مؤكد بالعربون' : b.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{b.serviceTitleAr}</h4>
                    <p className="text-xs text-gray-500">
                      العميل: <strong className="text-gray-800">{b.customerName}</strong> ({b.customerPhone}) • موعد المناسبة: {b.date}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-left">
                      <span className="text-[10px] text-gray-400 block">إجمالي العقد:</span>
                      <strong className="text-sm font-black font-cairo text-saudi-green-950">
                        {formatSAR(b.totalAmount)}
                      </strong>
                    </div>

                    <select
                      value={b.status}
                      onChange={(e) => updateBookingStatus(b.id, e.target.value as any)}
                      className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs font-bold text-saudi-green-900 focus:outline-none"
                    >
                      <option value="confirmed">مؤكد (قيد التحضير)</option>
                      <option value="underway">جاري التنفيذ باليوم</option>
                      <option value="completed">تم إتمام المناسبة</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RFQs tab */}
        {activeTab === 'rfqs' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-cairo">
              طلبات عروض الأسعار المتاحة لمدينتك ({rfqRequests.length})
            </h3>
            <div className="space-y-4">
              {rfqRequests.map((rfq) => (
                <div
                  key={rfq.id}
                  className="bg-white rounded-2xl p-6 border border-saudi-sand-300 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-saudi-gold-600 font-mono">
                        طلب #{rfq.id} • {rfq.cityAr}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">
                        {rfq.occasionTitle} ({rfq.occasionTypeAr})
                      </h4>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-gray-400 block">ميزانية العميل المقدرة:</span>
                      <span className="text-sm font-black font-cairo text-saudi-green-950">
                        {formatSAR(rfq.budget)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 bg-saudi-sand-50 p-3 rounded-xl leading-relaxed">
                    المواصفات المطلوبة: "{rfq.requirementsAr}"
                  </p>

                  {/* Quote response trigger */}
                  {respondingRFQId === rfq.id ? (
                    <form
                      onSubmit={(e) => handleSendQuote(e, rfq)}
                      className="bg-saudi-green-50 p-4 rounded-2xl border border-saudi-green-200 space-y-3 animate-fadeIn"
                    >
                      <h5 className="text-xs font-bold text-saudi-green-900">
                        تقديم عرض سعر مفصل للعميل:
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            السعر الإجمالي شامل التركيب والضريبة (ر.س)
                          </label>
                          <input
                            type="number"
                            value={quoteBasePrice}
                            onChange={(e) => setQuoteBasePrice(e.target.value)}
                            placeholder="مثال: 4500"
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-saudi-gold-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            ملاحظات ومواعيد التجهيز
                          </label>
                          <input
                            type="text"
                            value={quoteNotes}
                            onChange={(e) => setQuoteNotes(e.target.value)}
                            placeholder="التركيب قبل الحفل بـ 3 ساعات، كادر سعودي بالزي الرسمي..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-saudi-gold-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setRespondingRFQId(null)}
                          className="px-3 py-1.5 text-xs text-gray-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-saudi-green-800 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5 rotate-180" />
                          <span>إرسال العرض للعميل</span>
                        </button>
                      </div>

                      {quoteSentSuccess && (
                        <span className="text-xs text-green-700 font-bold block text-center">
                          تم إرسال عرضك بنجاح وسيظهر للعميل في جدول المقارنة! ✨
                        </span>
                      )}
                    </form>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setRespondingRFQId(rfq.id)}
                        className="px-5 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-saudi-gold-300" />
                        <span>تقديم عرض سعر لهذا الطلب</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services & Packages Tab */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-cairo">
                  الباقات والخدمات المعروضة في المنصة ({vendorServices.length})
                </h3>
                <p className="text-xs text-gray-500">
                  يمكنك إدارة وتحديث أسعار وتفاصيل خدماتك لتظهر للعملاء في سوق المناسبات.
                </p>
              </div>

              <button
                onClick={() => setIsAddServiceOpen(true)}
                className="px-4 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
              >
                <Plus className="w-4 h-4 text-saudi-gold-300" />
                <span>إضافة خدمة جديدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendorServices.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 shadow-sm overflow-hidden flex flex-col justify-between hover:border-saudi-gold-400 transition"
                >
                  <div>
                    <div className="relative h-44 w-full bg-saudi-sand-100">
                      <img
                        src={(srv.images && srv.images.length > 0) ? srv.images[0] : currentVendor.logo}
                        alt={srv.titleAr}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 right-3 bg-saudi-green-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        {srv.categoryNameAr}
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <h4 className="text-sm font-bold text-saudi-green-950 font-cairo leading-snug">
                        {srv.titleAr}
                      </h4>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {srv.descriptionAr}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                        {srv.capacityMax && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-saudi-gold-600" />
                            <span>حتى {srv.capacityMax} ضيف</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-saudi-gold-500 fill-saudi-gold-500" />
                          <span>{srv.vendorRating || currentVendor.rating} ({currentVendor.reviewsCount})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0 border-t border-gray-100 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block">السعر الأساسي</span>
                      <strong className="text-base font-black font-cairo text-saudi-green-950">
                        {formatSAR(srv.price)}
                      </strong>
                    </div>

                    <Link
                      href={`/vendor/${currentVendor.id}`}
                      className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1"
                    >
                      <span>عرض في السوق</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability & Blackout Dates Tab */}
        {activeTab === 'availability' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
                  <CalendarOff className="w-5 h-5 text-saudi-gold-600" />
                  <span>جدول الإتاحة وحظر المواعيد غير المتاحة (Blackout Dates)</span>
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  حدد الأيام التي تكون فيها خدماتك محجوزة بالكامل أو في عطلة لتفادي استقبال حجوزات جديدة في هذه الأيام.
                </p>
              </div>

              {/* Add Blackout Date Form */}
              <div className="bg-saudi-sand-50 p-5 rounded-2xl border border-saudi-sand-300 space-y-4">
                <h4 className="text-xs font-bold text-gray-800">إضافة تاريخ غير متاح جديد:</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="date"
                    value={newBlackoutDate}
                    onChange={(e) => setNewBlackoutDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-saudi-gold-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddBlackoutDate()}
                    disabled={!newBlackoutDate}
                    className="px-5 py-2.5 bg-saudi-green-800 disabled:opacity-50 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4 text-saudi-gold-300" />
                    <span>حظر هذا التاريخ</span>
                  </button>
                </div>

                {/* Quick Saudi Season Presets */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-gray-500 block">اختصارات سريعة للمناسبات الوطنية الكبرى:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddBlackoutDate('2026-09-23')}
                      className="text-[11px] font-semibold bg-white border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-lg text-saudi-green-900 transition"
                    >
                      🇸🇦 اليوم الوطني (23 سبتمبر)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlackoutDate('2027-02-22')}
                      className="text-[11px] font-semibold bg-white border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-lg text-saudi-green-900 transition"
                    >
                      🦅 يوم التأسيس (22 فبراير)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlackoutDate('2027-03-20')}
                      className="text-[11px] font-semibold bg-white border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-lg text-saudi-green-900 transition"
                    >
                      🌙 عطلة عيد الفطر
                    </button>
                  </div>
                </div>
              </div>

              {/* List of currently blacked out dates */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700">التواريخ المغلقة حالياً ({blackoutDates.length}):</h4>
                {blackoutDates.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">لا توجد تواريخ محظورة حالياً، متجرك متاح للحجز في جميع الأيام.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {blackoutDates.map((date) => (
                      <div
                        key={date}
                        className="flex items-center justify-between p-3.5 bg-red-50/50 border border-red-100 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarOff className="w-4 h-4 text-red-500" />
                          <span className="font-mono font-bold text-gray-800">{date}</span>
                          {date === '2026-09-23' && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                              اليوم الوطني
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlackoutDate(date)}
                          className="text-gray-400 hover:text-red-600 transition p-1"
                          title="إلغاء الحظر وإتاحة اليوم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6 max-w-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-saudi-green-800" />
                <span>توثيق الهوية والسجلات التجارية السعودية</span>
              </h3>
              <p className="text-xs text-gray-500">
                للحصول على شارة "موثوق 🇸🇦" والحجز الفوري، يرجى استكمال بيانات التوثيق النظامية.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsDocSaved(true);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  رقم السجل التجاري (CR) أو وثيقة العمل الحر
                </label>
                <input
                  type="text"
                  value={crInput}
                  onChange={(e) => setCrInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الرقم الضريبي (ZATCA VAT Number)
                </label>
                <input
                  type="text"
                  value={vatInput}
                  onChange={(e) => setVatInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الآيبان البنكي لاستقبال المستحقات (IBAN)
                </label>
                <input
                  type="text"
                  value={ibanInput}
                  onChange={(e) => setIbanInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-saudi-gold-500 text-left dir-ltr"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {isDocSaved ? (
                  <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    تم تحديث وحفظ بيانات التوثيق بنجاح!
                  </span>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  حفظ وتأكيد الوثائق
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddServiceModal
        isOpen={isAddServiceOpen}
        onClose={() => setIsAddServiceOpen(false)}
      />

      <VendorWalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />
    </div>
  );
}
