'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ShoppingBag,
  MapPin,
  Star,
  Zap,
  ShieldCheck,
  Sparkles,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowLeftRight,
  Store,
  Layers,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import ServiceCard from '@/components/marketplace/ServiceCard';
import VendorCard from '@/components/marketplace/VendorCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import CustomerReviewsShowcase from '@/components/common/CustomerReviewsShowcase';
import { ServiceItem } from '@/lib/types';
import { formatSaudiRiyal, calculateCartTotals } from '@/lib/utils';
import { rankVendors } from '@/lib/ranking-engine';

export default function MarketplacePage() {
  const router = useRouter();
  const {
    serviceCategories,
    services,
    vendors,
    cities,
    selectedCity,
    setSelectedCity,
    createBooking,
    activeOccasion,
    cart,
    appliedCoupon,
    comparisonVendorIds,
    clearComparison,
    currentRole,
    currentUser,
    switchRole,
    openOnboarding,
    setIsAIOpen,
    rankingWeights,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'services' | 'vendors'>('services');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantBookingOnly, setInstantBookingOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'women' | 'men'>('all');
  const [vendorScopeFilter, setVendorScopeFilter] = useState<'all' | 'my_services'>('all');
  const [sortOption, setSortOption] = useState<
    'recommended' | 'rating' | 'price_low' | 'price_high' | 'fastest' | 'orders'
  >('recommended');

  const [bookingModalItem, setBookingModalItem] = useState<ServiceItem | null>(null);

  // Filter & Sort Services
  const filteredServices = services
    .filter((srv) => {
      const matchesCategory = selectedCategory === 'all' || srv.categoryId === selectedCategory;
      const matchesSearch =
        srv.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = !selectedCity || srv.cityId === selectedCity;
      const matchesInstant = !instantBookingOnly || srv.instantBooking;
      const matchesGender =
        genderFilter === 'all' || srv.genderPreference === genderFilter || srv.genderPreference === 'unisex';
      const matchesVerified = !verifiedOnly || srv.vendorRating >= 4.7;

      // Filter by vendor scope if active role is vendor
      const isMyService =
        (currentUser?.vendorId && srv.vendorId === currentUser.vendorId) ||
        (currentUser?.businessName && srv.vendorName === currentUser.businessName) ||
        (currentUser?.role === 'vendor' && srv.vendorId === 'vendor-1');
      const matchesVendorScope =
        currentRole !== 'vendor' || vendorScopeFilter === 'all' || isMyService;

      return (
        matchesCategory &&
        matchesSearch &&
        matchesCity &&
        matchesInstant &&
        matchesGender &&
        matchesVerified &&
        matchesVendorScope
      );
    })
    .sort((a, b) => {
      if (sortOption === 'rating') return b.vendorRating - a.vendorRating;
      if (sortOption === 'price_low') return a.price - b.price;
      if (sortOption === 'price_high') return b.price - a.price;
      if (sortOption === 'orders') return (b.price || 0) - (a.price || 0);
      return 0; // recommended default
    });

  // Filter & Sort Vendors
  const filteredVendors = vendors
    .filter((v) => {
      const matchesCategory = selectedCategory === 'all' || v.categoryId === selectedCategory;
      const matchesSearch =
        v.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.bioAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.cityNameAr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = !selectedCity || v.cityId === selectedCity;
      const matchesVerified = !verifiedOnly || v.verified;

      return matchesCategory && matchesSearch && matchesCity && matchesVerified;
    })
    .sort((a, b) => {
      if (sortOption === 'rating') return b.rating - a.rating;
      if (sortOption === 'fastest') return a.responseTimeMinutes - b.responseTimeMinutes;
      if (sortOption === 'orders') return (b.completedBookingsCount || 0) - (a.completedBookingsCount || 0);
      return 0;
    });

  const cartTotals = calculateCartTotals(cart, appliedCoupon);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-saudi-sand-200 pb-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
            <ShoppingBag className="w-4 h-4" />
            <span>سوق الخدمات والتجهيزات المعتمدة بالمملكة</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
            سوق الخدمات والموردين 🇸🇦
          </h1>
          <p className="text-xs text-gray-500 max-w-2xl font-tajawal">
            احجز مباشرة من نخبة الموردين الموثقين مع ضمان منصة مناسبتي، عقود إلكترونية موحدة، وسلة
            شاملة لكافة تجهيزات مناسبتك.
          </p>
        </div>

        {/* AI Assistant Quick Trigger */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="self-start md:self-center px-5 py-3 rounded-2xl bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black text-xs shadow-md shadow-saudi-gold-500/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 animate-spin-slow" />
          <span>اطلب ترشيح ومقارنة من لُـمى (AI)</span>
        </button>
      </div>

      {/* Role-Aware Banner & Scope Controls */}
      <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 rounded-2xl p-4 text-white border border-saudi-gold-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-saudi-gold-500/20 border border-saudi-gold-400/40 flex items-center justify-center shrink-0">
            {currentRole === 'client' && <Sparkles className="w-4 h-4 text-saudi-gold-300" />}
            {currentRole === 'vendor' && <Store className="w-4 h-4 text-saudi-gold-300" />}
            {currentRole === 'admin' && <ShieldCheck className="w-4 h-4 text-saudi-gold-300" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-saudi-gold-300">
                {currentRole === 'client' && 'تصفح بصفتك: صاحب المناسبة (حجز مباشر مضمون)'}
                {currentRole === 'vendor' && `تصفح بصفتك: مورد معتمد (${currentUser?.businessName || currentUser?.name || 'منشأتك'})`}
                {currentRole === 'admin' && 'تصفح بصفتك: مدير المنصة (وضع الإشراف والرقابة)'}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 font-tajawal">
              {currentRole === 'client' && 'جميع الخدمات خاضعة لضمان منصة مناسبتي مع إمكانية دفع عربون 30% والمتبقي عند التنفيذ.'}
              {currentRole === 'vendor' && 'يمكنك فحص ظهور خدماتك، مراقبة أسعار المنافسين في منطقتك، أو تصفية خدماتك المسجلة فقط.'}
              {currentRole === 'admin' && 'يمكنك تدقيق أسعار الخدمات، فحص شارات الموردين المعتمدين، ونسب العمولة المقررة.'}
            </p>
          </div>
        </div>

        {/* Vendor Specific Scope Buttons */}
        {currentRole === 'vendor' && (
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1 border border-white/10">
              <button
                onClick={() => setVendorScopeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  vendorScopeFilter === 'all'
                    ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                جميع الخدمات (المنافسين)
              </button>
              <button
                onClick={() => setVendorScopeFilter('my_services')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  vendorScopeFilter === 'my_services'
                    ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                خدماتي المسجلة فقط
              </button>
            </div>
            <Link
              href="/vendor?tab=services"
              className="px-3 py-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 text-xs font-bold rounded-xl transition flex items-center gap-1"
            >
              <span>+ إضافة خدمة</span>
            </Link>
          </div>
        )}

        {/* Admin Specific Action */}
        {currentRole === 'admin' && (
          <Link
            href="/admin?tab=vendors"
            className="self-end md:self-center px-3.5 py-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0"
          >
            <span>لوحة تدقيق الموردين والخدمات</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Dual Tab Buttons */}
        <div className="bg-saudi-sand-100 p-1 rounded-2xl flex items-center gap-1 border border-saudi-sand-300">
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'services'
                ? 'bg-saudi-green-800 text-white shadow-md'
                : 'text-gray-700 hover:text-saudi-green-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>استعراض الخدمات ({services.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'vendors'
                ? 'bg-saudi-green-800 text-white shadow-md'
                : 'text-gray-700 hover:text-saudi-green-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>دليل الموردين المعتمدين ({vendors.length})</span>
          </button>
        </div>

        {/* Layout & Sort Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-saudi-sand-300 px-3 py-1.5 rounded-xl text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-saudi-green-800" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent font-bold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="recommended">الأعلى ملاءمة (توصية لُـمى)</option>
              <option value="rating">الأعلى تقييماً ★</option>
              <option value="price_low">الأقل سعراً</option>
              <option value="price_high">الأعلى سعراً (فاخر)</option>
              <option value="fastest">الأسرع تجاوباً ⚡</option>
              <option value="orders">الأكثر حجوزات مكتملة</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-white border border-saudi-sand-300 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-saudi-green-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="عرض شبكي"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-saudi-green-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="عرض قائمة"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Categories Pills Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
            selectedCategory === 'all'
              ? 'bg-saudi-green-800 text-white shadow-md'
              : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
          }`}
        >
          كافة التصنيفات ({activeTab === 'services' ? services.length : vendors.length})
        </button>

        {serviceCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? 'bg-saudi-green-800 text-white shadow-md'
                : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
            }`}
          >
            <span>{cat.nameAr}</span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-saudi-sand-300 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن كوشة، قهوجي، مصورة، كيكة..."
            className="w-full pr-9 pl-4 py-2.5 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end text-xs">
          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl font-bold text-gray-700"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.nameAr}
              </option>
            ))}
          </select>

          {/* Gender Filter (Services only) */}
          {activeTab === 'services' && (
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl font-bold text-gray-700"
            >
              <option value="all">كل الأقسام</option>
              <option value="women">طاقم نسائي</option>
              <option value="men">طاقم رجالي</option>
            </select>
          )}

          {/* Verified Only Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer bg-saudi-sand-50 px-3 py-2 rounded-xl border border-gray-200">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded text-saudi-green-800"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-saudi-green-700" />
            <span className="font-bold text-gray-700">الموثقون فقط</span>
          </label>

          {/* Instant Booking Toggle */}
          {activeTab === 'services' && (
            <label className="flex items-center gap-1.5 cursor-pointer bg-saudi-sand-50 px-3 py-2 rounded-xl border border-gray-200">
              <input
                type="checkbox"
                checked={instantBookingOnly}
                onChange={(e) => setInstantBookingOnly(e.target.checked)}
                className="rounded text-saudi-green-800"
              />
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-gray-700">حجز فوري</span>
            </label>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'services' ? (
        /* SERVICES VIEW */
        filteredServices.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-saudi-sand-300 text-center space-y-3">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto" />
            <h4 className="text-base font-bold text-gray-800 font-cairo">
              لم نجد خدمات مطابقة لبحثك
            </h4>
            <p className="text-xs text-gray-500">
              جرب تغيير معايير البحث، أو اطلب من لُـمى اقتراح بدائل مناسبة.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
          >
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onBookNow={(srv) => setBookingModalItem(srv)}
              />
            ))}
          </div>
        )
      ) : (
        /* VENDORS VIEW */
        filteredVendors.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-saudi-sand-300 text-center space-y-3">
            <Store className="w-10 h-10 text-gray-300 mx-auto" />
            <h4 className="text-base font-bold text-gray-800 font-cairo">
              لم نجد موردين مطابقين لبحثك
            </h4>
            <p className="text-xs text-gray-500">
              جرب البحث في مدينة أخرى أو إزالة فلتر التوثيق.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
          >
            {filteredVendors.map((vendor) => {
              const primaryService = services.find((s) => s.vendorId === vendor.id);
              return (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  primaryService={primaryService}
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        )
      )}

      {/* Customer Reviews Showcase */}
      <CustomerReviewsShowcase />

      {/* FLOATING COMPARE DOCK */}
      {comparisonVendorIds.length > 0 && (
        <div className="fixed bottom-6 left-6 z-40 bg-saudi-green-950 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl border border-saudi-gold-400 flex items-center gap-3 animate-slideUp">
          <div className="flex items-center -space-x-2 space-x-reverse">
            {comparisonVendorIds.slice(0, 3).map((vId) => {
              const v = vendors.find((vend) => vend.id === vId);
              return v?.logo ? (
                <img
                  key={vId}
                  src={v.logo}
                  alt={v.businessName}
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
              ) : null;
            })}
          </div>

          <div className="text-xs">
            <span className="font-bold block">مقارنة الموردين</span>
            <span className="text-[10px] text-gray-300">
              {comparisonVendorIds.length} موردين محددين
            </span>
          </div>

          <Link
            href="/compare"
            className="px-3.5 py-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-xl text-xs transition flex items-center gap-1 shadow"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>عرض المقارنة</span>
          </Link>

          <button
            onClick={clearComparison}
            className="text-gray-400 hover:text-white p-1"
            title="مسح المقارنة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FLOATING CART BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-saudi-green-900 to-saudi-green-950 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl border border-saudi-gold-400 flex items-center gap-4 animate-slideUp">
          <div className="w-10 h-10 rounded-2xl bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>

          <div className="text-xs">
            <span className="font-bold block text-sm font-cairo">
              {cart.reduce((s, i) => s + i.quantity, 0)} خدمات في السلة
            </span>
            <span className="text-saudi-gold-300 font-bold">
              {formatSaudiRiyal(cartTotals.finalTotal)}
            </span>
          </div>

          <Link
            href="/cart"
            className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-black rounded-xl text-xs transition flex items-center gap-1 shadow"
          >
            <span>إتمام الحجز</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      )}

      {/* Instant Payment Modal */}
      {bookingModalItem && (
        <SaudiPaymentModal
          bookingTitle={bookingModalItem.titleAr}
          vendorName={bookingModalItem.vendorName}
          date="2026-10-09"
          totalAmount={bookingModalItem.price}
          onClose={() => setBookingModalItem(null)}
          onPaymentSuccess={(method, isDeposit) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || bookingModalItem.titleAr,
              vendorId: bookingModalItem.vendorId,
              vendorName: bookingModalItem.vendorName,
              vendorLogo: bookingModalItem.vendorLogo,
              serviceId: bookingModalItem.id,
              serviceTitleAr: bookingModalItem.titleAr,
              date: '2026-10-09',
              cityAr: bookingModalItem.cityNameAr,
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: bookingModalItem.price,
              depositAmount: Math.round(bookingModalItem.price * 0.3),
              remainingAmount: bookingModalItem.price - Math.round(bookingModalItem.price * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل موعد المناسبة.',
              deliverablesAr: bookingModalItem.featuresAr,
            });
            setBookingModalItem(null);
            router.push('/bookings');
          }}
        />
      )}
    </div>
  );
}
