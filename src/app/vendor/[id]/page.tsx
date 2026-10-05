'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, ensureVendorDetails, ensureServiceDetails } from '@/lib/utils';
import { 
  Star, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  ArrowRight, 
  Share2, 
  SlidersHorizontal,
  ChevronLeft,
  Award,
  Layers,
  HelpCircle,
  ExternalLink,
  ArrowLeftRight,
  Heart,
  ShoppingBag,
  TrendingUp,
  Check,
  Zap,
} from 'lucide-react';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import confetti from 'canvas-confetti';

export default function VendorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const {
    vendors,
    services,
    reviews,
    createBooking,
    comparisonVendorIds,
    addToComparison,
    removeFromComparison,
    favoriteVendorIds,
    toggleFavoriteVendor,
    addToCart,
    setIsAIOpen,
    activeOccasion,
  } = useApp();

  const vendorId = params?.id as string;
  const rawVendor = vendors.find((v) => v.id === vendorId) || vendors[0];
  const vendor = rawVendor ? ensureVendorDetails(rawVendor) : null;

  const vendorServices = services.filter((s) => s.vendorId === vendor?.id);
  const vendorReviews = reviews.filter((r) => r.vendorId === vendor?.id);
  const relatedVendors = vendors
    .filter((v) => v.id !== vendor?.id && v.categoryId === vendor?.categoryId)
    .slice(0, 3);

  // Active tab
  const [activeTab, setActiveTab] = useState<'services' | 'portfolio' | 'reviews' | 'about'>('services');
  const [selectedServiceToBook, setSelectedServiceToBook] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold font-cairo">لم يتم العثور على المورد المطلوب</h2>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-saudi-green-800 text-white text-sm font-semibold"
          >
            العودة إلى سوق الموردين
          </Link>
        </div>
      </div>
    );
  }

  const isFavorite = favoriteVendorIds.includes(vendor.id);
  const isCompared = comparisonVendorIds.includes(vendor.id);

  const totalReviewsCount = vendorReviews.length || 1;
  const avgQuality = (vendorReviews.reduce((acc, r) => acc + (r.qualityRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgPunctuality = (vendorReviews.reduce((acc, r) => acc + (r.punctualityRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgCommunication = (vendorReviews.reduce((acc, r) => acc + (r.communicationRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgValue = (vendorReviews.reduce((acc, r) => acc + (r.valueRating || 5), 0) / totalReviewsCount).toFixed(1);

  const handleBookService = (service: any) => {
    setSelectedServiceToBook(service);
    setIsPaymentModalOpen(true);
  };

  const handleQuickAddToCart = (service: any) => {
    const srvDetails = ensureServiceDetails(service);
    const pkg = srvDetails.packages[0] || {
      id: 'basic',
      nameAr: 'الباقة الأساسية',
      price: service.price,
      featuresAr: service.featuresAr,
      durationHours: 4,
    };

    addToCart(service, pkg, [], {
      date: '2026-10-09',
      time: '18:00',
      locationCity: vendor.cityNameAr,
      notes: 'أضيف من صفحة المورد المعتمد',
    });

    setToastMessage(`تمت إضافة "${service.titleAr}" إلى سلتك! 🛍️`);
    setTimeout(() => setToastMessage(null), 3500);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-saudi-sand-50/60 pb-16 animate-fadeIn">
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

      {/* Top Banner & Cover Image */}
      <div className="relative h-64 sm:h-80 w-full bg-saudi-green-950 overflow-hidden">
        <img
          src={vendor.bannerImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&auto=format&fit=crop&q=80'}
          alt={vendor.businessName}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        {/* Navigation & Action buttons on Banner */}
        <div className="absolute top-6 right-6 left-6 z-10 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavoriteVendor(vendor.id)}
              className={`p-2.5 rounded-full backdrop-blur-md transition ${
                isFavorite
                  ? 'bg-rose-600 text-white shadow-lg'
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
              title="إضافة إلى المفضلة"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => {
                if (isCompared) {
                  removeFromComparison(vendor.id);
                } else {
                  addToComparison(vendor.id);
                  router.push('/compare');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold backdrop-blur-md transition ${
                isCompared
                  ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-md'
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{isCompared ? 'تمت إضافته للمقارنة ✓' : 'مقارنة المورد'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20 space-y-6">
        {/* Vendor Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              <img
                src={vendor.logo}
                alt={vendor.businessName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-md shrink-0 bg-neutral-100"
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                    {vendor.businessName}
                  </h1>
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-saudi-green-100 text-saudi-green-800 border border-saudi-green-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      موثق رسمياً
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  {vendor.categoryNameAr} | {vendor.cityNameAr} - حي {vendor.neighborhood}
                </p>

                {/* Rating & Response Metrics */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-1 text-saudi-gold-700 font-bold">
                    <Star className="w-4 h-4 fill-saudi-gold-500 text-saudi-gold-500" />
                    <span>{vendor.rating}</span>
                    <span className="text-gray-400 font-normal">
                      ({vendor.reviewsCount || vendorReviews.length} تقييم موثق)
                    </span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-saudi-green-700" />
                    <span>يرد خلال {vendor.responseTimeMinutes || 15} دقيقة</span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Award className="w-3.5 h-3.5 text-saudi-gold-600" />
                    <span>أنجز {vendor.completedBookingsCount || 45}+ مناسبة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
              <Link
                href={`/rfq?vendorId=${vendor.id}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs sm:text-sm font-bold shadow-lg shadow-saudi-green-900/20 transition-all text-center"
              >
                <Sparkles className="w-4 h-4 text-saudi-gold-300" />
                <span>طلب عرض سعر مخصص (RFQ)</span>
              </Link>

              <button
                onClick={() => setIsAIOpen(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-saudi-gold-50 hover:bg-saudi-gold-100 text-saudi-green-950 text-xs font-bold border border-saudi-gold-300 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-saudi-gold-600" />
                <span>اسأل لُـمى عن هذا المورد</span>
              </button>
            </div>
          </div>

          {/* Badges / Verification Row */}
          <div className="pt-4 border-t border-saudi-sand-200 flex flex-wrap items-center gap-3">
            {vendor.crNumber && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-saudi-sand-100 text-gray-700 text-xs font-mono">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                سجل تجاري: {vendor.crNumber}
              </span>
            )}
            {vendor.freelanceLicense && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-saudi-sand-100 text-gray-700 text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-saudi-green-700" />
                وثيقة عمل حر معتمدة
              </span>
            )}
            {vendor.badges?.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-saudi-gold-100 text-saudi-gold-900 text-xs font-bold border border-saudi-gold-300"
              >
                ✨ {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Vendor Extended Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 block">نسبة الالتزام بالموعد</span>
            <span className="text-xl font-black font-cairo text-saudi-green-950 block mt-1">
              {vendor.metrics.onTimeRate}% ⏱️
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">دقة عالية بالمواعيد</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 block">معدل رضا العملاء</span>
            <span className="text-xl font-black font-cairo text-saudi-gold-700 block mt-1">
              {vendor.metrics.satisfactionRate}% ⭐
            </span>
            <span className="text-[10px] text-saudi-gold-800 font-bold">مراجعات ممتازة</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 block">العملاء المتكررون</span>
            <span className="text-xl font-black font-cairo text-saudi-green-950 block mt-1">
              {vendor.metrics.repeatCustomerRate}% 🔄
            </span>
            <span className="text-[10px] text-gray-400">ولاء وثقة عالية</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 block">سرعة الرد</span>
            <span className="text-xl font-black font-cairo text-saudi-green-950 block mt-1">
              {vendor.metrics.responseTimeMinutes} دقيقة ⚡
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">تجاوب فوري</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-saudi-sand-300 text-sm font-bold overflow-x-auto pb-1">
          {[
            { id: 'services', label: `الخدمات والأسعار (${vendorServices.length})` },
            { id: 'portfolio', label: `معرض الأعمال (${vendor.portfolio?.length || 4})` },
            { id: 'reviews', label: `التقييمات الموثقة (${vendorReviews.length || vendor.reviewsCount})` },
            { id: 'about', label: 'عن المزود والسياسات' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-5 border-b-2 font-bold shrink-0 transition-all ${
                activeTab === tab.id
                  ? 'border-saudi-green-800 text-saudi-green-900'
                  : 'border-transparent text-gray-500 hover:text-saudi-green-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Services List with Direct Add to Cart */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendorServices.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-saudi-sand-300">
                  <p className="text-gray-500">لا توجد خدمات منفصلة مسجلة حالياً لهذا المورد.</p>
                </div>
              ) : (
                vendorServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white rounded-3xl overflow-hidden border border-saudi-sand-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                        <img
                          src={service.images[0]}
                          alt={service.titleAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {service.badge && (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-saudi-green-800 text-white shadow-sm">
                            {service.badge}
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-3">
                        <Link
                          href={`/service/${service.id}`}
                          className="font-bold text-base text-saudi-green-950 hover:text-saudi-gold-700 transition block"
                        >
                          {service.titleAr}
                        </Link>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {service.descriptionAr}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {service.featuresAr?.slice(0, 3).map((feat, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-saudi-sand-100 text-gray-700"
                            >
                              ✓ {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-saudi-sand-200 mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 block">السعر يبدأ من</span>
                        <span className="font-cairo text-base font-black text-saudi-green-900">
                          {formatSaudiRiyal(service.price)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickAddToCart(service)}
                          className="p-2 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold shadow-sm transition"
                          title="أضف للسلة مباشرة"
                        >
                          <ShoppingBag className="w-4 h-4 text-saudi-gold-300" />
                        </button>

                        <Link
                          href={`/service/${service.id}`}
                          className="py-2 px-3 rounded-xl bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 text-xs font-bold transition"
                        >
                          تفاصيل
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Portfolio Gallery */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(vendor.portfolio && vendor.portfolio.length > 0
                ? vendor.portfolio
                : [
                    'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
                  ]
              ).map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="group relative h-64 rounded-3xl overflow-hidden bg-neutral-900 border border-saudi-sand-300 shadow-sm cursor-pointer"
                >
                  <img
                    src={imgUrl}
                    alt={`عمل سابق ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-5">
                    <p className="text-white text-xs font-semibold">
                      لقطة من تنفيذ حفل سابق في {vendor.cityNameAr}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Reviews Breakdown */}
        {activeTab === 'reviews' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-saudi-sand-300 space-y-5">
              <h3 className="font-bold text-sm text-gray-900 font-cairo">
                ملخص التقييمات المعتمدة
              </h3>

              <div className="text-center py-4 bg-saudi-gold-50 rounded-2xl border border-saudi-gold-200">
                <span className="text-4xl font-black font-cairo text-saudi-gold-700 block">
                  {vendor.rating}
                </span>
                <div className="flex justify-center my-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-saudi-gold-500 text-saudi-gold-500" />
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  بناءً على {vendorReviews.length || vendor.reviewsCount} تقييم حقيقي
                </span>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">جودة الخدمة والتنفيذ</span>
                    <span className="font-bold">{avgQuality} / 5</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-saudi-green-800 rounded-full" style={{ width: `${(Number(avgQuality) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">الالتزام بالموعد</span>
                    <span className="font-bold">{avgPunctuality} / 5</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-saudi-gold-500 rounded-full" style={{ width: `${(Number(avgPunctuality) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">التواصل والاحترافية</span>
                    <span className="font-bold">{avgCommunication} / 5</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-saudi-green-800 rounded-full" style={{ width: `${(Number(avgCommunication) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">القيمة مقابل السعر</span>
                    <span className="font-bold">{avgValue} / 5</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-saudi-gold-500 rounded-full" style={{ width: `${(Number(avgValue) / 5) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {vendorReviews.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-saudi-sand-300 text-gray-500 text-xs">
                  لا توجد مراجعات مسجلة لهذا المورد بعد.
                </div>
              ) : (
                vendorReviews.map((rev) => (
                  <div key={rev.id} className="bg-white p-5 rounded-3xl border border-saudi-sand-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-saudi-green-100 text-saudi-green-900 flex items-center justify-center font-bold text-xs">
                          {rev.customerName[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-gray-900">{rev.customerName}</h4>
                          <span className="text-[10px] text-gray-400">{rev.occasionTypeAr} • {rev.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-saudi-gold-700">
                        <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                        <span>5 / 5</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed font-tajawal">
                      "{rev.commentAr}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: About Vendor */}
        {activeTab === 'about' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-saudi-sand-300 space-y-5">
            <h3 className="font-bold text-base text-saudi-green-950 font-cairo">
              عن مزود الخدمة ونطاق التغطية
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-tajawal">
              {vendor.bioAr}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-saudi-sand-200 text-xs">
              <div className="space-y-1">
                <span className="text-gray-400 block">نطاق التغطية الجغرافية:</span>
                <span className="font-bold text-gray-900">
                  كافة أحياء {vendor.cityNameAr} وضواحيها
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block">متوسط مدة التجهيز المسبق:</span>
                <span className="font-bold text-gray-900">
                  يتطلب الحجز قبل 3 أيام على الأقل
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Similar / Related Vendors */}
        {relatedVendors.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-saudi-sand-300">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-saudi-green-950 font-cairo">
                موردون مشابهون في نفس التصنيف
              </h3>
              <Link href="/marketplace" className="text-xs font-bold text-saudi-green-800 hover:underline">
                استعراض المزيد ←
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedVendors.map((rel) => (
                <div
                  key={rel.id}
                  className="bg-white p-4 rounded-2xl border border-saudi-sand-300 hover:border-saudi-gold-400 shadow-sm transition space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={rel.logo}
                      alt={rel.businessName}
                      className="w-11 h-11 rounded-xl object-cover border"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-gray-900 font-cairo">{rel.businessName}</h4>
                      <div className="flex items-center gap-1 text-[11px] text-saudi-gold-600 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{rel.rating}</span>
                        <span className="text-gray-400 font-normal">({rel.reviewsCount})</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/vendor/${rel.id}`}
                    className="block w-full py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 font-bold text-center rounded-xl text-xs transition"
                  >
                    عرض الملف
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal if booking directly */}
      {isPaymentModalOpen && selectedServiceToBook && (
        <SaudiPaymentModal
          bookingTitle={selectedServiceToBook.titleAr}
          vendorName={vendor.businessName}
          date="2026-10-09"
          totalAmount={selectedServiceToBook.price}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentSuccess={(method, isDeposit) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || selectedServiceToBook.titleAr,
              vendorId: vendor.id,
              vendorName: vendor.businessName,
              vendorLogo: vendor.logo,
              serviceId: selectedServiceToBook.id,
              serviceTitleAr: selectedServiceToBook.titleAr,
              date: '2026-10-09',
              cityAr: vendor.cityNameAr,
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: selectedServiceToBook.price,
              depositAmount: Math.round(selectedServiceToBook.price * 0.3),
              remainingAmount: selectedServiceToBook.price - Math.round(selectedServiceToBook.price * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل موعد المناسبة.',
              deliverablesAr: selectedServiceToBook.featuresAr,
            });
            setIsPaymentModalOpen(false);
            router.push('/bookings');
          }}
        />
      )}
    </div>
  );
}
