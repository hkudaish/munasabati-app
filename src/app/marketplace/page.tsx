'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  ShoppingBag,
  MapPin,
  Star,
  Zap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import ServiceCard from '@/components/marketplace/ServiceCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import { ServiceItem } from '@/lib/types';

export default function MarketplacePage() {
  const { serviceCategories, services, cities, selectedCity, setSelectedCity, createBooking, activeOccasion } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantBookingOnly, setInstantBookingOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'women' | 'men'>('all');

  const [bookingModalItem, setBookingModalItem] = useState<ServiceItem | null>(null);

  // Filter services
  const filteredServices = services.filter((srv) => {
    const matchesCategory = selectedCategory === 'all' || srv.categoryId === selectedCategory;
    const matchesSearch =
      srv.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = !selectedCity || srv.cityId === selectedCity;
    const matchesInstant = !instantBookingOnly || srv.instantBooking;
    const matchesGender =
      genderFilter === 'all' || srv.genderPreference === genderFilter || srv.genderPreference === 'unisex';

    return matchesCategory && matchesSearch && matchesCity && matchesInstant && matchesGender;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
          <ShoppingBag className="w-4 h-4" />
          <span>سوق الخدمات والتجهيزات المعتمدة بالمملكة</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
          سوق الخدمات والموردين 🇸🇦
        </h1>
        <p className="text-xs text-gray-500 max-w-2xl font-tajawal">
          احجز مباشرة من نخبة الموردين الموثقين: كوش وديكور، ضيافة سعودية، مصورين، فرق شعبية، ومستلزمات الحفلات مع حماية كاملة لحقوقك.
        </p>
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
          كافة التصنيفات ({services.length})
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

          {/* Gender Filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as any)}
            className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl font-bold text-gray-700"
          >
            <option value="all">كل الأقسام</option>
            <option value="women">طاقم نسائي</option>
            <option value="men">طاقم رجالي</option>
          </select>

          {/* Instant Booking Toggle */}
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
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-saudi-sand-300 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto" />
          <h4 className="text-base font-bold text-gray-800 font-cairo">
            لم نجد خدمات مطابقة لبحثك
          </h4>
          <p className="text-xs text-gray-500">
            جرّب تغيير كلمات البحث أو استعراض تصنيف آخر.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((srv) => (
            <ServiceCard
              key={srv.id}
              service={srv}
              onBookNow={(selectedSrv) => setBookingModalItem(selectedSrv)}
            />
          ))}
        </div>
      )}

      {/* Booking / Payment Modal */}
      {bookingModalItem && (
        <SaudiPaymentModal
          bookingTitle={bookingModalItem.titleAr}
          vendorName={bookingModalItem.vendorName}
          date="2026-11-25"
          totalAmount={bookingModalItem.price}
          onClose={() => setBookingModalItem(null)}
          onPaymentSuccess={(method, isDeposit, ref) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || bookingModalItem.titleAr,
              vendorId: bookingModalItem.vendorId,
              vendorName: bookingModalItem.vendorName,
              vendorLogo: bookingModalItem.vendorLogo,
              serviceId: bookingModalItem.id,
              serviceTitleAr: bookingModalItem.titleAr,
              date: '2026-11-25',
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
          }}
        />
      )}
    </div>
  );
}
