'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Star,
  ShieldCheck,
  Zap,
  Clock,
  MapPin,
  Sparkles,
  CheckCircle2,
  ShoppingBag,
  Heart,
  Check,
} from 'lucide-react';
import { ServiceItem } from '@/lib/types';
import { formatSaudiRiyal, ensureServiceDetails } from '@/lib/utils';
import { useApp } from '@/lib/store';
import confetti from 'canvas-confetti';

interface ServiceCardProps {
  service: ServiceItem;
  onBookNow?: (service: ServiceItem) => void;
}

export default function ServiceCard({ service, onBookNow }: ServiceCardProps) {
  const { addToCart, favoriteServiceIds, toggleFavoriteService } = useApp();
  const [isAdded, setIsAdded] = useState(false);

  const isFavorite = favoriteServiceIds.includes(service.id);

  const handleQuickAdd = () => {
    const details = ensureServiceDetails(service);
    const pkg = details.packages[0] || {
      id: 'basic',
      nameAr: 'الباقة الأساسية',
      price: service.price,
      featuresAr: service.featuresAr,
      durationHours: 4,
    };

    addToCart(service, pkg, [], {
      date: '2026-10-09',
      time: '18:00',
      locationCity: service.cityNameAr,
      notes: 'أضيف من بطاقة الخدمة',
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);

    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch {}
  };

  return (
    <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400/80 transition-all duration-300 flex flex-col justify-between group">
      {/* Image Banner */}
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
        <img
          src={service.images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80'}
          alt={service.titleAr}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Favorite toggle button */}
        <button
          onClick={() => toggleFavoriteService(service.id)}
          className={`absolute top-3 left-3 p-2 rounded-xl backdrop-blur-md transition z-10 ${
            isFavorite
              ? 'bg-rose-600 text-white shadow'
              : 'bg-black/40 hover:bg-black/60 text-white'
          }`}
          title="إضافة إلى المفضلة"
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          {service.badge && (
            <span className="bg-saudi-green-900/90 backdrop-blur-md text-saudi-gold-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-saudi-gold-400/30 shadow-sm">
              {service.badge}
            </span>
          )}
          {service.instantBooking && (
            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Zap className="w-3 h-3 fill-current" />
              حجز فوري
            </span>
          )}
        </div>

        {/* City & Gender tag */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
          <MapPin className="w-3 h-3 text-saudi-gold-400" />
          <span>{service.cityNameAr}</span>
          {service.genderPreference && (
            <span className="mr-1 text-gray-300">
              • {service.genderPreference === 'women' ? 'طاقم نسائي' : service.genderPreference === 'men' ? 'طاقم رجالي' : 'عام'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Vendor Row */}
          <div className="flex items-center justify-between">
            <Link
              href={`/vendor/${service.vendorId}`}
              className="flex items-center gap-2 group/vendor hover:opacity-80 transition"
            >
              <img
                src={service.vendorLogo}
                alt={service.vendorName}
                loading="lazy"
                decoding="async"
                className="w-6 h-6 rounded-full object-cover border border-gray-200"
              />
              <span className="text-xs font-bold text-gray-700 group-hover/vendor:text-saudi-green-800 flex items-center gap-1 transition">
                {service.vendorName}
                <ShieldCheck className="w-3.5 h-3.5 text-saudi-green-700 inline" />
              </span>
            </Link>

            <div className="flex items-center gap-1 bg-saudi-gold-50 px-2 py-0.5 rounded-md border border-saudi-gold-200 text-saudi-gold-800 text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
              <span>{service.vendorRating}</span>
            </div>
          </div>

          {/* Title */}
          <Link
            href={`/service/${service.id}`}
            className="text-sm font-bold text-gray-900 hover:text-saudi-gold-700 font-cairo leading-snug line-clamp-2 transition block"
          >
            {service.titleAr}
          </Link>

          {/* Features Highlights */}
          <div className="space-y-1 pt-1">
            {service.featuresAr.slice(0, 2).map((feat, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 shrink-0" />
                <span className="line-clamp-1">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price & Action Buttons */}
        <div className="pt-3 border-t border-saudi-sand-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block">السعر شامل الضريبة</span>
            <span className="text-base font-black font-cairo text-saudi-green-950">
              {formatSaudiRiyal(service.price)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleQuickAdd}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                isAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-saudi-sand-100 hover:bg-saudi-green-100 text-saudi-green-900'
              }`}
              title="أضف للسلة"
            >
              {isAdded ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-saudi-green-900" />
              )}
            </button>

            <Link
              href={`/service/${service.id}`}
              className="px-3 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              التفاصيل
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
