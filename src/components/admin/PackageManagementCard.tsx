'use client';

import { Check, Pencil, Users } from 'lucide-react';
import type { SmartPackage } from '@/lib/types';
import { formatSAR } from '@/lib/utils';

export default function PackageManagementCard({ pkg, onEditPrice }: {
  pkg: SmartPackage;
  onEditPrice: () => void;
}) {
  const savings = Math.max(0, pkg.originalPrice - pkg.packagePrice);
  const discount = pkg.originalPrice > 0 ? Math.round(savings / pkg.originalPrice * 100) : 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-saudi-sand-200 bg-white shadow-sm transition-shadow hover:shadow-card" data-package-card={pkg.id}>
      <div className="border-b border-saudi-sand-200 bg-saudi-sand-50 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-saudi-gold-200 bg-white px-3 py-1 text-xs font-bold text-saudi-gold-800">{pkg.occasionTypeNameAr}</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-saudi-green-800"><Users size={15} />{pkg.guestCount} ضيف</span>
        </div>
        <h5 className="font-cairo text-base font-extrabold leading-8 text-saudi-green-950">{pkg.titleAr}</h5>
        <p className="mt-2 text-sm leading-6 text-slate-600">{pkg.descriptionAr}</p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h6 className="text-xs font-bold text-slate-700">الخدمات المشمولة</h6>
          <span className="text-xs text-slate-500">{pkg.items.length} خدمات</span>
        </div>
        <ul className="divide-y divide-saudi-sand-100">
          {pkg.items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 py-3 text-xs leading-6 sm:text-sm">
              <Check size={15} className="mt-1 shrink-0 text-saudi-green-800" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-slate-700">{item.serviceName}</span>
              <bdi className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-600">{formatSAR(item.pricePortion)}</bdi>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-saudi-sand-200 bg-saudi-green-50/50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">سعر الباقة</p>
            {savings > 0 && <del className="mb-1 block text-xs text-slate-500"><bdi>{formatSAR(pkg.originalPrice)}</bdi></del>}
            <bdi className="whitespace-nowrap font-cairo text-2xl font-black text-saudi-green-950">{formatSAR(pkg.packagePrice)}</bdi>
          </div>
          {savings > 0 && <div className="rounded-xl bg-white px-3 py-2 text-xs leading-6 text-saudi-green-800">
            <span className="block font-bold">توفير {formatSAR(savings)}</span>
            <span>خصم {discount}%</span>
          </div>}
        </div>
        <button onClick={onEditPrice} className="flex w-full items-center justify-center gap-2 rounded-xl border border-saudi-green-800/20 bg-white px-4 py-3 text-sm font-bold text-saudi-green-900 transition hover:bg-saudi-green-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saudi-green-800" aria-label={'تعديل سعر ' + pkg.titleAr}>
          <Pencil size={15} />تعديل السعر
        </button>
      </div>
    </article>
  );
}
