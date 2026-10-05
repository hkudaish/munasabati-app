'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Star,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  Trash2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Plus,
  X,
  Check,
  Zap,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, ensureVendorDetails, ensureServiceDetails } from '@/lib/utils';
import { rankVendors } from '@/lib/ranking-engine';
import confetti from 'canvas-confetti';

export default function ComparePage() {
  const router = useRouter();
  const {
    vendors,
    services,
    comparisonVendorIds,
    addToComparison,
    removeFromComparison,
    clearComparison,
    addToCart,
    rankingWeights,
    setIsAIOpen,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // If user opened compare without any selected vendors, provide top 2 defaults from vendors list
  const activeVendorIds =
    comparisonVendorIds.length >= 2
      ? comparisonVendorIds
      : comparisonVendorIds.length === 1
      ? [comparisonVendorIds[0], vendors.find((v) => v.id !== comparisonVendorIds[0])?.id || vendors[1]?.id].filter(Boolean)
      : [vendors[0]?.id, vendors[1]?.id].filter(Boolean);

  const comparedVendors = activeVendorIds
    .map((id) => vendors.find((v) => v.id === id))
    .filter(Boolean)
    .map((v) => ensureVendorDetails(v!));

  // Determine superlative highlights across selected vendors
  const minPrice = Math.min(
    ...comparedVendors.map((v) => {
      const s = services.find((srv) => srv.vendorId === v.id);
      return s?.price || 999999;
    })
  );
  const maxRating = Math.max(...comparedVendors.map((v) => v.rating));
  const minResponseTime = Math.min(...comparedVendors.map((v) => v.responseTimeMinutes || 60));
  const maxOrders = Math.max(...comparedVendors.map((v) => v.completedBookingsCount || 0));

  const handleAddToCart = (vendor: any) => {
    const srv = services.find((s) => s.vendorId === vendor.id);
    if (!srv) return;

    const srvDetails = ensureServiceDetails(srv);
    const pkg = srvDetails.packages[0] || {
      id: 'basic',
      nameAr: 'الباقة الأساسية',
      price: srv.price,
      featuresAr: srv.featuresAr,
      durationHours: 4,
    };

    addToCart(srv, pkg, [], {
      date: '2026-10-09',
      time: '18:00',
      locationCity: vendor.cityNameAr,
      notes: 'أضيف عبر المقارنة المباشرة',
    });

    setToastMessage(`تمت إضافة خدمة "${srv.titleAr}" إلى سلتك! 🛍️`);
    setTimeout(() => setToastMessage(null), 3500);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-saudi-green-950 text-white px-6 py-3 rounded-2xl shadow-2xl border border-saudi-gold-400 flex items-center gap-3 animate-slideDown">
          <Check className="w-5 h-5 text-saudi-gold-400" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
          <Link
            href="/cart"
            className="mr-2 px-3 py-1 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-black rounded-lg text-xs transition"
          >
            عرض السلة
          </Link>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-saudi-sand-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1">
            <Link href="/marketplace" className="hover:text-saudi-green-800 transition">
              سوق الخدمات
            </Link>
            <span>/</span>
            <span className="text-saudi-green-900">مقارنة الموردين والخدمات</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950 flex items-center gap-2.5">
            <ArrowLeftRight className="w-7 h-7 text-saudi-gold-600" />
            <span>مقارنة الموردين والأسعار ({comparedVendors.length} من 4)</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {comparedVendors.length > 0 && (
            <button
              onClick={clearComparison}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-red-600 bg-white border border-saudi-sand-300 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح المقارنة</span>
            </button>
          )}

          <button
            onClick={() => setIsAIOpen(true)}
            className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>اسأل لُـمى ترشح لك الأفضل</span>
          </button>
        </div>
      </div>

      {/* Add more vendors quick picker if less than 4 */}
      {comparedVendors.length < 4 && (
        <div className="bg-saudi-sand-100/70 p-3.5 rounded-2xl border border-saudi-sand-300 flex items-center justify-between gap-3 flex-wrap text-xs">
          <span className="font-bold text-gray-700 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-saudi-green-800" />
            <span>أضف مورداً آخر إلى جدول المقارنة (حتى 4 موردين):</span>
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            {vendors
              .filter((v) => !activeVendorIds.includes(v.id))
              .slice(0, 4)
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => addToComparison(v.id)}
                  className="px-3 py-1 bg-white hover:bg-saudi-green-50 text-gray-800 hover:text-saudi-green-900 border border-saudi-sand-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <span>+ {v.businessName}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Comparison Matrix Table */}
      <div className="bg-white rounded-3xl border border-saudi-sand-300 shadow-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-right border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-saudi-green-950 text-white">
              <th className="p-5 font-bold text-xs w-48 border-b border-saudi-gold-500/20">
                وجه المقارنة
              </th>
              {comparedVendors.map((vendor) => (
                <th
                  key={vendor.id}
                  className="p-5 font-bold text-xs border-b border-saudi-gold-500/20 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => removeFromComparison(vendor.id)}
                      className="self-end text-gray-400 hover:text-red-400 transition"
                      title="إزالة من المقارنة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <img
                      src={vendor.logo}
                      alt={vendor.businessName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-saudi-gold-400 shadow-md bg-white"
                    />
                    <div>
                      <h4 className="font-bold text-sm sm:text-base font-cairo text-white">
                        {vendor.businessName}
                      </h4>
                      <p className="text-[11px] text-gray-300 font-normal">
                        {vendor.categoryNameAr} • {vendor.cityNameAr}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-saudi-sand-200 text-xs">
            {/* Row 1: Badges & Superlatives */}
            <tr className="bg-saudi-sand-50/50">
              <td className="p-4 font-bold text-gray-700">التميز التنافسي</td>
              {comparedVendors.map((vendor) => {
                const srv = services.find((s) => s.vendorId === vendor.id);
                const isLowestPrice = (srv?.price || 0) <= minPrice;
                const isHighestRating = vendor.rating >= maxRating;
                const isFastest = (vendor.responseTimeMinutes || 60) <= minResponseTime;

                return (
                  <td key={vendor.id} className="p-4 text-center">
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {isLowestPrice && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                          الأقل سعراً 💰
                        </span>
                      )}
                      {isHighestRating && (
                        <span className="bg-saudi-gold-100 text-saudi-gold-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400">
                          الأعلى تقييماً ⭐
                        </span>
                      )}
                      {isFastest && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300">
                          الأسرع تجاوباً ⚡
                        </span>
                      )}
                      {vendor.verified && (
                        <span className="bg-saudi-green-100 text-saudi-green-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          موثق رسمياً ✓
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Row 2: Starting Price */}
            <tr>
              <td className="p-4 font-bold text-gray-700">السعر الأساسي</td>
              {comparedVendors.map((vendor) => {
                const srv = services.find((s) => s.vendorId === vendor.id);
                return (
                  <td key={vendor.id} className="p-4 text-center">
                    <span className="text-base font-black font-cairo text-saudi-green-950 block">
                      {formatSaudiRiyal(srv?.price || 0)}
                    </span>
                    <span className="text-[10px] text-gray-400">{srv?.titleAr || 'خدمة مخصصة'}</span>
                  </td>
                );
              })}
            </tr>

            {/* Row 3: Rating & Reviews */}
            <tr className="bg-saudi-sand-50/50">
              <td className="p-4 font-bold text-gray-700">التقييم العام الموثق</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-saudi-gold-700 text-sm">
                    <Star className="w-4 h-4 fill-saudi-gold-500 text-saudi-gold-500" />
                    <span>{vendor.rating} / 5</span>
                  </div>
                  <span className="text-[11px] text-gray-500 block mt-0.5">
                    ({vendor.reviewsCount} مراجعة موثقة)
                  </span>
                </td>
              ))}
            </tr>

            {/* Row 4: Response Time */}
            <tr>
              <td className="p-4 font-bold text-gray-700">متوسط سرعة الرد</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center font-bold text-gray-800">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-saudi-green-700" />
                    <span>خلال {vendor.responseTimeMinutes} دقائق</span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 5: Completed Orders */}
            <tr className="bg-saudi-sand-50/50">
              <td className="p-4 font-bold text-gray-700">المناسبات المكتملة</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center font-bold text-saudi-green-900">
                  <div className="flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5 text-saudi-gold-600" />
                    <span>{vendor.completedBookingsCount}+ مناسبة ناجحة</span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 6: On-time completion rate */}
            <tr>
              <td className="p-4 font-bold text-gray-700">نسبة الالتزام بالموعد</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center font-bold text-emerald-700">
                  {vendor.metrics.onTimeRate}%
                </td>
              ))}
            </tr>

            {/* Row 7: Repeat Customer Rate */}
            <tr className="bg-saudi-sand-50/50">
              <td className="p-4 font-bold text-gray-700">نسبة تكرار العملاء</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center font-bold text-gray-800">
                  {vendor.metrics.repeatCustomerRate}%
                </td>
              ))}
            </tr>

            {/* Row 8: Action Buttons */}
            <tr>
              <td className="p-4 font-bold text-gray-700">الإجراء المباشر</td>
              {comparedVendors.map((vendor) => (
                <td key={vendor.id} className="p-4 text-center">
                  <div className="space-y-2 max-w-[180px] mx-auto">
                    <button
                      onClick={() => handleAddToCart(vendor)}
                      className="w-full py-2.5 px-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-saudi-gold-300" />
                      <span>أضف للسلة</span>
                    </button>

                    <Link
                      href={`/vendor/${vendor.id}`}
                      className="block w-full py-2 px-3 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 font-bold rounded-xl text-xs transition"
                    >
                      عرض الملف الكامل
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
