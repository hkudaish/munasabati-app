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
  Store,
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
  Clock,
  TrendingUp,
  FileText,
  Award,
  AlertCircle,
  Eye,
  Settings,
  CreditCard,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import ServiceCard from '@/components/marketplace/ServiceCard';
import PackageCard from '@/components/marketplace/PackageCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import CustomerReviewsShowcase from '@/components/common/CustomerReviewsShowcase';
import { ServiceItem, SmartPackage, UserRole } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const {
    currentRole,
    currentUser,
    switchRole,
    openOnboarding,
    adminConfig,
    occasionTypes,
    serviceCategories,
    packages,
    services,
    vendors,
    bookings,
    rfqRequests,
    inspirationPosts,
    setIsAIOpen,
    selectedCity,
    cities,
    createBooking,
    activeOccasion,
    updateVendorStatus,
    cart,
  } = useApp();

  const [bookingModalItem, setBookingModalItem] = useState<{
    title: string;
    vendorName: string;
    totalAmount: number;
    serviceId?: string;
    packageId?: string;
  } | null>(null);

  // Client selected service category filter
  const [clientCategoryFilter, setClientCategoryFilter] = useState<string>('all');

  // Vendor view mode on homepage
  const [vendorServiceView, setVendorServiceView] = useState<'my_services' | 'market_comparison'>('my_services');

  // Admin approval toast simulation
  const [adminActionNotice, setAdminActionNotice] = useState<string | null>(null);

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

  // Filtered services for client based on active category
  const clientFilteredServices = services.filter((srv) => {
    const matchesCategory = clientCategoryFilter === 'all' || srv.categoryId === clientCategoryFilter;
    const matchesCity = !selectedCity || srv.cityId === selectedCity;
    return matchesCategory && matchesCity;
  });

  // Calculate platform metrics for admin view
  const totalBookingsAmount = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const pendingVendors = vendors.filter((v) => !v.verified || v.status === 'under_review');
  const openRFQs = rfqRequests.filter((r) => r.status === 'open');

  return (
    <div className="space-y-12 pb-20">
      {/* =========================================================================
          ROLE CONTEXT & FILTER BAR (عرض مخصص حسب نوع الحساب النشط)
      ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 border border-saudi-gold-500/30 rounded-2xl p-3.5 sm:p-4 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/20 border border-saudi-gold-400/40 flex items-center justify-center shrink-0">
              {currentRole === 'client' && <Sparkles className="w-5 h-5 text-saudi-gold-300" />}
              {currentRole === 'vendor' && <Store className="w-5 h-5 text-saudi-gold-300" />}
              {currentRole === 'admin' && <ShieldCheck className="w-5 h-5 text-saudi-gold-300" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-saudi-gold-300 font-bold uppercase tracking-wider">
                  طريقة العرض المخصصة حالياً:
                </span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-saudi-gold-500 text-saudi-green-950 shadow-sm">
                  {currentRole === 'client' && 'صاحب المناسبة (العميل)'}
                  {currentRole === 'vendor' && 'مورد ومزود خدمات معتمد'}
                  {currentRole === 'admin' && 'إدارة المنصة المركزية'}
                </span>
                {currentUser && (
                  <span className="text-xs text-gray-300 hidden sm:inline">
                    • مسجل باسم: <strong className="text-white font-bold">{currentUser.name}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5 font-tajawal">
                {currentRole === 'client' && 'يتم عرض خدمات التخطيط، باقات المناسبات، حاسبة الميزانية، وتصفح الموردين المعتمدين.'}
                {currentRole === 'vendor' && 'يتم عرض فرص طلبات التسعير (RFQs)، إدارة الخدمات، جدول الحجوزات، وأدوات نمو المورد.'}
                {currentRole === 'admin' && 'يتم عرض مؤشرات أداء المنصة، طلبات توثيق السجلات، تدقيق الخدمات، وسجل المعاملات.'}
              </p>
            </div>
          </div>

          {/* Quick role changer shortcut */}
          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 bg-black/30 p-1 rounded-xl border border-white/10">
            <span className="text-[11px] text-gray-300 px-2 font-medium">تبديل المنظور:</span>
            <button
              onClick={() => switchRole('client')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                currentRole === 'client'
                  ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              عميل
            </button>
            <button
              onClick={() => {
                const res = switchRole('vendor');
                if (!res.allowed) {
                  openOnboarding('vendor');
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                currentRole === 'vendor'
                  ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              مورد
            </button>
            <button
              onClick={() => {
                const res = switchRole('admin');
                if (!res.allowed) {
                  openOnboarding();
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                currentRole === 'admin'
                  ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              إدارة
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          VIEW A: CUSTOMER / CLIENT (صاحب المناسبة)
      ========================================================================= */}
      {currentRole === 'client' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Client Hero Section */}
          <section className="relative bg-hero-pattern text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/20">
            <div className="absolute -top-24 right-1/4 w-96 h-96 bg-saudi-gold-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-saudi-green-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 bg-saudi-gold-500/15 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  {currentUser
                    ? `أهلاً بك يا ${currentUser.name} • مساحة تخطيط مناسبتك الذكية 🇸🇦`
                    : 'المنصة السعودية الذكية الأولى لتنظيم والاحتفال بالمناسبات 🇸🇦'}
                </span>
              </div>

              <div className="max-w-3xl space-y-4">
                <h1 className="text-3xl sm:text-5xl font-black font-cairo leading-tight tracking-tight text-white">
                  خططها. احجزها. اعزمهم.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-saudi-gold-300 via-saudi-gold-400 to-amber-200">
                    واحتفل بأجمل اللحظات.
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl font-tajawal">
                  من الفكرة وحتى آخر ضيف — كل تجهيزات مناسبتك في مكان واحد: قاعات، ضيافة سعودية، كوش وتنسيق، مصورين، باقات جاهزة، وحجز فوري موثق.
                </p>
              </div>

              {/* Client Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/plan"
                  className="px-6 py-3.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-sm shadow-lg shadow-saudi-gold-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  <PlusCircle className="w-5 h-5 text-saudi-green-950" />
                  <span>+ ابدأ تخطيط مناسبتك</span>
                </Link>

                <Link
                  href="/calculator"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-saudi-gold-400/40 text-saudi-gold-300 font-bold rounded-2xl text-sm backdrop-blur-md flex items-center gap-2 transition"
                >
                  <DollarSign className="w-4 h-4 text-saudi-gold-400" />
                  <span>حاسبة الميزانية الذكية</span>
                </Link>

                <Link
                  href="/rfq"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm backdrop-blur-md flex items-center gap-2 transition"
                >
                  <FileText className="w-4 h-4 text-saudi-gold-300" />
                  <span>طلب تسعير فوري (RFQ)</span>
                </Link>

                <button
                  onClick={() => setIsAIOpen(true)}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/15 border border-white/20 text-white font-bold rounded-2xl text-sm backdrop-blur-md flex items-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4 text-saudi-gold-300" />
                  <span>المساعد الذكي ({adminConfig.aiAssistantNameAr})</span>
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
                  <span>دفع مجزأ (عربون + متبقي عند التنفيذ)</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Client Active Planning Strip (إذا كان لديه مناسبة أو عناصر في السلة) */}
          {activeOccasion && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-gradient-to-r from-saudi-sand-100 via-white to-saudi-sand-100 border border-saudi-gold-400/30 rounded-2xl p-5 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-saudi-green-800 text-white">
                      مناسبتك الحالية قيد التجهيز
                    </span>
                    <h3 className="text-base sm:text-lg font-black font-cairo text-saudi-green-950">
                      {activeOccasion.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-saudi-gold-600" />
                      {activeOccasion.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-saudi-gold-600" />
                      {activeOccasion.cityNameAr}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-saudi-green-900">
                      <DollarSign className="w-3.5 h-3.5 text-saudi-gold-600" />
                      الميزانية: {formatSAR(activeOccasion.budget)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-saudi-gold-700 font-bold">
                      جاهزية التجهيزات: {activeOccasion.readinessPercentage}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/plan"
                    className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <span>متابعة خطة المناسبة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                  {cart.length > 0 && (
                    <Link
                      href="/marketplace"
                      className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl transition flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>في السلة ({cart.length})</span>
                    </Link>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 3. Client Section: "ما مناسبتك؟" */}
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
                <span>عرض كافة أنواع المناسبات ({occasionTypes.length})</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

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

          {/* 4. Client Section: Smart Packages */}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.slice(0, 3).map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} onBookPackage={handleBookPackage} />
              ))}
            </div>
          </section>

          {/* 5. Client Services Filtered by Category in City */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  تجهيزات وخدمات المناسبات
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  الخدمات المميزة في {activeCityObj.nameAr} ⭐
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  اختر الفئة واستعرض الخدمات المعتمدة للحجز المباشر مع ضمان المنصة.
                </p>
              </div>
              <Link
                href="/marketplace"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1 shrink-0"
              >
                <span>سوق الخدمات الشامل</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            {/* Category Filter Chips for Clients */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setClientCategoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  clientCategoryFilter === 'all'
                    ? 'bg-saudi-green-800 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                الكل ({services.length})
              </button>
              {serviceCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setClientCategoryFilter(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                    clientCategoryFilter === cat.id
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.nameAr}
                </button>
              ))}
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {clientFilteredServices.slice(0, 6).map((srv) => (
                <ServiceCard key={srv.id} service={srv} onBookNow={handleBookService} />
              ))}
            </div>
          </section>

          {/* 6. Client Section: AI Planner */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-saudi-green-900 via-saudi-green-800 to-saudi-green-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-saudi-gold-500/30">
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-1.5 bg-saudi-gold-500/20 text-saudi-gold-300 px-3 py-1 rounded-full text-xs font-bold border border-saudi-gold-400/30">
                  <Sparkles className="w-3.5 h-3.5 text-saudi-gold-400" />
                  <span>المساعد الذكي: {adminConfig.aiAssistantNameAr}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black font-cairo text-white">
                  لا تشيل هم الترتيب وتوزيع الميزانية!
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
                    <span>جرّب التخطيط بالذكاء الاصطناعي مجاناً</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 7. Client Reviews Showcase */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CustomerReviewsShowcase featuredOnly={true} limit={6} />
          </section>

          {/* 8. Client RFQ Banner (إذا لم يجد ما يبحث عنه) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-r from-saudi-sand-200 via-white to-saudi-sand-200 border border-saudi-gold-400/40 shadow-card flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-right">
                <span className="text-xs font-bold text-saudi-gold-700 uppercase tracking-wider block">
                  عروض أسعار خاصة بمناسبتك
                </span>
                <h3 className="text-2xl font-black font-cairo text-saudi-green-950">
                  عندك متطلبات مخصصة؟ اطلب تسعير خاص من الموردين 💬
                </h3>
                <p className="text-xs text-gray-600 max-w-xl font-tajawal">
                  أرسل تفاصيل مناسبتك وسيقوم الموردون المعتمدون في منطقتك بتقديم عروض أسعار تنافسية خلال 24 ساعة مع ضمان الالتزام.
                </p>
              </div>
              <Link
                href="/rfq"
                className="px-6 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition shrink-0 flex items-center gap-2"
              >
                <span>إنشاء طلب تسعير (RFQ) جديد</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          VIEW B: SUPPLIER / VENDOR (بوابة الموردين والشركاء)
      ========================================================================= */}
      {currentRole === 'vendor' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Vendor Hero Section */}
          <section className="relative bg-gradient-to-br from-saudi-green-950 via-[#0B2820] to-saudi-green-950 text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/20">
            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold">
                <Store className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  بوابة الموردين والشركاء المعتمدين 🇸🇦 •{' '}
                  {currentUser?.businessName || currentUser?.name || 'مورد خدمات مناسبات'}
                </span>
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl sm:text-4xl font-black font-cairo leading-tight text-white">
                  مرحباً بك في مركز نمو أعمالك ومبيعاتك 📈
                </h1>
                <p className="text-sm text-gray-300 leading-relaxed font-tajawal">
                  راقب طلبات الحجز المباشرة، نافس وقدم عروض الأسعار على طلبات RFQ، حدّث أسعار خدماتك وباقاتك، واستفد من نظام الدفع المضمون والضمان البنكي.
                </p>
              </div>

              {/* Live Operational KPIs Strip for Vendors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>الحجوزات النشطة</span>
                    <Calendar className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {bookings.filter((b) => b.status === 'confirmed').length}
                  </div>
                  <span className="text-[10px] text-saudi-gold-300">مؤكدة وجاهزة للتنفيذ</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>طلبات RFQ المتاحة</span>
                    <FileText className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-saudi-gold-300 font-cairo">
                    {openRFQs.length}
                  </div>
                  <span className="text-[10px] text-gray-300">طلبات عملاء بانتظار عروضك</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>تقييم المنشأة</span>
                    <Star className="w-4 h-4 text-saudi-gold-400 fill-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    4.9 / 5.0
                  </div>
                  <span className="text-[10px] text-green-300">موثق بالسجل التجاري ✔</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>سرعة الاستجابة</span>
                    <Clock className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    15 دقيقة
                  </div>
                  <span className="text-[10px] text-saudi-gold-300">أعلى من متوسط السوق</span>
                </div>
              </div>

              {/* Vendor Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/vendor"
                  className="px-6 py-3.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-sm shadow-lg flex items-center gap-2 transition"
                >
                  <Store className="w-4 h-4 text-saudi-green-950" />
                  <span>الدخول للوحة المورد الكاملة</span>
                </Link>

                <Link
                  href="/vendor?tab=bookings"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-saudi-gold-300" />
                  <span>إدارة الحجوزات الواردة</span>
                </Link>

                <Link
                  href="/vendor?tab=services"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-saudi-gold-300" />
                  <span>إضافة وتعديل الخدمات والأسعار</span>
                </Link>

                <Link
                  href="/marketplace"
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-saudi-gold-400" />
                  <span>معاينة كيف يرى العملاء خدماتك</span>
                </Link>
              </div>
            </div>
          </section>

          {/* 2. Vendor Section: Live Client RFQs Feed (فرص العمل وطلبات التسعير) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  فرص أعمال جديدة لموردين معتمدين
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  طلبات التسعير المتاحة للمزايدة (Live RFQs) 💬
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  طلبات مباشرة من أصحاب مناسبات يبحثون عن موردين لتنفيذ خدماتهم. قدم عرضك التنافسي الآن!
                </p>
              </div>
              <Link
                href="/vendor?tab=rfq"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>عرض جميع طلبات RFQ ({openRFQs.length})</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openRFQs.map((rfq) => (
                <div
                  key={rfq.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 p-5 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-saudi-green-50 text-saudi-green-900 border border-saudi-green-200">
                        {rfq.occasionTypeAr}
                      </span>
                      <span className="text-xs font-bold text-saudi-gold-700">
                        الميزانية: {formatSAR(rfq.budget)}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-gray-900 font-cairo">
                      {rfq.occasionTitle}
                    </h3>

                    <p className="text-xs text-gray-600 line-clamp-2 font-tajawal">
                      {rfq.requirementsAr}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-2 border-t border-saudi-sand-200">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.cityAr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.guestCount} ضيف
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      العروض المقدمة: <strong className="text-gray-700">{rfq.quotesCount}</strong>
                    </span>
                    <Link
                      href={`/vendor?tab=rfq&id=${rfq.id}`}
                      className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      تقديم عرض سعر فوري
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Vendor Section: Service Catalog & Market Benchmarking */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  كتالوج الخدمات والأسعار
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  خدماتك المعروضة في المنصة 🏪
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك استعراض خدماتك المعروضة أو مقارنة أسعار الخدمات المماثلة في {activeCityObj.nameAr}.
                </p>
              </div>

              {/* View Scope Toggle */}
              <div className="flex items-center gap-2 bg-saudi-sand-100 p-1 rounded-xl border border-saudi-sand-300 self-start sm:self-auto">
                <button
                  onClick={() => setVendorServiceView('my_services')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    vendorServiceView === 'my_services'
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'text-gray-700 hover:text-saudi-green-900'
                  }`}
                >
                  خدماتي المسجلة
                </button>
                <button
                  onClick={() => setVendorServiceView('market_comparison')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    vendorServiceView === 'market_comparison'
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'text-gray-700 hover:text-saudi-green-900'
                  }`}
                >
                  مقارنة أسعار السوق ({activeCityObj.nameAr})
                </button>
              </div>
            </div>

            {/* Services Grid with Vendor Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-card flex flex-col justify-between"
                >
                  <div className="relative h-44 w-full bg-gray-100">
                    <img src={srv.images[0]} alt={srv.titleAr} className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 right-2.5 bg-saudi-green-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {srv.categoryNameAr}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-saudi-gold-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                      {formatSAR(srv.price)}
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{srv.titleAr}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{srv.descriptionAr}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-saudi-sand-200 text-xs text-gray-600">
                      <span>المدينة: {srv.cityNameAr}</span>
                      <span className="text-saudi-gold-700 font-bold">★ {srv.vendorRating}</span>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <Link
                        href={`/vendor?tab=services&edit=${srv.id}`}
                        className="flex-1 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-900 font-bold text-xs rounded-xl text-center transition"
                      >
                        تعديل في لوحة المورد
                      </Link>
                      <button
                        onClick={() => handleBookService(srv)}
                        className="px-3 py-2 bg-saudi-green-800 text-white font-bold text-xs rounded-xl hover:bg-saudi-green-900 transition"
                        title="معاينة عملية الحجز كما يراها العميل"
                      >
                        معاينة الحجز
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Vendor Growth & Certification Hub */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 rounded-3xl p-6 sm:p-10 text-white border border-saudi-gold-500/30 shadow-2xl">
              <div className="max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-saudi-gold-500/20 text-saudi-gold-300 text-xs font-bold border border-saudi-gold-500/30">
                  <Award className="w-3.5 h-3.5" />
                  <span>مزايا المورد المعتمد في منصة مناسبتي</span>
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-cairo text-white">
                  احصل على شارة التوثيق الذهبية وضاعف مبيعاتك 🛡️
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-tajawal">
                  منشأتك الموثقة بالسجل التجاري أو وثيقة العمل الحر تظهر في أعلى نتائج البحث والترشيحات الذكية للعملاء. جميع الحجوزات مدفوعة ومؤمنة في حساب ضمان المنصة قبل موعد المناسبة.
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <Link
                    href="/vendor?tab=verification"
                    className="px-5 py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-black rounded-xl text-xs sm:text-sm transition flex items-center gap-2"
                  >
                    <span>توثيق السجل التجاري / العمل الحر</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/vendor?tab=packages"
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs sm:text-sm transition"
                  >
                    <span>الانضمام إلى باقات مناسبتي الذكية</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          VIEW C: PLATFORM ADMIN (لوحة الإدارة والرقابة المركزية)
      ========================================================================= */}
      {currentRole === 'admin' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Admin Central Hero Section */}
          <section className="relative bg-gradient-to-br from-[#071d17] via-[#09221b] to-[#071d17] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/30">
            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  لوحة القيادة المركزية وإدارة المنصة 🇸🇦 • {currentUser?.name || 'مدير النظام'}
                </span>
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl sm:text-4xl font-black font-cairo leading-tight text-white">
                  مركز الرقابة العامة والعمليات التشغيلية 🛡️
                </h1>
                <p className="text-sm text-gray-300 leading-relaxed font-tajawal">
                  مراقبة فورية لتدفق الحجوزات في كافة المدن، تدقيق واعتماد الموردين الجدد، متابعة التحويلات المالية في حساب الضمان، وضمان جودة الخدمات المقدمة لأصحاب المناسبات.
                </p>
              </div>

              {/* Live Platform Health KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>الموردين المعتمدين</span>
                    <Store className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {vendors.length}
                  </div>
                  <span className="text-[10px] text-green-300">
                    {vendors.filter((v) => v.verified).length} مورد موثق رسمياً
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>حجم المعاملات SAR</span>
                    <CreditCard className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-saudi-gold-300 font-cairo">
                    {formatSAR(totalBookingsAmount)}
                  </div>
                  <span className="text-[10px] text-gray-300">{bookings.length} معاملة منجزة</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>طلبات التوثيق المعلقة</span>
                    <FileText className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-cairo">
                    {pendingVendors.length}
                  </div>
                  <span className="text-[10px] text-amber-200">بانتظار تدقيق السجل</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>الخدمات والباقات النشطة</span>
                    <Layers className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {services.length + packages.length}
                  </div>
                  <span className="text-[10px] text-saudi-gold-300">عبر {cities.length} مدن</span>
                </div>
              </div>

              {/* Admin Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/admin"
                  className="px-6 py-3.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-sm shadow-lg flex items-center gap-2 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-saudi-green-950" />
                  <span>فتح لوحة الإدارة المركزية الكاملة</span>
                </Link>

                <Link
                  href="/admin?tab=vendors"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-saudi-gold-300" />
                  <span>إدارة الموردين والتوثيق</span>
                </Link>

                <Link
                  href="/admin?tab=bookings"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-saudi-gold-300" />
                  <span>مراقبة الحجوزات والمدفوعات</span>
                </Link>

                <Link
                  href="/admin?tab=settings"
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-saudi-gold-400" />
                  <span>إعدادات النظام والعمولات</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Admin notice banner */}
          {adminActionNotice && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-saudi-green-900 text-white p-3 rounded-xl flex items-center justify-between text-xs font-bold border border-saudi-gold-400">
                <span>{adminActionNotice}</span>
                <button
                  onClick={() => setAdminActionNotice(null)}
                  className="text-saudi-gold-300 hover:text-white"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}

          {/* 2. Admin Section: Pending Vendor Approvals */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  إجراءات المشرف الفورية
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  طلبات اعتماد وتوثيق الموردين ({pendingVendors.length}) 📑
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  قم بمراجعة السجلات التجارية ووثائق العمل الحر واعتماد الموردين ليظهروا في سوق المنصة.
                </p>
              </div>
              <Link
                href="/admin?tab=vendors"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>لوحة تدقيق الموردين الكاملة</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 p-5 shadow-card space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={vendor.logo}
                        alt={vendor.businessName}
                        className="w-12 h-12 rounded-xl object-cover border border-saudi-sand-300"
                      />
                      <div>
                        <h4 className="font-black text-sm text-gray-900 font-cairo">
                          {vendor.businessName}
                        </h4>
                        <span className="text-[11px] text-gray-500">
                          {vendor.categoryNameAr} • {vendor.cityNameAr}
                        </span>
                      </div>
                    </div>

                    <div className="bg-saudi-sand-50 p-2.5 rounded-xl text-xs space-y-1 text-gray-700">
                      <div>
                        السجل التجاري: <strong className="font-mono">{vendor.crNumber || 'تحت التدقيق'}</strong>
                      </div>
                      <div>
                        رقم الاتصال: <span className="font-mono">{vendor.contactPhone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateVendorStatus(vendor.id, 'active', true);
                        setAdminActionNotice(`تم اعتماد وتوثيق ${vendor.businessName} بنجاح!`);
                      }}
                      className="flex-1 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      اعتماد وتوثيق الآن ✔
                    </button>
                    <Link
                      href={`/admin?tab=vendors&id=${vendor.id}`}
                      className="px-3 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 font-bold text-xs rounded-xl transition"
                    >
                      مراجعة
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Admin Section: Platform Transactions Stream */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  سجل التدفقات المالية
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  أحدث الحجوزات والعمليات المالية المبرمة 💳
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  متابعة أموال الضمان وعربون الحجز ونسب عمولة المنصة (10%).
                </p>
              </div>
              <Link
                href="/admin?tab=bookings"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>سجل الحجوزات المالي</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-saudi-sand-100 text-gray-700 font-bold border-b border-saudi-sand-300">
                    <tr>
                      <th className="p-3.5">رقم الحجز</th>
                      <th className="p-3.5">المناسبة والخدمة</th>
                      <th className="p-3.5">العميل</th>
                      <th className="p-3.5">المورد</th>
                      <th className="p-3.5">المبلغ الإجمالي</th>
                      <th className="p-3.5">حالة الدفع</th>
                      <th className="p-3.5">إجراء المشرف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-saudi-sand-200">
                    {bookings.slice(0, 5).map((b) => (
                      <tr key={b.id} className="hover:bg-saudi-sand-50">
                        <td className="p-3.5 font-mono font-bold text-saudi-green-900">
                          {b.bookingNumber}
                        </td>
                        <td className="p-3.5 font-bold text-gray-900">
                          {b.occasionTitle}
                          <span className="block text-[10px] text-gray-500 font-normal">
                            {b.serviceTitleAr}
                          </span>
                        </td>
                        <td className="p-3.5">{b.customerName}</td>
                        <td className="p-3.5 text-saudi-green-800 font-bold">{b.vendorName}</td>
                        <td className="p-3.5 font-black text-gray-900">{formatSAR(b.totalAmount)}</td>
                        <td className="p-3.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                            {b.status === 'confirmed' ? 'مؤكد بالضمان' : b.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <Link
                            href="/admin?tab=bookings"
                            className="text-saudi-gold-700 hover:underline font-bold"
                          >
                            تفاصيل
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 4. Admin Live Persona Switcher Tool */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-saudi-sand-100 via-white to-saudi-sand-100 border border-saudi-gold-400/30 rounded-2xl p-6 shadow-card flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-right">
                <h4 className="font-black text-base text-saudi-green-950 font-cairo">
                  أداة فحص ومعاينة تجربة المستخدمين (Persona Simulator) 🎭
                </h4>
                <p className="text-xs text-gray-600 font-tajawal">
                  بصفتك مديراً للنظام، يمكنك تجربة المنصة كما يراها العميل أو المورد دون الحاجة لتسجيل الخروج.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => switchRole('client')}
                  className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  معاينة تجربة العميل
                </button>
                <button
                  onClick={() => switchRole('vendor')}
                  className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl shadow-sm transition"
                >
                  معاينة تجربة المورد
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          GLOBAL MODAL: SAUDI PAYMENT MODAL
      ========================================================================= */}
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
              vendorLogo:
                'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80',
              serviceTitleAr: bookingModalItem.title,
              date: '2026-10-30',
              cityAr: activeCityObj.nameAr,
              customerName: currentUser?.name || 'سارة العتيبي',
              customerPhone: currentUser?.phone || '+966501234567',
              totalAmount: bookingModalItem.totalAmount,
              depositAmount: Math.round(bookingModalItem.totalAmount * 0.3),
              remainingAmount:
                bookingModalItem.totalAmount - Math.round(bookingModalItem.totalAmount * 0.3),
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
