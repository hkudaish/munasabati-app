'use client';

import { useGeo } from '@/components/geo/GeoProvider';
import React, { useState } from 'react';
import { Layers, Sparkles, CheckCircle2, Star, ArrowLeft, Sliders } from 'lucide-react';
import { SmartPackage } from '@/lib/types';
import { formatSAR } from '@/lib/utils';
import PackageCustomizerModal from './PackageCustomizerModal';

interface PackageCardProps {
  pkg: SmartPackage;
  onBookPackage?: (pkg: SmartPackage) => void;
}

export default function PackageCard({ pkg, onBookPackage }: PackageCardProps) {
  const geo=useGeo();
  const allowed=!!geo.data?.availability.find(a=>a.key==='feature:packages')?.available;
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<SmartPackage>(pkg);

  if(geo.data?.summary!=='UNKNOWN'&&!allowed&&geo.data?.snapshot.policy.hideUnavailable)return null;
  return (
    <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400 transition duration-300 flex flex-col justify-between group">
      {/* Banner with Savings Badge */}
      <div className="relative h-52 w-full bg-gray-100 overflow-hidden">
        <img
          src={currentPackage.image}
          alt={currentPackage.titleAr}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          <span className="bg-saudi-gold-500 text-saudi-green-950 text-xs font-bold px-3 py-1 rounded-full shadow-md">
            {currentPackage.badge}
          </span>
          <span className="bg-saudi-green-900/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-saudi-gold-400/40">
            توفير {formatSAR(currentPackage.savings)} 🔥
          </span>
        </div>

        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          تكفي {currentPackage.guestCount} شخص
        </div>
      </div>

      {/* Package Details */}
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-saudi-gold-600 bg-saudi-gold-50 px-2 py-0.5 rounded-md border border-saudi-gold-200">
              مناسبة: {currentPackage.occasionTypeNameAr}
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-700">
              <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
              <span>{currentPackage.rating} ({currentPackage.reviewsCount})</span>
            </div>
          </div>

          <h3 className="text-base font-bold leading-8 text-saudi-green-950 font-cairo">
            {currentPackage.titleAr}
          </h3>
          <p className="text-sm leading-6 text-slate-600 line-clamp-2">
            {currentPackage.subtitleAr}
          </p>

          {/* Included Items Checklist */}
          <div className="space-y-2.5 rounded-xl bg-saudi-sand-50 p-3">
            <span className="text-xs font-bold text-gray-700 block">تشمل الباقة · {currentPackage.items.length} خدمات</span>
            {currentPackage.items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-gray-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-5">{item.serviceName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-4 border-t border-saudi-sand-200 space-y-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 line-through whitespace-nowrap">
                {formatSAR(currentPackage.originalPrice)}
              </span>
              <span className="text-xs font-bold text-saudi-green-800 bg-saudi-green-50 px-2 py-1 rounded-lg">
                خصم {currentPackage.originalPrice > 0 ? Math.max(0, Math.round(((currentPackage.originalPrice - currentPackage.packagePrice) / currentPackage.originalPrice) * 100)) : 0}%
              </span>
            </div>
            <span className="mt-1 block whitespace-nowrap text-2xl font-black font-cairo text-saudi-green-950">
              {formatSAR(currentPackage.packagePrice)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button disabled={!allowed||!!geo.data?.preview}
              onClick={() => setIsCustomizerOpen(true)}
              className="p-3 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              title="تخصيص بنود الباقة"
            >
              <Sliders className="w-4 h-4 text-saudi-gold-600" />
              <span>تخصيص</span>
            </button>

            <button disabled={!allowed||!!geo.data?.preview}
              onClick={() => {
                if (onBookPackage) onBookPackage(currentPackage);
              }}
              className="flex-1 px-4 py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
            >
              حجز الباقة
            </button>
          </div>
        </div>
      </div>

      {/* Package Customizer Modal */}
      {isCustomizerOpen && (
        <PackageCustomizerModal
          pkg={currentPackage}
          onClose={() => setIsCustomizerOpen(false)}
          onSaveCustomization={(updatedPkg) => {
            setCurrentPackage(updatedPkg);
            setIsCustomizerOpen(false);
          }}
          onBookNow={(updatedPkg) => {
            setIsCustomizerOpen(false);
            if (onBookPackage) onBookPackage(updatedPkg);
          }}
        />
      )}
    </div>
  );
}
