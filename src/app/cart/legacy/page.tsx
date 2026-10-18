'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Trash2,
  Bookmark,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Sparkles,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, calculateCartTotals, ensureServiceDetails } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    savedForLater,
    appliedCoupon,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    saveItemForLater,
    moveToCartFromSaved,
    applyCouponCode,
    removeCoupon,
    setIsAIOpen,
    services,
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // Group cart items by vendor
  const vendorGroups = cart.reduce((acc, item) => {
    if (!acc[item.vendorId]) {
      acc[item.vendorId] = {
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        vendorLogo: item.vendorLogo,
        items: [],
      };
    }
    acc[item.vendorId].items.push(item);
    return acc;
  }, {} as Record<string, { vendorId: string; vendorName: string; vendorLogo?: string; items: typeof cart }>);

  const groupsArray = Object.values(vendorGroups);
  const totals = calculateCartTotals(cart, appliedCoupon);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    if (!couponInput.trim()) return;

    const res = applyCouponCode(couponInput.trim());
    if (res.success) {
      setCouponSuccess(res.messageAr);
      setCouponInput('');
    } else {
      setCouponError(res.messageAr);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-saudi-sand-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1">
            <Link href="/" className="hover:text-saudi-green-800 transition">
              الرئيسية
            </Link>
            <span>/</span>
            <Link href="/marketplace" className="hover:text-saudi-green-800 transition">
              سوق الخدمات
            </Link>
            <span>/</span>
            <span className="text-saudi-green-900">سلة التسوق الموحدة</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950 flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-saudi-gold-600" />
            <span>سلة حجوزات المناسبة ({cart.reduce((sum, i) => sum + i.quantity, 0)})</span>
          </h1>
        </div>

        {cart.length > 0 && (
          <button
            onClick={() => {
              if (confirm('هل أنت متأكد من رغبتك في إفراغ السلة بالكامل؟')) {
                clearCart();
              }
            }}
            className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 self-start sm:self-center transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>إفراغ السلة</span>
          </button>
        )}
      </div>

      {/* Main Cart Body */}
      {cart.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white rounded-3xl p-12 border border-saudi-sand-300 shadow-sm text-center max-w-xl mx-auto space-y-5">
          <div className="w-20 h-20 rounded-full bg-saudi-sand-100 text-saudi-green-800 flex items-center justify-center mx-auto shadow-inner">
            <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold font-cairo text-saudi-green-950">
              سلتك فارغة حالياً
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-tajawal">
              استكشف خدمات الكوشة، الضيافة السعودية، المصورين المعتمدين، أو اطلب من مساعدتنا الذكية
              "لُـمى" ترشيح باقات تلائم ميزانيتك ومناسبتك فوراً.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-6 py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl transition shadow"
            >
              استعراض سوق الخدمات
            </Link>
            <button
              onClick={() => setIsAIOpen(true)}
              className="w-full sm:w-auto px-5 py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow"
            >
              <Sparkles className="w-4 h-4" />
              <span>اطلب ترشيح من لُـمى</span>
            </button>
          </div>
        </div>
      ) : (
        /* Cart With Items Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Vendor Grouped Items */}
          <div className="lg:col-span-8 space-y-6">
            {groupsArray.map((group) => (
              <div
                key={group.vendorId}
                className="bg-white rounded-3xl border border-saudi-sand-300 shadow-sm overflow-hidden"
              >
                {/* Vendor Header */}
                <div className="bg-saudi-sand-100/70 p-4 border-b border-saudi-sand-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {group.vendorLogo && (
                      <img
                        src={group.vendorLogo}
                        alt={group.vendorName}
                        className="w-9 h-9 rounded-xl object-cover border border-white shadow-sm"
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-saudi-green-950 font-cairo flex items-center gap-1.5">
                        {group.vendorName}
                        <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                      </h4>
                      <span className="text-[11px] text-gray-500">
                        {group.items.length} {group.items.length === 1 ? 'خدمة مختارة' : 'خدمات'} من هذا المورد
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/vendor/${group.vendorId}`}
                    className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 transition"
                  >
                    زيارة صفحة المورد ←
                  </Link>
                </div>

                {/* Items in this Vendor Group */}
                <div className="divide-y divide-saudi-sand-200">
                  {group.items.map((item) => (
                    <div key={item.id} className="p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <Link
                            href={`/service/${item.serviceId}`}
                            className="font-bold text-sm sm:text-base text-gray-900 hover:text-saudi-green-800 transition line-clamp-1"
                          >
                            {item.serviceTitleAr}
                          </Link>

                          {/* Selected Package Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-saudi-green-100 text-saudi-green-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-saudi-green-200">
                              الباقة: {item.selectedPackage.nameAr}
                            </span>
                            <span className="text-xs text-gray-500 font-bold">
                              {formatSaudiRiyal(item.selectedPackage.price)}
                            </span>
                          </div>

                          {/* Booking Schedule Details */}
                          {(item.scheduleDate || item.scheduleTime || item.locationCity) && (
                            <div className="flex items-center gap-3 text-xs text-gray-600 pt-1 flex-wrap">
                              {item.scheduleDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-saudi-gold-600" />
                                  <span>{item.scheduleDate}</span>
                                </span>
                              )}
                              {item.scheduleTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-saudi-gold-600" />
                                  <span>{item.scheduleTime}</span>
                                </span>
                              )}
                              {item.locationCity && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-saudi-green-700" />
                                  <span>{item.locationCity}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Selected Add-ons list if any */}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <div className="bg-saudi-sand-50 p-2.5 rounded-xl text-xs space-y-1 mt-2">
                              <span className="font-bold text-gray-700 block text-[11px]">
                                الإضافات الملحقة (+):
                              </span>
                              {item.selectedAddons.map((addon) => {
                                const addonKey = (addon as any).id || (addon as any).addonId;
                                const addonName = (addon as any).titleAr || (addon as any).nameAr || 'إضافة';
                                return (
                                  <div key={addonKey} className="flex justify-between text-gray-600">
                                    <span>• {addonName}</span>
                                    <span className="font-bold">{formatSaudiRiyal(addon.price)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Price & Quantity Controls */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                          <div className="text-left">
                            <span className="text-base font-black font-cairo text-saudi-green-950 block">
                              {formatSaudiRiyal(item.totalPrice)}
                            </span>
                            <span className="text-[10px] text-gray-400">شامل الضريبة 15%</span>
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1.5 bg-saudi-sand-100 p-1 rounded-xl border border-saudi-sand-300">
                            <button
                              onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 transition"
                              title="تقليل العدد"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 transition"
                              title="زيادة العدد"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons (Delete, Save for later) */}
                      <div className="flex items-center gap-3 pt-2 text-xs border-t border-gray-100">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => saveItemForLater(item.id)}
                          className="text-gray-600 hover:text-saudi-green-800 font-bold flex items-center gap-1 transition"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>حفظ لوقت لاحق</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Saved for Later Section */}
            {savedForLater.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
                <h3 className="font-bold text-base text-gray-900 font-cairo flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-saudi-gold-600" />
                  <span>العناصر المحفوظة لوقت لاحق ({savedForLater.length})</span>
                </h3>

                <div className="divide-y divide-saudi-sand-200">
                  {savedForLater.map((saved) => (
                    <div key={saved.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <h5 className="font-bold text-xs sm:text-sm text-gray-900">
                          {saved.serviceTitleAr}
                        </h5>
                        <p className="text-[11px] text-gray-500">
                          {saved.vendorName} • باقة {saved.selectedPackage.nameAr}
                        </p>
                        <span className="text-xs font-black text-saudi-green-900 block mt-0.5">
                          {formatSaudiRiyal(saved.totalPrice)}
                        </span>
                      </div>

                      <button
                        onClick={() => moveToCartFromSaved(saved.id)}
                        className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>نقل إلى السلة</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary & Checkout Trigger */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            {/* Coupon Box */}
            <div className="bg-white rounded-3xl p-5 border border-saudi-sand-300 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-saudi-gold-600" />
                <span>كوبون الخصم أو رمز الشريك</span>
              </h4>

              {appliedCoupon ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-800 block">{appliedCoupon.code}</span>
                    <span className="text-[10px] text-emerald-600">{appliedCoupon.descriptionAr}</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                  >
                    إزالة
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="MUNASABATI10"
                      className="flex-1 px-3 py-2 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs uppercase font-mono text-gray-900 focus:outline-none focus:border-saudi-gold-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl transition"
                    >
                      تطبيق
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{couponError}</span>
                    </p>
                  )}
                  {couponSuccess && (
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{couponSuccess}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    جرب كود الترحيب: <span className="font-bold text-gray-600">MUNASABATI10</span> (خصم 10%)
                  </p>
                </form>
              )}
            </div>

            {/* Financial Summary Box */}
            <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-gray-900 font-cairo border-b border-saudi-sand-200 pb-3">
                ملخص الفاتورة والحجز
              </h3>

              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>مجموع الباقات والخدمات:</span>
                  <span className="font-bold text-gray-900">{formatSaudiRiyal(totals.subtotal)}</span>
                </div>

                {totals.addonsTotal > 0 && (
                  <div className="flex justify-between">
                    <span>مجموع الإضافات الخاصة:</span>
                    <span className="font-bold text-gray-900">{formatSaudiRiyal(totals.addonsTotal)}</span>
                  </div>
                )}

                {totals.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>خصم الكوبون ({appliedCoupon?.code}):</span>
                    <span>-{formatSaudiRiyal(totals.discountTotal)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>ضريبة القيمة المضافة ZATCA (15% مشمولة):</span>
                  <span>{formatSaudiRiyal(totals.taxAmount)}</span>
                </div>

                <div className="pt-2 border-t border-saudi-sand-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gray-900">المجموع الكلي:</span>
                  <span className="text-2xl font-black font-cairo text-saudi-green-950">
                    {formatSaudiRiyal(totals.finalTotal)}
                  </span>
                </div>

                {/* Deposit Plan Breakdown */}
                <div className="bg-saudi-sand-50 p-3 rounded-2xl border border-saudi-sand-200 space-y-1.5 mt-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-saudi-green-900">عربون التأكيد اليوم (30%):</span>
                    <span className="font-black text-saudi-green-950">{formatSaudiRiyal(totals.depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>المتبقي عند التنفيذ الميداني:</span>
                    <span>{formatSaudiRiyal(totals.remainingAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                onClick={() => router.push('/checkout')}
                className="w-full py-4 bg-gradient-to-r from-saudi-green-800 to-saudi-green-950 hover:from-saudi-green-900 hover:to-black text-white font-bold rounded-2xl text-sm shadow-xl shadow-saudi-green-900/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition"
              >
                <Zap className="w-4 h-4 text-saudi-gold-400" />
                <span>متابعة إتمام الحجز والدفع</span>
                <ArrowLeft className="w-4 h-4 text-saudi-gold-300" />
              </button>

              <div className="text-center space-y-1 pt-1">
                <span className="text-[10px] text-gray-400 block">
                  🔒 دفع إلكتروني آمن معتمد من البنك المركزي السعودي (SAMA)
                </span>
                <span className="text-[10px] text-saudi-green-800 font-bold block">
                  🛡️ عقد إلكتروني موحد يضمن حقوق الطرفين وسياسة إلغاء مرنة
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
