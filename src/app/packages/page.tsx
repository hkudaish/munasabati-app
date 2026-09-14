'use client';

import React, { useState } from 'react';
import { Layers, Sparkles, Filter, Search, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import PackageCard from '@/components/marketplace/PackageCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import { SmartPackage } from '@/lib/types';

export default function PackagesPage() {
  const { packages, occasionTypes, createBooking, activeOccasion } = useApp();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [bookingModalPkg, setBookingModalPkg] = useState<SmartPackage | null>(null);

  const filteredPackages = packages.filter((pkg) => {
    return selectedType === 'all' || pkg.occasionTypeId === selectedType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
          <Layers className="w-4 h-4" />
          <span>باقات مناسبات متكاملة مع توفير حقيقي</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
          الباقات الذكية الجاهزة 📦
        </h1>
        <p className="text-xs text-gray-500 max-w-2xl font-tajawal">
          وفر وقت البحث والتنسيق مع موردين متعددين؛ اختر باقة جاهزة تشمل الكوشة، الضيافة، التصوير، والتوزيعات، مع إمكانية تخصيص وتعديل أي بند.
        </p>
      </div>

      {/* Occasion Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
            selectedType === 'all'
              ? 'bg-saudi-green-800 text-white shadow-md'
              : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
          }`}
        >
          كافة الباقات ({packages.length})
        </button>

        {occasionTypes.slice(0, 6).map((occ) => (
          <button
            key={occ.id}
            onClick={() => setSelectedType(occ.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedType === occ.id
                ? 'bg-saudi-green-800 text-white shadow-md'
                : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
            }`}
          >
            {occ.nameAr}
          </button>
        ))}
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPackages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            onBookPackage={(selectedPkg) => setBookingModalPkg(selectedPkg)}
          />
        ))}
      </div>

      {/* Payment Modal */}
      {bookingModalPkg && (
        <SaudiPaymentModal
          bookingTitle={bookingModalPkg.titleAr}
          vendorName="باقة مناسبتي المتكاملة"
          date="2026-11-20"
          totalAmount={bookingModalPkg.packagePrice}
          onClose={() => setBookingModalPkg(null)}
          onPaymentSuccess={(method, isDeposit, ref) => {
            createBooking({
              occasionId: activeOccasion?.id,
              occasionTitle: activeOccasion?.title || bookingModalPkg.titleAr,
              vendorId: 'vendor-package',
              vendorName: 'باقة مناسبتي المتكاملة',
              vendorLogo: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=300&auto=format&fit=crop&q=80',
              packageId: bookingModalPkg.id,
              serviceTitleAr: bookingModalPkg.titleAr,
              date: '2026-11-20',
              cityAr: 'الرياض',
              customerName: 'سارة العتيبي',
              customerPhone: '+966501234567',
              totalAmount: bookingModalPkg.packagePrice,
              depositAmount: Math.round(bookingModalPkg.packagePrice * 0.3),
              remainingAmount: bookingModalPkg.packagePrice - Math.round(bookingModalPkg.packagePrice * 0.3),
              depositPaid: isDeposit,
              isFullyPaid: !isDeposit,
              paymentMethod: method,
              status: 'confirmed',
              cancellationPolicyAr: 'إلغاء مجاني حتى 7 أيام قبل موعد المناسبة.',
              deliverablesAr: bookingModalPkg.items.filter((i) => i.included).map((i) => i.serviceName),
            });
          }}
        />
      )}
    </div>
  );
}
