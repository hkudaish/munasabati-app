'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Layers, Sparkles, Filter, Search, CheckCircle2, Store, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store';
import PackageCard from '@/components/marketplace/PackageCard';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';
import CustomerReviewsShowcase from '@/components/common/CustomerReviewsShowcase';
import { SmartPackage } from '@/lib/types';

export default function PackagesPage() {
  const { packages, occasionTypes, createBooking, activeOccasion, currentRole, currentUser } = useApp();

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

      {/* Role-Aware Banner */}
      <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 rounded-2xl p-4 text-white border border-saudi-gold-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-saudi-gold-500/20 border border-saudi-gold-400/40 flex items-center justify-center shrink-0">
            {currentRole === 'client' && <Sparkles className="w-4 h-4 text-saudi-gold-300" />}
            {currentRole === 'vendor' && <Store className="w-4 h-4 text-saudi-gold-300" />}
            {currentRole === 'admin' && <ShieldCheck className="w-4 h-4 text-saudi-gold-300" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-saudi-gold-300">
                {currentRole === 'client' && 'تصفح الباقات بصفتك: صاحب المناسبة (حجز باقة موحدة وتوفير مضمون)'}
                {currentRole === 'vendor' && `تصفح الباقات بصفتك: مورد معتمد (${currentUser?.businessName || currentUser?.name || 'شريكنا'})`}
                {currentRole === 'admin' && 'إدارة الباقات: الإشراف وتوزيع حصص الموردين'}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 font-tajawal">
              {currentRole === 'client' && 'احجز باقة متكاملة بضغطة زر مع ضمان وصول كافة الموردين في موعد الحفل.'}
              {currentRole === 'vendor' && 'يمكنك إدراج خدماتك ضمن الباقات الذكية لمضاعفة مبيعاتك وحجوزاتك التلقائية.'}
              {currentRole === 'admin' && 'متابعة أداء الباقات الذكية، نسب التوفير للمستهلك، وتوزيع أتعاب الموردين.'}
            </p>
          </div>
        </div>

        {currentRole === 'vendor' && (
          <Link
            href="/vendor?tab=packages"
            className="self-end md:self-center px-3.5 py-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0"
          >
            <span>إدراج خدمتي في باقة ذكية</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        )}

        {currentRole === 'admin' && (
          <Link
            href="/admin?tab=packages"
            className="self-end md:self-center px-3.5 py-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0"
          >
            <span>لوحة إدارة الباقات</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        )}
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

      {/* Social proof & customer experiences */}
      <div className="pt-8">
        <CustomerReviewsShowcase limit={3} />
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
