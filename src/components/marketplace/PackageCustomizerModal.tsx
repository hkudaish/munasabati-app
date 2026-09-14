'use client';

import React, { useState } from 'react';
import { X, Check, CheckCircle2, Sliders, Sparkles, Store, ShieldCheck } from 'lucide-react';
import { SmartPackage, PackageItem } from '@/lib/types';
import { formatSAR } from '@/lib/utils';

interface PackageCustomizerModalProps {
  pkg: SmartPackage;
  onClose: () => void;
  onSaveCustomization: (updatedPkg: SmartPackage) => void;
  onBookNow: (updatedPkg: SmartPackage) => void;
}

export default function PackageCustomizerModal({
  pkg,
  onClose,
  onSaveCustomization,
  onBookNow,
}: PackageCustomizerModalProps) {
  const [items, setItems] = useState<PackageItem[]>(pkg.items);

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index && item.customizable) {
          return { ...item, included: !item.included };
        }
        return item;
      })
    );
  };

  const calculatedPackagePrice = items.reduce((acc, curr) => {
    return curr.included ? acc + curr.pricePortion : acc;
  }, 0);

  const updatedPackage: SmartPackage = {
    ...pkg,
    items,
    packagePrice: calculatedPackagePrice,
    originalPrice: calculatedPackagePrice + 1500,
    savings: 1500,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="bg-saudi-green-900 text-white p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-cairo text-white">
                تخصيص الباقة: {pkg.titleAr}
              </h3>
              <p className="text-xs text-gray-300">
                أضف أو استبعد الخدمات التي تحتاجها وسيعاد احتساب السعر فوراً.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 bg-saudi-sand-50 flex-1">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  item.included
                    ? 'bg-white border-saudi-sand-300 shadow-sm'
                    : 'bg-gray-100 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.included}
                    disabled={!item.customizable}
                    onChange={() => toggleItem(idx)}
                    className="w-5 h-5 mt-0.5 rounded text-saudi-green-800 accent-saudi-green-800 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-saudi-gold-700 bg-saudi-gold-50 px-2 py-0.5 rounded">
                        {item.categoryName}
                      </span>
                      {!item.customizable && (
                        <span className="text-[10px] text-gray-400">(بند أساسي لا يمكن إزالته)</span>
                      )}
                    </div>
                    <h5 className="text-xs sm:text-sm font-bold text-gray-900">
                      {item.serviceName}
                    </h5>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Store className="w-3 h-3 text-saudi-green-700" />
                      <span>المزود: {item.vendorName}</span>
                    </p>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-sm font-black font-cairo text-saudi-green-950 block">
                    {formatSAR(item.pricePortion)}
                  </span>
                  <span className="text-[10px] text-gray-400">سعر البند ضمن الباقة</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer & Total */}
        <div className="p-5 bg-white border-t border-saudi-sand-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs text-gray-400 block">إجمالي السعر بعد التخصيص:</span>
            <span className="text-2xl font-black font-cairo text-saudi-green-950">
              {formatSAR(calculatedPackagePrice)}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => onSaveCustomization(updatedPackage)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-xs font-bold transition"
            >
              حفظ التخصيص
            </button>
            <button
              onClick={() => onBookNow(updatedPackage)}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              متابعة الحجز والدفع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
