'use client';

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
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<SmartPackage>(pkg);

  return (
    <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400 transition-all duration-300 flex flex-col justify-between group">
      {/* Banner with Savings Badge */}
      <div className="relative h-52 w-full bg-gray-100 overflow-hidden">
        <img
          src={currentPackage.image}
          alt={currentPackage.titleAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          <span className="bg-saudi-gold-500 text-saudi-green-950 text-xs font-black px-3 py-1 rounded-full shadow-md">
            {currentPackage.badge}
          </span>
          <span className="bg-saudi-green-900/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-saudi-gold-400/40">
            توفير {formatSAR(currentPackage.savings)} 🔥
          </span>
        </div>

        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
          تكفي {currentPackage.guestCount} شخص
        </div>
      </div>

      {/* Package Details */}
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-saudi-gold-600 bg-saudi-gold-50 px-2 py-0.5 rounded-md border border-saudi-gold-200">
              مناسبة: {currentPackage.occasionTypeNameAr}
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-700">
              <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
              <span>{currentPackage.rating} ({currentPackage.reviewsCount})</span>
            </div>
          </div>

          <h3 className="text-base font-bold text-gray-900 font-cairo">
            {currentPackage.titleAr}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2">
            {currentPackage.subtitleAr}
          </p>

          {/* Included Items Checklist */}
          <div className="space-y-1.5 pt-2 border-t border-saudi-sand-200">
            <span className="text-[11px] font-bold text-gray-700 block">تشمل الباقة:</span>
            {currentPackage.items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-gray-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{item.serviceName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-4 border-t border-saudi-sand-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 line-through">
                {formatSAR(currentPackage.originalPrice)}
              </span>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded">
                خصم {Math.round((currentPackage.savings / currentPackage.originalPrice) * 100)}%
              </span>
            </div>
            <span className="text-xl font-black font-cairo text-saudi-green-950">
              {formatSAR(currentPackage.packagePrice)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="p-2.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-xs font-bold transition flex items-center gap-1"
              title="تخصيص بنود الباقة"
            >
              <Sliders className="w-4 h-4 text-saudi-gold-600" />
              <span className="hidden sm:inline">تخصيص</span>
            </button>

            <button
              onClick={() => {
                if (onBookPackage) onBookPackage(currentPackage);
              }}
              className="px-4 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold shadow-md transition"
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
