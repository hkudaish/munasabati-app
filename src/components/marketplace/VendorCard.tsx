'use client';

import React from 'react';
import Link from 'next/link';
import {
  Star,
  ShieldCheck,
  MapPin,
  Clock,
  Award,
  Heart,
  ArrowLeftRight,
  ShoppingBag,
  Sparkles,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Vendor, ServiceItem } from '@/lib/types';
import { formatSaudiRiyal, ensureVendorDetails } from '@/lib/utils';
import { useApp } from '@/lib/store';

interface VendorCardProps {
  vendor: Vendor;
  primaryService?: ServiceItem;
  viewMode?: 'grid' | 'list';
}

export default function VendorCard({ vendor: rawVendor, primaryService, viewMode = 'grid' }: VendorCardProps) {
  const {
    favoriteVendorIds,
    toggleFavoriteVendor,
    comparisonVendorIds,
    addToComparison,
    removeFromComparison,
    setIsAIOpen,
  } = useApp();

  const vendor = ensureVendorDetails(rawVendor);
  const isFavorite = favoriteVendorIds.includes(vendor.id);
  const isCompared = comparisonVendorIds.includes(vendor.id);

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-3xl border border-saudi-sand-300 p-5 shadow-sm hover:shadow-md hover:border-saudi-gold-400 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group">
        <div className="flex items-start sm:items-center gap-4 flex-1">
          <div className="relative">
            <img
              src={vendor.logo}
              alt={vendor.businessName}
              loading="lazy"
              decoding="async"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-gray-100 shadow-sm shrink-0"
            />
            {vendor.verified && (
              <span className="absolute -bottom-1 -right-1 bg-saudi-green-800 text-white p-1 rounded-full border-2 border-white shadow">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/vendor/${vendor.id}`}
                className="font-bold text-base font-cairo text-saudi-green-950 hover:text-saudi-gold-700 transition"
              >
                {vendor.businessName}
              </Link>
              <span className="bg-saudi-sand-100 text-saudi-green-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {vendor.categoryNameAr}
              </span>
              {vendor.featured && (
                <span className="bg-saudi-gold-100 text-saudi-gold-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-300">
                  مميز ✨
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 line-clamp-1 font-tajawal max-w-xl">
              {vendor.bioAr}
            </p>

            <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap pt-0.5">
              <span className="flex items-center gap-1 text-saudi-gold-700 font-bold">
                <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                <span>{vendor.rating}</span>
                <span className="text-gray-400 font-normal">({vendor.reviewsCount} تقييم)</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-saudi-green-700" />
                <span>{vendor.cityNameAr}</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-saudi-green-700" />
                <span>يرد خلال {vendor.responseTimeMinutes} دقيقة</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <Award className="w-3.5 h-3.5" />
                <span>{vendor.completedBookingsCount}+ مناسبة</span>
              </span>
            </div>
          </div>
        </div>

        {/* Pricing & Actions */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full md:w-auto gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
          <div className="text-left">
            <span className="text-[10px] text-gray-400 block">يبدأ من</span>
            <span className="text-base sm:text-lg font-black font-cairo text-saudi-green-950 block">
              {formatSaudiRiyal(primaryService?.price || 1500)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavoriteVendor(vendor.id)}
              className={`p-2 rounded-xl border transition ${
                isFavorite
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-saudi-sand-300 hover:bg-saudi-sand-50 text-gray-400'
              }`}
              title="المفضلة"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => {
                if (isCompared) removeFromComparison(vendor.id);
                else addToComparison(vendor.id);
              }}
              className={`p-2 rounded-xl border transition ${
                isCompared
                  ? 'border-saudi-gold-400 bg-saudi-gold-50 text-saudi-green-950 font-bold'
                  : 'border-saudi-sand-300 hover:bg-saudi-sand-50 text-gray-600'
              }`}
              title="مقارنة المورد"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <Link
              href={`/vendor/${vendor.id}`}
              className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              عرض الملف والخدمات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400/80 transition-all duration-300 flex flex-col justify-between group">
      {/* Cover Banner with Avatar Overlay */}
      <div className="relative h-40 w-full bg-saudi-green-950 overflow-hidden">
        <img
          src={vendor.bannerImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80'}
          alt={vendor.businessName}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Favorite & Compare Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <button
            onClick={() => toggleFavoriteVendor(vendor.id)}
            className={`p-2 rounded-xl backdrop-blur-md transition ${
              isFavorite
                ? 'bg-rose-600 text-white shadow'
                : 'bg-black/40 hover:bg-black/60 text-white'
            }`}
            title="المفضلة"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => {
              if (isCompared) removeFromComparison(vendor.id);
              else addToComparison(vendor.id);
            }}
            className={`p-2 rounded-xl backdrop-blur-md transition ${
              isCompared
                ? 'bg-saudi-gold-500 text-saudi-green-950 font-bold shadow'
                : 'bg-black/40 hover:bg-black/60 text-white'
            }`}
            title="مقارنة"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category & Verified tag */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          {vendor.verified && (
            <span className="bg-saudi-green-900/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-saudi-gold-400/30 flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-saudi-gold-400" />
              <span>موثق رسمياً</span>
            </span>
          )}
          {vendor.featured && (
            <span className="bg-saudi-gold-500 text-saudi-green-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              مورد مختار ✨
            </span>
          )}
        </div>

        {/* City Indicator */}
        <div className="absolute bottom-2.5 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
          <MapPin className="w-3 h-3 text-saudi-gold-400" />
          <span>{vendor.cityNameAr}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Logo & Business Name */}
          <div className="flex items-center gap-3 -mt-9 relative z-10">
            <img
              src={vendor.logo}
              alt={vendor.businessName}
              loading="lazy"
              decoding="async"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md bg-white shrink-0"
            />
            <div className="mt-4">
              <Link
                href={`/vendor/${vendor.id}`}
                className="font-bold text-sm text-saudi-green-950 hover:text-saudi-gold-700 transition block font-cairo line-clamp-1"
              >
                {vendor.businessName}
              </Link>
              <span className="text-[11px] text-gray-500 font-medium">
                {vendor.categoryNameAr}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed font-tajawal pt-1">
            {vendor.bioAr}
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex items-center justify-between text-xs bg-saudi-sand-50 p-2.5 rounded-xl text-gray-700">
            <div className="flex items-center gap-1 text-saudi-gold-700 font-bold">
              <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
              <span>{vendor.rating}</span>
              <span className="text-gray-400 text-[10px] font-normal">({vendor.reviewsCount})</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 text-gray-600 text-[11px]">
              <Clock className="w-3 h-3 text-saudi-green-700" />
              <span>خلال {vendor.responseTimeMinutes} د</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="text-[11px] font-bold text-emerald-700">
              {vendor.completedBookingsCount}+ حجز
            </div>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-3 border-t border-saudi-sand-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block">يبدأ من</span>
            <span className="text-base font-black font-cairo text-saudi-green-950">
              {formatSaudiRiyal(primaryService?.price || 1500)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsAIOpen(true)}
              className="p-2 rounded-xl bg-saudi-gold-50 hover:bg-saudi-gold-100 text-saudi-green-950 text-xs font-bold border border-saudi-gold-300 transition"
              title="اسأل لُـمى"
            >
              <Sparkles className="w-3.5 h-3.5 text-saudi-gold-600" />
            </button>

            <Link
              href={`/vendor/${vendor.id}`}
              className="px-3.5 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              عرض المورد
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
