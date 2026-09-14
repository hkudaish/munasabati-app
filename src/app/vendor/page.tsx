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
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { Booking, RFQRequest } from '@/lib/types';

export default function VendorPortalPage() {
  const { vendors, bookings, rfqRequests, updateBookingStatus } = useApp();

  const currentVendor = vendors[0]; // Active demo vendor (ضيافة نجد الأصيلة)

  const [activeTab, setActiveTab] = useState<'bookings' | 'rfqs' | 'services' | 'verification'>('bookings');

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
            <div className="flex items-center gap-2">
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

        {/* Performance metrics */}
        <div className="flex items-center gap-4 self-start md:self-auto text-xs">
          <div className="bg-saudi-sand-50 p-3 rounded-2xl border border-saudi-sand-300 text-center">
            <span className="text-[10px] text-gray-400 block">التقييم العام</span>
            <span className="text-base font-bold text-saudi-gold-700 flex items-center justify-center gap-1 font-cairo">
              <Star className="w-4 h-4 fill-saudi-gold-500 text-saudi-gold-500" />
              {currentVendor.rating} ({currentVendor.reviewsCount})
            </span>
          </div>

          <div className="bg-saudi-sand-50 p-3 rounded-2xl border border-saudi-sand-300 text-center">
            <span className="text-[10px] text-gray-400 block">معدل الاستجابة</span>
            <span className="text-base font-bold text-saudi-green-900 font-cairo">
              {currentVendor.responseTimeMinutes} دقائق ⚡
            </span>
          </div>
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
            <span>حالة توثيق المتجر</span>
            <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
          </div>
          <span className="text-lg font-bold text-saudi-green-800 block mt-2">
            معتمد ونشط 100%
          </span>
          <span className="text-[11px] text-gray-400 block mt-1">مؤهل للحجز الفوري</span>
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
    </div>
  );
}
