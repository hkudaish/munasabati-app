'use client';

import React from 'react';
import Link from 'next/link';
import { Star, ShieldCheck, Zap, Clock, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';
import { ServiceItem } from '@/lib/types';
import { formatSAR } from '@/lib/utils';

interface ServiceCardProps {
  service: ServiceItem;
  onBookNow?: (service: ServiceItem) => void;
}

export default function ServiceCard({ service, onBookNow }: ServiceCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400/80 transition-all duration-300 flex flex-col justify-between group">
      {/* Image Banner */}
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
        <img
          src={service.images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80'}
          alt={service.titleAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

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
            <div className="flex items-center gap-2">
              <img
                src={service.vendorLogo}
                alt={service.vendorName}
                className="w-6 h-6 rounded-full object-cover border border-gray-200"
              />
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                {service.vendorName}
                <ShieldCheck className="w-3.5 h-3.5 text-saudi-green-700 inline" />
              </span>
            </div>

            <div className="flex items-center gap-1 bg-saudi-gold-50 px-2 py-0.5 rounded-md border border-saudi-gold-200 text-saudi-gold-800 text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
              <span>{service.vendorRating}</span>
            </div>
          </div>

          {/* Title */}
          <h4 className="text-sm font-bold text-gray-900 font-cairo leading-snug line-clamp-2">
            {service.titleAr}
          </h4>

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

        {/* Price & Book Button */}
        <div className="pt-3 border-t border-saudi-sand-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block">السعر شامل الضريبة</span>
            <span className="text-base font-black font-cairo text-saudi-green-950">
              {formatSAR(service.price)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/service/${service.id}`}
              className="px-3 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-xs font-bold transition"
            >
              التفاصيل
            </Link>
            {onBookNow && (
              <button
                onClick={() => onBookNow(service)}
                className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                احجز الآن
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
