'use client';
import { notify } from '@/lib/notify';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Sparkles,
  Zap,
  Building,
  FileCheck,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, calculateCartTotals } from '@/lib/utils';
import confetti from 'canvas-confetti';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, appliedCoupon, checkoutCart, cities, activeOccasion, currentUser, removeCoupon } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [eventDate, setEventDate] = useState(activeOccasion?.date || cart[0]?.scheduledDate || '');
  const [eventTime, setEventTime] = useState(cart[0]?.scheduledTime || '18:00');
  const [eventCity, setEventCity] = useState('الرياض');
  const [eventVenue, setEventVenue] = useState(activeOccasion?.venueName || cart[0]?.venueAddress || '');

  // Payment Options
  const [paymentOption, setPaymentOption] = useState<'deposit' | 'full'>('deposit');
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'apple_pay' | 'stc_pay' | 'tamara'>('mada');

  const totals = calculateCartTotals(cart, appliedCoupon);

  // If cart is empty and not on success step, redirect to cart
  if (cart.length === 0 && !createdOrderNumber) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
        <h1 className="text-xl font-bold font-cairo text-gray-900">سلتك فارغة</h1>
        <p className="text-xs text-gray-500">لا توجد خدمات في السلة للمتابعة إلى صفحة الدفع.</p>
        <Link
          href="/marketplace"
          className="inline-block px-5 py-2.5 bg-saudi-green-800 text-white font-bold rounded-xl text-xs"
        >
          العودة لسوق الخدمات
        </Link>
      </div>
    );
  }

  const handleConfirmOrder = async () => {
    if (isSubmitting) return; // concurrency / idempotency protection
    setIsSubmitting(true);

    try {
      const isDepositOnly = paymentOption === 'deposit';
      const order = await checkoutCart({
        customerName,
        customerPhone,
        customerEmail,
        occasionId: activeOccasion?.id,
        isDepositOnly,
        paymentMethod,
        scheduleDate: eventDate,
        scheduleTime: eventTime,
        locationCity: eventCity,
        locationAddress: eventVenue,
      });

      setCreatedOrderNumber(order.orderNumber);
      setIsSubmitting(false);
      setStep(3);

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {}
    } catch (error) { setIsSubmitting(false); notify(error instanceof Error ? error.message : 'تعذر تأكيد الطلب'); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
        هذه السلة السابقة قيد الإيقاف التدريجي. أكمل طلبك الحالي هنا، وستتم الحجوزات الجديدة عبر <a className="underline" href="/commerce">متجر الخدمات والباقات</a>.
      </p>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
        <Link href="/cart" className="hover:text-saudi-green-800 transition flex items-center gap-1">
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للسلة</span>
        </Link>
        <span>/</span>
        <span className="text-saudi-green-900">إرسال طلب الحجز</span>
      </div>

      {/* Checkout Steps Progress Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-saudi-sand-300 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-saudi-sand-200 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 right-0 h-1 bg-saudi-green-800 -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
          />

          {/* Step 1 Node */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                step >= 1
                  ? 'bg-saudi-green-800 text-white shadow-md'
                  : 'bg-saudi-sand-200 text-gray-600'
              }`}
            >
              1
            </div>
            <span className="text-xs font-bold text-gray-800">بيانات المناسبة</span>
          </div>

          {/* Step 2 Node */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                step >= 2
                  ? 'bg-saudi-green-800 text-white shadow-md'
                  : 'bg-saudi-sand-200 text-gray-600'
              }`}
            >
              2
            </div>
            <span className="text-xs font-bold text-gray-800">مراجعة الطلب</span>
          </div>

          {/* Step 3 Node */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                step === 3
                  ? 'bg-saudi-gold-500 text-saudi-green-950 font-bold shadow-md'
                  : 'bg-saudi-sand-200 text-gray-600'
              }`}
            >
              3
            </div>
            <span className="text-xs font-bold text-gray-800">تسجيل الطلب</span>
          </div>
        </div>
      </div>

      {appliedCoupon && step !== 3 && <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">الخصومات غير مفعلة لهذا المسار حالياً. <button className="underline font-bold" onClick={removeCoupon}>إزالة الكوبون والمتابعة بالسعر الكامل</button></div>}
      {/* Main Steps Content */}
      {step === 1 && (
        /* STEP 1: CONTACT & SCHEDULE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6">
            <h2 className="text-xl font-bold font-cairo text-saudi-green-950 flex items-center gap-2">
              <User className="w-5 h-5 text-saudi-gold-600" />
              <span>بيانات صاحب المناسبة والتواصل</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">الاسم الكامل *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">رقم الجوال السعودي *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+966501234567"
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500 text-left font-mono"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700">البريد الإلكتروني (لاستلام الفواتير والعقد) *</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500 text-left font-mono"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <h2 className="text-xl font-bold font-cairo text-saudi-green-950 flex items-center gap-2 pt-4 border-t border-saudi-sand-200">
              <Calendar className="w-5 h-5 text-saudi-gold-600" />
              <span>موعد وموقع الحفل</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">تاريخ المناسبة *</label>
                <input
                  type="date"
                  min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date())}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">وقت بدء التنفيذ *</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">المدينة *</label>
                <select
                  value={eventCity}
                  onChange={(e) => setEventCity(e.target.value)}
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 font-bold focus:outline-none focus:border-saudi-gold-500"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.nameAr}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">اسم القاعة أو عنوان الموقع *</label>
                <input
                  type="text"
                  value={eventVenue}
                  onChange={(e) => setEventVenue(e.target.value)}
                  placeholder="مثال: قاعة ليلتي، فيلا خاصة، استراحة..."
                  className="w-full px-4 py-2.5 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!customerName || !customerPhone || !eventDate || !eventTime || !eventVenue}
                className="px-8 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
              >
                <span>المتابعة لاختيار مراجعة الطلب</span>
                <ArrowLeft className="w-4 h-4 text-saudi-gold-300" />
              </button>
            </div>
          </div>

          {/* Quick Cart Summary Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-saudi-green-950 font-cairo border-b pb-2">
              ملخص الخدمات ({cart.length})
            </h3>
            <div className="space-y-2 text-xs">
              {cart.map((i) => (
                <div key={i.id} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-700 truncate max-w-[200px]">{i.serviceTitleAr}</span>
                  <span className="font-bold text-saudi-green-900">{formatSaudiRiyal(i.totalPrice)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between font-bold text-sm">
              <span>المجموع الكلي:</span>
              <span className="text-saudi-green-950 font-black">{formatSaudiRiyal(totals.finalTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        /* STEP 2: PAYMENT & DEPOSIT OPTIONS */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6">
            <h2 className="text-xl font-bold font-cairo text-saudi-green-950 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-saudi-gold-600" />
              <span>مراجعة طلب الحجز</span>
            </h2>

            <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm leading-7">
              يُرسل الطلب للموردين لمراجعة التوفر والتفاصيل. لا يُعد الحجز مؤكداً بمجرد الإرسال.
              الدفع الإلكتروني غير مفعّل حالياً، ولن يتم تحصيل أي مبلغ أو إصدار فاتورة دفع.
            </div>
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1 transition"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>الرجوع للخطوة السابقة</span>
              </button>

              <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="px-8 py-4 bg-gradient-to-r from-saudi-green-800 to-saudi-green-950 hover:from-saudi-green-900 hover:to-black text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-saudi-green-900/20 disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري حفظ طلبك...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-saudi-gold-300" />
                    <span>
                      إرسال طلب الحجز
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-saudi-green-950 font-cairo border-b pb-2">
              التكلفة التقديرية للطلب
            </h3>

            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>إجمالي الحجوزات:</span>
                <span className="font-bold text-gray-900">{formatSaudiRiyal(totals.finalTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>العربون المتوقع بعد التأكيد:</span>
                <span className="font-bold text-saudi-green-900 text-base">
                  {formatSaudiRiyal(
                    paymentOption === 'deposit' ? totals.depositAmount : totals.finalTotal
                  )}
                </span>
              </div>
              {paymentOption === 'deposit' && (
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>المتبقي عند التنفيذ:</span>
                  <span>{formatSaudiRiyal(totals.remainingAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 3 && createdOrderNumber && (
        /* STEP 3: ORDER SUCCESS CONFIRMATION */
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-10 border border-saudi-sand-300 shadow-xl text-center space-y-6 animate-scaleUp">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="bg-saudi-gold-100 text-saudi-gold-900 text-xs font-bold px-3 py-1 rounded-full border border-saudi-gold-300 inline-block">
              طلب محفوظ • بانتظار مراجعة المورد
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              تم استلام طلب مناسبتك!
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto font-tajawal">
              تم حفظ الطلب وإضافته إلى قائمة طلبات الموردين برقم الطلب الموحد:
            </p>
            <div className="inline-block bg-saudi-sand-100 px-4 py-2 rounded-xl text-sm font-bold font-mono text-saudi-green-900 tracking-wider break-all">
              {createdOrderNumber}
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="bg-saudi-sand-50 rounded-2xl p-4 text-xs text-right space-y-2 border border-saudi-sand-200">
            <div className="flex justify-between">
              <span className="text-gray-500">صاحب الحجز:</span>
              <span className="font-bold text-gray-900">{customerName} ({customerPhone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الموعد والموقع:</span>
              <span className="font-bold text-gray-900">{eventDate} • {eventCity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">حالة الدفع:</span>
              <span className="font-bold text-emerald-700">
                غير مدفوع — لم يتم تحصيل أي مبلغ
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/bookings"
              className="w-full sm:w-auto px-6 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <FileCheck className="w-4 h-4 text-saudi-gold-300" />
              <span>متابعة طلباتي وحجوزاتي</span>
            </Link>

            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-5 py-3.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 font-bold rounded-2xl text-xs sm:text-sm transition"
            >
              العودة لسوق الخدمات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
