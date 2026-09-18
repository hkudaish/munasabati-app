'use client';

import React, { useState } from 'react';
import {
  Star,
  ShieldCheck,
  MapPin,
  Sparkles,
  Calendar,
  CheckCircle2,
  Quote,
  MessageSquare,
  ThumbsUp,
  Heart,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { Review } from '@/lib/types';

interface CustomerReviewsShowcaseProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  featuredOnly?: boolean;
  showFilters?: boolean;
}

export default function CustomerReviewsShowcase({
  title = 'تجارب وآراء عملائنا الراضين في المملكة 🇸🇦',
  subtitle = 'قصص نجاح واقعية وتقييمات موثقة لمناسبات لا تُنسى في الرياض، جدة، الشرقية، والجنوب',
  limit,
  featuredOnly = false,
  showFilters = true,
}: CustomerReviewsShowcaseProps) {
  const { reviews, vendors } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Filter approved reviews
  let displayedReviews = reviews.filter((r) => (r.status ? r.status === 'approved' : true));

  if (featuredOnly) {
    displayedReviews = displayedReviews.filter((r) => r.featured);
  }

  if (selectedCategory !== 'all') {
    displayedReviews = displayedReviews.filter((r) =>
      r.occasionTypeAr.toLowerCase().includes(selectedCategory.toLowerCase())
    );
  }

  if (selectedCity !== 'all') {
    displayedReviews = displayedReviews.filter((r) =>
      r.customerCityAr.toLowerCase().includes(selectedCity.toLowerCase())
    );
  }

  if (limit) {
    displayedReviews = displayedReviews.slice(0, limit);
  }

  // Calculate stats
  const totalReviewsCount = reviews.length;
  const avgRating = (
    reviews.reduce((acc, r) => acc + r.rating, 0) / (totalReviewsCount || 1)
  ).toFixed(2);

  const categoriesList = [
    { id: 'all', label: 'كافة المناسبات' },
    { id: 'زواج', label: '💍 أعراس وزفاف' },
    { id: 'ملكة', label: '✨ ملكة وعقد قران' },
    { id: 'تخرج', label: '🎓 حفلات تخرج' },
    { id: 'مولود', label: '👶 استقبال مولود' },
    { id: 'التأسيس', label: '🇸🇦 اليوم الوطني والتأسيس' },
  ];

  const citiesList = [
    { id: 'all', label: 'كافة المدن' },
    { id: 'الرياض', label: 'الرياض' },
    { id: 'جدة', label: 'جدة' },
    { id: 'الخبر', label: 'الخبر والدمام' },
    { id: 'أبها', label: 'أبها والجنوب' },
    { id: 'المدينة', label: 'المدينة المنورة' },
  ];

  return (
    <section className="space-y-8 animate-fadeIn">
      {/* Header & Overall Trust Banner */}
      <div className="bg-gradient-to-br from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 rounded-3xl p-6 sm:p-10 text-white border border-saudi-gold-500/20 shadow-xl relative overflow-hidden">
        {/* Background ambient elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-saudi-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-saudi-green-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-500/30 text-saudi-gold-300 px-3.5 py-1 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تقييمات موثقة بسجلات الدفع وعقود ZATCA</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-cairo text-white leading-snug">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 font-tajawal leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Social Proof Metric Cards */}
          <div className="flex flex-wrap items-center gap-4 bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15">
            <div className="text-center px-3 border-l border-white/15">
              <div className="flex items-center justify-center gap-1 text-saudi-gold-400">
                <Star className="w-5 h-5 fill-saudi-gold-400" />
                <span className="text-3xl font-black font-cairo text-white">{avgRating}</span>
              </div>
              <span className="text-[11px] text-gray-300 block mt-0.5">من 5.0 نقاط</span>
            </div>

            <div className="text-center px-3 border-l border-white/15">
              <span className="text-2xl font-black font-cairo text-saudi-gold-300 block">
                99.4%
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5">نسبة رضا العملاء</span>
            </div>

            <div className="text-center px-3">
              <span className="text-2xl font-black font-cairo text-white block">
                +4,200
              </span>
              <span className="text-[11px] text-gray-300 block mt-0.5">مناسبة ناجحة 🇸🇦</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs if enabled */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-saudi-sand-200 pb-4">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-saudi-green-800 text-white shadow-sm'
                    : 'bg-saudi-sand-100 text-gray-700 hover:bg-saudi-sand-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <MapPin className="w-4 h-4 text-saudi-gold-600" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-white border border-saudi-sand-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-saudi-gold-500"
            >
              {citiesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedReviews.map((rev) => {
          const matchedVendor = vendors.find((v) => v.id === rev.vendorId);

          return (
            <div
              key={rev.id}
              className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm hover:shadow-md hover:border-saudi-gold-400 transition flex flex-col justify-between space-y-4 group relative"
            >
              <div className="space-y-3">
                {/* Header: Customer Info & Rating */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        rev.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          rev.customerName
                        )}&background=004D3F&color=FAF6EB&bold=true`
                      }
                      alt={rev.customerName}
                      className="w-12 h-12 rounded-2xl object-cover border border-saudi-sand-200 shadow-sm"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-saudi-green-950 font-cairo">
                        {rev.customerName}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="w-3 h-3 text-saudi-gold-600" />
                        <span>{rev.customerCityAr}</span>
                        <span>•</span>
                        <span className="text-saudi-green-800 font-semibold">
                          {rev.occasionTypeAr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Badge */}
                  <div className="bg-saudi-gold-50 border border-saudi-gold-200 px-2.5 py-1 rounded-xl flex items-center gap-1 text-xs font-bold text-saudi-gold-800">
                    <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                    <span>{rev.rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* Verified Badge */}
                {rev.isVerifiedBooking && (
                  <div className="inline-flex items-center gap-1.5 bg-saudi-green-50 border border-saudi-green-200 text-saudi-green-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-saudi-green-700" />
                    <span>حجز ودفع موثوق عبر مناسبتـي 🇸🇦</span>
                  </div>
                )}

                {/* Comment */}
                <p className="text-xs text-gray-700 leading-relaxed font-tajawal bg-saudi-sand-50/70 p-3.5 rounded-2xl border border-saudi-sand-200/60 relative">
                  <Quote className="w-4 h-4 text-saudi-gold-400 absolute top-2 left-2 opacity-40 rotate-180" />
                  "{rev.commentAr}"
                </p>

                {/* 4 Criteria Micro-Ratings */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 pt-1">
                  <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-lg">
                    <span>جودة الخدمة:</span>
                    <strong className="text-saudi-green-900 font-mono">★ {rev.qualityRating}</strong>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-lg">
                    <span>الالتزام بالمواعيد:</span>
                    <strong className="text-saudi-green-900 font-mono">★ {rev.punctualityRating}</strong>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-lg">
                    <span>التعامل والضيافة:</span>
                    <strong className="text-saudi-green-900 font-mono">★ {rev.communicationRating}</strong>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-lg">
                    <span>القيمة مقابل السعر:</span>
                    <strong className="text-saudi-green-900 font-mono">★ {rev.valueRating}</strong>
                  </div>
                </div>

                {/* Vendor Reply if present */}
                {rev.vendorReplyAr && (
                  <div className="bg-saudi-green-50/80 p-3 rounded-xl border border-saudi-green-200 text-[11px] text-saudi-green-950 space-y-1">
                    <span className="font-bold flex items-center gap-1 text-saudi-green-900">
                      <MessageSquare className="w-3 h-3 text-saudi-gold-600" />
                      رد المزود ({rev.vendorName}):
                    </span>
                    <p className="text-gray-600 leading-normal italic">"{rev.vendorReplyAr}"</p>
                  </div>
                )}
              </div>

              {/* Card Footer: Vendor Tag & Date */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs">
                <Link
                  href={matchedVendor ? `/vendor/${matchedVendor.id}` : `/marketplace`}
                  className="font-bold text-saudi-green-800 hover:text-saudi-green-950 transition flex items-center gap-1.5"
                >
                  <span className="text-[11px] text-gray-400">المزود:</span>
                  <span className="underline decoration-saudi-gold-400 underline-offset-2">
                    {rev.vendorName}
                  </span>
                </Link>

                <span className="text-[10px] text-gray-400 font-mono">{rev.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
