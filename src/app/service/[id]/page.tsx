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
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import { ServiceItem } from '@/lib/types';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { services, vendors, reviews, createBooking, activeOccasion } = useApp();

  const serviceId = params.id as string;
  const service = services.find((s) => s.id === serviceId) || services[0];
  const vendor = vendors.find((v) => v.id === service?.vendorId) || vendors[0];
  const serviceReviews = reviews.filter((r) => r.vendorId === vendor?.id);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (!service) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-xl font-bold">الخدمة غير متوفرة</h2>
        <Link href="/marketplace" className="inline-block px-5 py-2.5 bg-saudi-green-800 text-white rounded-xl text-xs font-bold">
          العودة لسوق الخدمات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Back Link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-saudi-green-800 transition"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة لسوق الخدمات</span>
      </Link>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media & Service Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Gallery */}
          <div className="rounded-3xl overflow-hidden border border-saudi-sand-300 shadow-sm bg-gray-100 h-96 relative">
            <img
              src={service.images[0]}
              alt={service.titleAr}
              className="w-full h-full object-cover"
            />
            {service.badge && (
              <span className="absolute top-4 right-4 bg-saudi-green-900 text-saudi-gold-300 text-xs font-bold px-3 py-1 rounded-full border border-saudi-gold-400/40">
                {service.badge}
              </span>
            )}
          </div>

          {/* Title & Category Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
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

          {/* Features Checklist */}
          <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-cairo">
              ما الذي تشمله هذه الخدمة؟ ✨
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {service.featuresAr.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-saudi-green-700 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor Profile Snippet */}
          <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-cairo">
              عن مزود الخدمة المعتمد
            </h3>
            <div className="flex items-center justify-between gap-4">
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
                  <p className="text-xs text-gray-500">{vendor.cityNameAr} • {vendor.neighborhood}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="flex items-center gap-1 font-bold text-saudi-gold-700">
                      <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                      {vendor.rating} ({vendor.reviewsCount} تقييم موثق)
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-[10px] text-gray-400 block">متوسط سرعة الرد:</span>
                <span className="text-xs font-bold text-saudi-green-900">
                  خلال {vendor.responseTimeMinutes} دقائق ⚡
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed pt-2 border-t border-gray-100">
              {vendor.bioAr}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {vendor.badges.map((b, idx) => (
                <span
                  key={idx}
                  className="bg-saudi-sand-100 text-saudi-green-900 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-saudi-sand-300"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Verified Reviews Section */}
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
                      <span className="font-bold text-gray-900">{rev.customerName} ({rev.occasionTypeAr})</span>
                      <span className="text-[10px] text-gray-400">{rev.date}</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">"{rev.commentAr}"</p>
                    {rev.vendorReplyAr && (
                      <div className="bg-white p-2.5 rounded-xl border border-saudi-sand-300 text-[11px] text-saudi-green-900">
                        <strong className="block mb-0.5">رد المزود:</strong>
                        {rev.vendorReplyAr}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Box & Instant Booking Trigger */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-xl space-y-5">
            <div>
              <span className="text-xs text-gray-400 block">السعر الإجمالي شامل ضريبة 15%:</span>
              <span className="text-3xl font-black font-cairo text-saudi-green-950 block mt-1">
                {formatSAR(service.price)}
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-600 border-t border-b border-saudi-sand-200 py-3">
              <div className="flex justify-between">
                <span>عربون تأكيد الحجز (30%):</span>
                <span className="font-bold text-saudi-green-900">{formatSAR(Math.round(service.price * 0.3))}</span>
              </div>
              <div className="flex justify-between">
                <span>المتبقي عند التنفيذ:</span>
                <span className="font-bold text-gray-800">{formatSAR(service.price - Math.round(service.price * 0.3))}</span>
              </div>
              <div className="flex justify-between text-[11px] text-green-700 pt-1">
                <span>سياسة الإلغاء:</span>
                <span>إلغاء مجاني حتى 5 أيام قبل الحفل</span>
              </div>
            </div>

            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full py-4 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-sm shadow-lg shadow-saudi-green-900/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition"
            >
              <Zap className="w-4 h-4 text-saudi-gold-300" />
              <span>حجز ودفع العربون الآن</span>
            </button>

            <div className="text-center">
              <span className="text-[10px] text-gray-400 block">
                🔒 دفع آمن مع حماية منصة مناسبتي وعقد إلكتروني معتمد
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <SaudiPaymentModal
          bookingTitle={service.titleAr}
          vendorName={service.vendorName}
          date="2026-11-20"
          totalAmount={service.price}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentSuccess={(method, isDeposit, ref) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || service.titleAr,
              vendorId: service.vendorId,
              vendorName: service.vendorName,
              vendorLogo: service.vendorLogo,
              serviceId: service.id,
              serviceTitleAr: service.titleAr,
              date: '2026-11-20',
              cityAr: service.cityNameAr,
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: service.price,
              depositAmount: Math.round(service.price * 0.3),
              remainingAmount: service.price - Math.round(service.price * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل موعد المناسبة.',
              deliverablesAr: service.featuresAr,
            });
          }}
        />
      )}
    </div>
  );
}
