'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  PlusCircle,
  Calendar,
  Layers,
  ShoppingBag,
  Star,
  MapPin,
  ShieldCheck,
  Zap,
  ArrowRight,
  HeartHandshake,
  CheckCircle2,
  ChevronLeft,
  Search,
  Users,
  DollarSign,
  Coffee,
  Building2,
  Camera,
  Music,
  Gift,
  Palette,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import ServiceCard from '@/components/marketplace/ServiceCard';
import PackageCard from '@/components/marketplace/PackageCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import { ServiceItem, SmartPackage } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const {
    adminConfig,
    occasionTypes,
    serviceCategories,
    packages,
    services,
    inspirationPosts,
    setIsAIOpen,
    selectedCity,
    cities,
    createBooking,
    activeOccasion,
  } = useApp();

  const [bookingModalItem, setBookingModalItem] = useState<{
    title: string;
    vendorName: string;
    totalAmount: number;
    serviceId?: string;
    packageId?: string;
  } | null>(null);

  const activeCityObj = cities.find((c) => c.id === selectedCity) || cities[0];

  const handleBookService = (service: ServiceItem) => {
    setBookingModalItem({
      title: service.titleAr,
      vendorName: service.vendorName,
      totalAmount: service.price,
      serviceId: service.id,
    });
  };

  const handleBookPackage = (pkg: SmartPackage) => {
    setBookingModalItem({
      title: pkg.titleAr,
      vendorName: 'باقة مناسبتي المتكاملة',
      totalAmount: pkg.packagePrice,
      packageId: pkg.id,
    });
  };

  return (
    <div className="space-y-16 pb-16">
      {/* 1. Hero Section */}
      <section className="relative bg-hero-pattern text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/20">
        {/* Decorative background glow */}
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-saudi-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-saudi-green-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-8">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 bg-saudi-gold-500/15 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold animate-fadeIn">
            <Sparkles className="w-4 h-4 text-saudi-gold-400" />
            <span>المنصة السعودية الذكية الأولى لتنظيم والاحتفال بالمناسبات 🇸🇦</span>
          </div>

          {/* Slogan & Title */}
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-5xl font-black font-cairo leading-tight tracking-tight text-white">
              خططها. احجزها. اعزمهم.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-saudi-gold-300 via-saudi-gold-400 to-amber-200">
                واحتفل بأجمل اللحظات.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl font-tajawal">
              من الفكرة وحتى آخر ضيف — كل تجهيزات مناسبتك في مساحة عمل واحدة ذكية: كوش، ضيافة سعودية، مصورين، باقات جاهزة، ودعوات واتساب مع رمز QR.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/plan"
              className="px-6 py-3.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-sm shadow-lg shadow-saudi-gold-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              <PlusCircle className="w-5 h-5 text-saudi-green-950" />
              <span>+ أنشئ مناسبتك الآن (دقيقتين فقط)</span>
            </Link>

            <button
              onClick={() => setIsAIOpen(true)}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm backdrop-blur-md flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4 text-saudi-gold-300" />
              <span>جرّب التخطيط بالذكاء الاصطناعي ({adminConfig.aiAssistantNameAr})</span>
            </button>
          </div>

          {/* Trust stats row */}
          <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
              <span>موردين موثقين بسجلات رسمية</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-saudi-gold-400" />
              <span>حجز فوري وضمان أسعار المنصة</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-saudi-gold-400" />
              <span>تغطية فورية في {cities.length} مدن سعودية</span>
            </div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-saudi-gold-400" />
              <span>فهم دقيق للتقاليد والأعراف السعودية</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Core Section: "ما مناسبتك؟" (Occasion Selection Cards) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
              ابدأ من نوع الاحتفال
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              ما مناسبتك؟ 🎉
            </h2>
          </div>
          <Link
            href="/plan"
            className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
          >
            <span>عرض كافة أنواع المناسبات (26 مناسبة)</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Occasion Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          {occasionTypes.slice(0, 6).map((occ) => (
            <Link
              key={occ.id}
              href={`/plan?type=${occ.id}`}
              className="group bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-card hover:border-saudi-gold-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="relative h-28 w-full bg-gray-100 overflow-hidden">
                <img
                  src={occ.coverImage}
                  alt={occ.nameAr}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-2 right-2 text-white font-bold text-xs font-cairo">
                  {occ.nameAr}
                </span>
              </div>
              <div className="p-2.5 text-[10px] text-gray-500 leading-tight">
                {occ.descriptionAr}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. AI Planner Interactive Teaser Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-saudi-green-900 via-saudi-green-800 to-saudi-green-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-saudi-gold-500/30">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-saudi-gold-500/20 text-saudi-gold-300 px-3 py-1 rounded-full text-xs font-bold border border-saudi-gold-400/30">
              <Sparkles className="w-3.5 h-3.5 text-saudi-gold-400" />
              <span>المساعد الذكي: {adminConfig.aiAssistantNameAr}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black font-cairo text-white">
              لا تشيل هم الترتيب والميزانية!
            </h3>
            <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-tajawal">
              اكتب فقط: <span className="text-saudi-gold-300 font-bold">"أبغى ملكة منزلية بالرياض لـ 50 شخص وميزانيتي 15 ألف"</span>، وسيقوم المساعد الذكي بتوليد خطة متكاملة فوراً تشمل توزيع الميزانية، قائمة المهام، والموردين الموصى بهم.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => setIsAIOpen(true)}
                className="px-6 py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-black rounded-2xl text-xs sm:text-sm shadow-md flex items-center gap-2 transition"
              >
                <Sparkles className="w-4 h-4 text-saudi-green-950" />
                <span>جرّب الآن مجاناً</span>
              </button>
            </div>
          </div>

          <div className="hidden lg:block absolute left-8 top-1/2 -translate-y-1/2 w-72 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-xs space-y-2 text-right">
            <span className="text-saudi-gold-300 font-bold text-[10px] block">💡 نموذج تحليل فوري:</span>
            <p className="text-gray-200">"حفلة تخرج 80 شخص بالرياض"</p>
            <div className="space-y-1 pt-1 border-t border-white/10 text-[11px]">
              <div className="flex justify-between"><span>الكوشة والورد:</span><span className="font-bold text-saudi-gold-300">5,500 ر.س</span></div>
              <div className="flex justify-between"><span>الضيافة والقهوة:</span><span className="font-bold text-saudi-gold-300">4,500 ر.س</span></div>
              <div className="flex justify-between"><span>التصوير والألبوم:</span><span className="font-bold text-saudi-gold-300">2,500 ر.س</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Smart Packages Section ("باقات جاهزة مع توفير مضمون") */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
              وفر وقتك ومالك
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              الباقات الذكية الجاهزة 📦
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              باقات منسقة تجمع أفضل الموردين المعتمدين في بكج واحد مع توفير حقيقي وإمكانية التعديل.
            </p>
          </div>
          <Link
            href="/packages"
            className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
          >
            <span>استعراض كل الباقات ({packages.length})</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.slice(0, 3).map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onBookPackage={handleBookPackage} />
          ))}
        </div>
      </section>

      {/* 5. Most Booked Services in City */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
              خدمات وتجهيزات معتمدة
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              الأكثر حجزاً في {activeCityObj.nameAr} ⭐
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
          >
            <span>استكشف سوق الخدمات</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.slice(0, 3).map((srv) => (
            <ServiceCard key={srv.id} service={srv} onBookNow={handleBookService} />
          ))}
        </div>
      </section>

      {/* 6. Inspiration Section ("إلهام - احجز هذا التصميم") */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
              أفكار وتصاميم واقعية
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              معرض الإلهام (Inspiration Feed) ✨
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              تصفح تصاميم حقيقية لمناسبات سعودية مع إمكانية حجز نفس التصميم والموردين بضغطة زر.
            </p>
          </div>
          <Link
            href="/inspiration"
            className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
          >
            <span>تصفح كل الأفكار</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {inspirationPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl transition group flex flex-col justify-between"
            >
              <div className="relative h-64 w-full bg-gray-100 overflow-hidden">
                <img
                  src={post.mediaUrl}
                  alt={post.titleAr}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {post.cityNameAr} • {post.occasionTypeNameAr}
                </div>
              </div>

              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 line-clamp-2">
                    {post.titleAr}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {post.descriptionAr}
                  </p>

                  {/* Tagged Vendors */}
                  <div className="space-y-1.5 pt-3 border-t border-saudi-sand-200 mt-3">
                    <span className="text-[11px] font-bold text-saudi-gold-700 block">
                      الموردين المنفذين لهذا التصميم:
                    </span>
                    {post.taggedVendors.map((tv, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-700">
                        <span>{tv.category}: <span className="font-semibold text-saudi-green-900">{tv.vendorName}</span></span>
                        <span className="font-bold text-gray-900">{formatSAR(tv.servicePrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3">
                  <Link
                    href={`/plan?inspiration=${post.id}`}
                    className="w-full py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Sparkles className="w-4 h-4 text-saudi-gold-300" />
                    <span>أنشئ مناسبة بهذا التصميم</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Saudi Payment Modal */}
      {bookingModalItem && (
        <SaudiPaymentModal
          bookingTitle={bookingModalItem.title}
          vendorName={bookingModalItem.vendorName}
          date="2026-10-30"
          totalAmount={bookingModalItem.totalAmount}
          onClose={() => setBookingModalItem(null)}
          onPaymentSuccess={(method, isDeposit, ref) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || bookingModalItem.title,
              vendorId: 'vendor-1',
              vendorName: bookingModalItem.vendorName,
              vendorLogo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80',
              serviceTitleAr: bookingModalItem.title,
              date: '2026-10-30',
              cityAr: activeCityObj.nameAr,
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: bookingModalItem.totalAmount,
              depositAmount: Math.round(bookingModalItem.totalAmount * 0.3),
              remainingAmount: bookingModalItem.totalAmount - Math.round(bookingModalItem.totalAmount * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل المناسبة.',
              deliverablesAr: ['تنفيذ الخدمة حسب المواصفات المتفق عليها'],
            });
          }}
        />
      )}
    </div>
  );
}
