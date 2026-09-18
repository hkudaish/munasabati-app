'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal } from '@/lib/utils';
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
  ExternalLink
} from 'lucide-react';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';

export default function VendorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { vendors, services, reviews, createBooking } = useApp();

  const vendorId = params?.id as string;
  const vendor = vendors.find((v) => v.id === vendorId) || vendors[0];

  const vendorServices = services.filter((s) => s.vendorId === vendor?.id);
  const vendorReviews = reviews.filter((r) => r.vendorId === vendor?.id);

  // Active tab
  const [activeTab, setActiveTab] = useState<'services' | 'portfolio' | 'reviews' | 'about'>('services');
  const [selectedServiceToBook, setSelectedServiceToBook] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">لم يتم العثور على المورد المطلوب</h2>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
          >
            العودة إلى سوق الموردين
          </Link>
        </div>
      </div>
    );
  }

  // Calculate rating breakdown averages
  const totalReviewsCount = vendorReviews.length || 1;
  const avgQuality = (vendorReviews.reduce((acc, r) => acc + (r.qualityRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgPunctuality = (vendorReviews.reduce((acc, r) => acc + (r.punctualityRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgCommunication = (vendorReviews.reduce((acc, r) => acc + (r.communicationRating || 5), 0) / totalReviewsCount).toFixed(1);
  const avgValue = (vendorReviews.reduce((acc, r) => acc + (r.valueRating || 5), 0) / totalReviewsCount).toFixed(1);

  const handleBookService = (service: any) => {
    setSelectedServiceToBook(service);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-neutral-950 pb-16">
      {/* Top Banner & Cover Image */}
      <div className="relative h-64 sm:h-80 w-full bg-neutral-900 overflow-hidden">
        <img
          src={vendor.bannerImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&auto=format&fit=crop&q=80'}
          alt={vendor.businessName}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20 space-y-8">
        {/* Vendor Header Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200 dark:border-neutral-800 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              <img
                src={vendor.logo}
                alt={vendor.businessName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white dark:border-neutral-800 shadow-md shrink-0 bg-neutral-100"
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
                    {vendor.businessName}
                  </h1>
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      موثق رسمياً
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                  {vendor.categoryNameAr} | {vendor.cityNameAr} - حي {vendor.neighborhood}
                </p>

                {/* Rating & Response Metrics */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-1 text-amber-500 font-bold font-mono">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{vendor.rating}</span>
                    <span className="text-neutral-400 font-normal">
                      ({vendor.reviewsCount || vendorReviews.length} تقييم)
                    </span>
                  </div>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>يرد خلال {vendor.responseTimeMinutes || 15} دقيقة</span>
                  </div>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>أنجز {vendor.completedBookingsCount || 45}+ مناسبة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
              <Link
                href={`/rfq?vendorId=${vendor.id}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all text-center"
              >
                <Sparkles className="w-4 h-4" />
                طلب عرض سعر مخصص (RFQ)
              </Link>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={`https://wa.me/${vendor.whatsappNumber?.replace('+', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  <MessageCircle className="w-4 h-4" />
                  محادثة واتساب
                </a>
                <a
                  href={`tel:${vendor.contactPhone}`}
                  className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 transition-colors"
                  title="اتصال هاتفي"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Badges / Verification Row */}
          <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-3">
            {vendor.crNumber && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-mono">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                سجل تجاري: {vendor.crNumber}
              </span>
            )}
            {vendor.freelanceLicense && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                وثيقة عمل حر معتمدة
              </span>
            )}
            {vendor.badges?.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200/60 dark:border-amber-900/60"
              >
                ✨ {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 text-sm font-bold overflow-x-auto pb-1">
          {[
            { id: 'services', label: `الخدمات والأسعار (${vendorServices.length})` },
            { id: 'portfolio', label: `معرض الأعمال (${vendor.portfolio?.length || 4})` },
            { id: 'reviews', label: `التقييمات والآراء (${vendorReviews.length || vendor.reviewsCount})` },
            { id: 'about', label: 'عن المزود والسياسات' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-5 border-b-2 font-bold shrink-0 transition-all ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Services List */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendorServices.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                  <p className="text-neutral-500">لا توجد خدمات منفصلة مسجلة حالياً لهذا المورد.</p>
                </div>
              ) : (
                vendorServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <img
                          src={service.images[0]}
                          alt={service.titleAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {service.badge && (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-sm">
                            {service.badge}
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-3">
                        <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                          {service.titleAr}
                        </h3>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                          {service.descriptionAr}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {service.featuresAr?.slice(0, 3).map((feat, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                            >
                              ✓ {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-neutral-100 dark:border-neutral-800/60 mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">السعر</span>
                        <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                          {formatSaudiRiyal(service.price)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleBookService(service)}
                        className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        حجز الخدمة
                      </button>
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
                  className="group relative h-64 rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm cursor-pointer"
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

        {/* Tab 3: Reviews & Ratings Breakdown */}
        {activeTab === 'reviews' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Metric Breakdown Matrix */}
            <div className="lg:col-span-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                ملخص التقييمات المعتمدة
              </h3>

              <div className="text-center py-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <span className="text-4xl font-black font-mono text-amber-500 block">
                  {vendor.rating}
                </span>
                <div className="flex justify-center my-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs text-neutral-500">
                  بناءً على {vendorReviews.length || vendor.reviewsCount} تقييم حقيقي
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>جودة الخدمة والتنفيذ</span>
                    <span className="font-mono text-emerald-600">{avgQuality} / 5</span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(Number(avgQuality) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>الالتزام بالمواعيد</span>
                    <span className="font-mono text-emerald-600">{avgPunctuality} / 5</span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(Number(avgPunctuality) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>حسن التعامل والتواصل</span>
                    <span className="font-mono text-emerald-600">{avgCommunication} / 5</span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(Number(avgCommunication) / 5) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>القيمة مقابل السعر</span>
                    <span className="font-mono text-emerald-600">{avgValue} / 5</span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(Number(avgValue) / 5) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Customer Reviews List */}
            <div className="lg:col-span-8 space-y-4">
              {vendorReviews.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                  <p className="text-neutral-500 text-sm">
                    لا توجد تقييمات مكتوبة مسجلة حالياً لهذا المورد.
                  </p>
                </div>
              ) : (
                vendorReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                          {review.customerName}
                        </h4>
                        <p className="text-xs text-neutral-400">
                          {review.occasionTypeAr} • {review.customerCityAr} • {review.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 font-mono font-bold text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{review.rating}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      "{review.commentAr}"
                    </p>

                    {review.vendorReplyAr && (
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-400">
                        <strong className="text-emerald-600 block mb-1">رد المورد:</strong>
                        {review.vendorReplyAr}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: About & Policies */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                نبذة عن المنشأة والخبرة
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {vendor.bioAr ||
                  'نحن فريق سعودي متخصص وشغوف بتقديم أرقى الخدمات الاحتفالية بأعلى المعايير، مع الالتزام التام بالمواعيد والجودة لضمان نجاح مناسبتكم وليلة لا تُنسى.'}
              </p>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">مقر الخدمة الرئيسي:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">{vendor.cityNameAr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">مناطق التغطية:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {vendor.serviceAreas?.join('، ') || vendor.cityNameAr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">التخصص:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {vendor.genderSpecialty === 'men_specialist'
                      ? 'متخصص في مناسبات الرجال'
                      : vendor.genderSpecialty === 'women_specialist'
                      ? 'متخصص في مناسبات النساء'
                      : 'مناسبات الرجال والنساء والعائلات'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                سياسة الحجز والإلغاء
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {vendor.cancellationPolicyAr ||
                  'استرجاع كامل العربون في حال الإلغاء قبل موعد المناسبة بـ 14 يوماً. استرجاع 50% من العربون في حال الإلغاء قبل 7 أيام.'}
              </p>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  جميع الحجوزات والمدفوعات محمية بضمان منصة مناسبتـي ولا يتم تحويل المستحقات للمورد إلا بعد تأكيد تنفيذ الخدمة بنجاح.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Booking Payment Modal */}
      {selectedServiceToBook && (
        <SaudiPaymentModal
          bookingTitle={selectedServiceToBook.titleAr}
          vendorName={vendor.businessName}
          date={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          totalAmount={selectedServiceToBook.price}
          depositAmount={Math.round(selectedServiceToBook.price * 0.3)}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedServiceToBook(null);
          }}
          onPaymentSuccess={(method, isDeposit, ref) => {
            createBooking({
              occasionTitle: `مناسبة في ${vendor.cityNameAr}`,
              vendorId: vendor.id,
              vendorName: vendor.businessName,
              vendorLogo: vendor.logo,
              serviceId: selectedServiceToBook.id,
              serviceTitleAr: selectedServiceToBook.titleAr,
              date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              cityAr: vendor.cityNameAr,
              customerName: 'صاحب المناسبة',
              customerPhone: '+966501234567',
              totalAmount: selectedServiceToBook.price,
              depositAmount: Math.round(selectedServiceToBook.price * 0.3),
              remainingAmount: isDeposit ? Math.round(selectedServiceToBook.price * 0.7) : 0,
              depositPaid: true,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: vendor.cancellationPolicyAr,
              deliverablesAr: selectedServiceToBook.featuresAr || [],
            });
            setIsPaymentModalOpen(false);
            setSelectedServiceToBook(null);
            router.push('/bookings');
          }}
        />
      )}
    </div>
  );
}
