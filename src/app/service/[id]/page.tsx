'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  ShieldCheck,
  Zap,
  MapPin,
  Clock,
  CheckCircle2,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Award,
  ShoppingBag,
  Plus,
  Check,
  Calendar,
  AlertCircle,
  HelpCircle,
  Share2,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, ensureServiceDetails, ensureVendorDetails } from '@/lib/utils';
import { checkAvailability } from '@/lib/ranking-engine';
import { ServicePackage, ServiceAddon } from '@/lib/types';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import confetti from 'canvas-confetti';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { services, vendors, reviews, createBooking, addToCart, setIsAIOpen, activeOccasion } = useApp();

  const serviceId = params?.id as string;
  const rawService = services.find((s) => s.id === serviceId) || services[0];
  const service = rawService ? ensureServiceDetails(rawService) : null;
  const rawVendor = vendors.find((v) => v.id === service?.vendorId) || vendors[0];
  const vendor = rawVendor ? ensureVendorDetails(rawVendor) : null;
  const serviceReviews = reviews.filter((r) => r.vendorId === vendor?.id);

  // Configuration state for booking / cart
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage>(
    service?.packages[0] || {
      id: 'basic',
      nameAr: 'الباقة الأساسية',
      price: service?.price || 1500,
      featuresAr: service?.featuresAr || [],
      durationHours: 4,
    }
  );

  const [selectedAddons, setSelectedAddons] = useState<ServiceAddon[]>([]);
  const [bookingDate, setBookingDate] = useState<string>('2026-10-09');
  const [bookingTime, setBookingTime] = useState<string>('18:00');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (!service || !vendor) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-xl font-bold font-cairo">الخدمة غير متوفرة</h2>
        <Link
          href="/marketplace"
          className="inline-block px-5 py-2.5 bg-saudi-green-800 text-white rounded-xl text-xs font-bold"
        >
          العودة لسوق الخدمات
        </Link>
      </div>
    );
  }

  // Check date availability
  const availabilityResult = checkAvailability(service.availability, bookingDate);

  // Calculate live total price for selected configuration
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const currentTotalPrice = selectedPackage.price + addonsTotal;

  const toggleAddon = (addon: ServiceAddon) => {
    if (selectedAddons.some((a) => a.id === addon.id)) {
      setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleAddToCart = () => {
    addToCart(service, selectedPackage, selectedAddons, {
      date: bookingDate,
      time: bookingTime,
      locationCity: service.cityNameAr,
      notes: bookingNotes,
    });

    setToastMessage(`تمت إضافة باقة "${selectedPackage.nameAr}" إلى سلتك بنجاح! 🛍️`);
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

      {/* Back Link & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-saudi-green-800 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لسوق الخدمات</span>
        </Link>

        <button
          onClick={() => setIsAIOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-saudi-gold-700 bg-saudi-gold-50 border border-saudi-gold-300 px-3 py-1.5 rounded-xl hover:bg-saudi-gold-100 transition"
        >
          <Sparkles className="w-4 h-4 text-saudi-gold-600" />
          <span>اسأل لُـمى عن هذه الخدمة</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media & Service Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Gallery */}
          <div className="rounded-3xl overflow-hidden border border-saudi-sand-300 shadow-sm bg-gray-100 h-80 sm:h-96 relative">
            <img
              src={service.images[0]}
              alt={service.titleAr}
              className="w-full h-full object-cover"
            />
            {service.badge && (
              <span className="absolute top-4 right-4 bg-saudi-green-900/90 backdrop-blur-md text-saudi-gold-300 text-xs font-bold px-3 py-1.5 rounded-full border border-saudi-gold-400/40">
                {service.badge}
              </span>
            )}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-xl text-xs font-bold">
              {service.images.length} صور موثقة
            </div>
          </div>

          {/* Title & Category Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="bg-saudi-sand-100 text-saudi-green-900 font-bold px-3 py-1 rounded-full">
                {service.categoryNameAr}
              </span>
              <span className="text-gray-400">• {service.cityNameAr}</span>
              {service.instantBooking && (
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  حجز فوري ومؤكد
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
              {service.titleAr}
            </h1>

            <p className="text-sm text-gray-600 leading-relaxed font-tajawal">
              {service.descriptionAr}
            </p>
          </div>

          {/* 1. Packages Selection Section */}
          <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
            <div>
              <span className="text-xs font-bold text-saudi-gold-600 uppercase tracking-wide">
                اختر الباقة المناسبة لمناسبتك
              </span>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 font-cairo">
                باقات الخدمة المتاحة
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {service.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    selectedPackage.id === pkg.id
                      ? 'border-saudi-green-800 bg-saudi-green-50/40 shadow-md ring-2 ring-saudi-green-800/10'
                      : 'border-saudi-sand-300 bg-white hover:border-saudi-sand-400 hover:bg-saudi-sand-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm text-saudi-green-950">{pkg.nameAr}</h4>
                      {selectedPackage.id === pkg.id && (
                        <CheckCircle2 className="w-4 h-4 text-saudi-green-800" />
                      )}
                    </div>
                    {pkg.descriptionAr && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">{pkg.descriptionAr}</p>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 pt-2 border-t border-saudi-sand-200">
                    {pkg.durationHours && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="w-3 h-3 text-saudi-green-700" />
                        <span>المدة: {pkg.durationHours} ساعات</span>
                      </div>
                    )}
                    {pkg.featuresAr.slice(0, 3).map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-1 text-[11px]">
                        <Check className="w-3 h-3 text-saudi-green-700 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-saudi-sand-200">
                    <span className="text-base font-black font-cairo text-saudi-green-950 block">
                      {formatSaudiRiyal(pkg.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Optional Extras / Add-ons Section */}
          {service.addons && service.addons.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 uppercase tracking-wide">
                  إضافات وترقيات خاصة (اختيارية)
                </span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 font-cairo">
                  المستلزمات والخدمات المكملة
                </h3>
              </div>

              <div className="space-y-2.5">
                {service.addons.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <label
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-saudi-gold-500 bg-saudi-gold-50/40 text-gray-900'
                          : 'border-saudi-sand-300 bg-white hover:bg-saudi-sand-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-saudi-green-800 focus:ring-saudi-green-800"
                        />
                        <div>
                          <span className="font-bold text-xs sm:text-sm block">{addon.nameAr}</span>
                          {addon.descriptionAr && (
                            <span className="text-[11px] text-gray-500">{addon.descriptionAr}</span>
                          )}
                        </div>
                      </div>

                      <span className="font-black text-xs sm:text-sm font-cairo text-saudi-green-900 shrink-0">
                        +{formatSaudiRiyal(addon.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vendor Profile Snippet */}
          <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-cairo">
              عن مزود الخدمة المعتمد
            </h3>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <img
                  src={vendor.logo}
                  alt={vendor.businessName}
                  className="w-14 h-14 rounded-2xl object-cover border border-gray-200"
                />
                <div>
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    {vendor.businessName}
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                  </h4>
                  <p className="text-xs text-gray-500">
                    {vendor.cityNameAr} • حي {vendor.neighborhood}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="flex items-center gap-1 font-bold text-saudi-gold-700">
                      <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                      {vendor.rating} ({vendor.reviewsCount} تقييم موثق)
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={`/vendor/${vendor.id}`}
                className="px-4 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <span>زيارة صفحة المورد الكاملة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed pt-2 border-t border-gray-100">
              {vendor.bioAr}
            </p>
          </div>

          {/* Verified Customer Reviews */}
          <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 font-cairo">
                تقييمات العملاء الموثقة (Verified Bookings)
              </h3>
              <div className="flex items-center gap-1 text-sm font-bold text-saudi-gold-700">
                <Star className="w-4 h-4 fill-saudi-gold-500 text-saudi-gold-500" />
                <span>{vendor.rating} / 5</span>
              </div>
            </div>

            <div className="space-y-3">
              {serviceReviews.length === 0 ? (
                <p className="text-xs text-gray-400">لا توجد تقييمات مضافة بعد.</p>
              ) : (
                serviceReviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-saudi-sand-50 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">
                        {rev.customerName} ({rev.occasionTypeAr})
                      </span>
                      <span className="text-[10px] text-gray-400">{rev.date}</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">"{rev.commentAr}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Box & Add to Cart */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-xl space-y-5">
            {/* Live Pricing Breakdown */}
            <div>
              <span className="text-xs text-gray-400 block">
                السعر للباقة المختارة ({selectedPackage.nameAr}):
              </span>
              <span className="text-3xl font-black font-cairo text-saudi-green-950 block mt-1">
                {formatSaudiRiyal(currentTotalPrice)}
              </span>
              <span className="text-[10px] text-gray-400">شامل ضريبة القيمة المضافة 15%</span>
            </div>

            {/* Schedule & Availability check */}
            <div className="space-y-3 border-t border-saudi-sand-200 pt-3">
              <label className="text-xs font-bold text-gray-700 block">تاريخ المناسبة المطلوب:</label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-3 py-2 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-saudi-gold-500"
              />

              {availabilityResult.available ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>المورد متاح للتنفيذ في هذا التاريخ! ⚡</span>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{availabilityResult.reasonAr || 'هذا الموعد غير متاح'}</span>
                </div>
              )}
            </div>

            {/* Deposit Breakdown */}
            <div className="space-y-2 text-xs text-gray-600 border-t border-b border-saudi-sand-200 py-3">
              <div className="flex justify-between">
                <span>عربون تأكيد الحجز (30%):</span>
                <span className="font-bold text-saudi-green-900">
                  {formatSaudiRiyal(Math.round(currentTotalPrice * 0.3))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>المتبقي عند التنفيذ:</span>
                <span className="font-bold text-gray-800">
                  {formatSaudiRiyal(currentTotalPrice - Math.round(currentTotalPrice * 0.3))}
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleAddToCart}
                className="w-full py-4 bg-gradient-to-r from-saudi-green-800 to-saudi-green-950 hover:from-saudi-green-900 hover:to-black text-white font-bold rounded-2xl text-sm shadow-xl shadow-saudi-green-900/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition"
              >
                <ShoppingBag className="w-4 h-4 text-saudi-gold-400" />
                <span>أضف إلى السلة</span>
              </button>

              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Zap className="w-4 h-4" />
                <span>حجز ودفع فوري مباشر</span>
              </button>
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] text-gray-400 block">
                🔒 دفع آمن مع حماية منصة مناسبتي وعقد إلكتروني معتمد
              </span>
              <span className="text-[10px] text-saudi-green-800 font-bold block">
                إلغاء مجاني حتى 5 أيام قبل موعد المناسبة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Payment Modal */}
      {isPaymentModalOpen && (
        <SaudiPaymentModal
          bookingTitle={`${service.titleAr} (${selectedPackage.nameAr})`}
          vendorName={service.vendorName}
          date={bookingDate}
          totalAmount={currentTotalPrice}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentSuccess={(method, isDeposit) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || service.titleAr,
              vendorId: service.vendorId,
              vendorName: service.vendorName,
              vendorLogo: service.vendorLogo,
              serviceId: service.id,
              serviceTitleAr: `${service.titleAr} (${selectedPackage.nameAr})`,
              date: bookingDate,
              cityAr: service.cityNameAr,
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: currentTotalPrice,
              depositAmount: Math.round(currentTotalPrice * 0.3),
              remainingAmount: currentTotalPrice - Math.round(currentTotalPrice * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل موعد المناسبة.',
              deliverablesAr: selectedPackage.featuresAr,
            });
            setIsPaymentModalOpen(false);
            router.push('/bookings');
          }}
        />
      )}
    </div>
  );
}
