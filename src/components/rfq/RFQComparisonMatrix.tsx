'use client';

import React from 'react';
import { CheckCircle2, Star, Zap, DollarSign, Award, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { RFQRequest, RFQQuote } from '@/lib/types';
import { formatSAR } from '@/lib/utils';

interface RFQComparisonMatrixProps {
  rfq: RFQRequest;
  onAcceptQuote: (quote: RFQQuote) => void;
}

export default function RFQComparisonMatrix({ rfq, onAcceptQuote }: RFQComparisonMatrixProps) {
  if (!rfq.quotes || rfq.quotes.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-saudi-sand-300 text-center space-y-3">
        <Clock className="w-10 h-10 text-saudi-gold-600 mx-auto animate-pulse-slow" />
        <h4 className="text-base font-bold text-gray-900 font-cairo">
          طلب عرض السعر قيد التوزيع على الموردين المعتمدين
        </h4>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          تم إرسال متطلباتك إلى موردي {rfq.cityAr}. ستصلك عروض أسعار موحدة ومفصلة هنا خلال دقائق لمقارنتها مباشرة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* RFQ Header Info */}
      <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-saudi-gold-100 text-saudi-gold-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              طلب تسعير #{rfq.id}
            </span>
            <span className="text-xs text-gray-400">• {rfq.cityAr} • {rfq.date}</span>
          </div>
          <h3 className="text-lg font-bold text-saudi-green-950 font-cairo">
            {rfq.occasionTitle} ({rfq.occasionTypeAr})
          </h3>
          <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">
            المتطلبات: "{rfq.requirementsAr}"
          </p>
        </div>

        <div className="bg-saudi-sand-50 border border-saudi-sand-300 p-4 rounded-2xl text-center shrink-0">
          <span className="text-[10px] text-gray-400 block">الميزانية المستهدفة</span>
          <span className="text-xl font-black font-cairo text-saudi-green-900">
            {formatSAR(rfq.budget)}
          </span>
          <span className="text-[10px] text-saudi-gold-600 font-bold block mt-0.5">
            وصلك {rfq.quotes.length} عروض متنافسة
          </span>
        </div>
      </div>

      {/* Side-by-side Standardized Comparison Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {rfq.quotes.map((quote) => {
          const isAccepted = quote.status === 'accepted';

          return (
            <div
              key={quote.id}
              className={`bg-white rounded-3xl border overflow-hidden shadow-card hover:shadow-xl transition-all flex flex-col justify-between ${
                quote.isBestValue
                  ? 'border-saudi-gold-500 ring-2 ring-saudi-gold-500/20'
                  : 'border-saudi-sand-300'
              }`}
            >
              {/* Card Banner Badges */}
              <div className="p-5 pb-0 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={quote.vendorLogo}
                      alt={quote.vendorName}
                      className="w-8 h-8 rounded-xl object-cover border border-gray-200"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">
                        {quote.vendorName}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Star className="w-3 h-3 fill-saudi-gold-500 text-saudi-gold-500" />
                        <span>{quote.rating} تقييم</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlights badge */}
                  {quote.isBestValue && (
                    <span className="bg-saudi-gold-500 text-saudi-green-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      أفضل قيمة
                    </span>
                  )}
                  {quote.isFastest && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      الأسرع تسليماً
                    </span>
                  )}
                </div>

                {/* Total Price Box */}
                <div className="bg-saudi-sand-50 p-3.5 rounded-2xl border border-saudi-sand-300 text-center">
                  <span className="text-[10px] text-gray-400 block">إجمالي العرض النهائي (شامل 15% ضريبة)</span>
                  <span className="text-2xl font-black font-cairo text-saudi-green-950">
                    {formatSAR(quote.total)}
                  </span>
                </div>
              </div>

              {/* Normalized Breakdown Details */}
              <div className="p-5 space-y-3 text-xs flex-1">
                <div className="space-y-1.5 border-b border-gray-100 pb-3">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>السعر الأساسي للخدمة:</span>
                    <span className="font-semibold text-gray-900">{formatSAR(quote.basePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>رسوم التجهيز والتركيب:</span>
                    <span className="font-semibold text-gray-900">{quote.setupFee > 0 ? formatSAR(quote.setupFee) : 'مجاناً'}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>رسوم التوصيل والنقل:</span>
                    <span className="font-semibold text-gray-900">{quote.transportFee > 0 ? formatSAR(quote.transportFee) : 'مجاناً'}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-semibold text-gray-900">{formatSAR(quote.vat)}</span>
                  </div>
                </div>

                {/* Timing */}
                <div className="space-y-1">
                  <span className="font-bold text-gray-700 block">موعد التسليم والجاهزية:</span>
                  <p className="text-gray-500 text-[11px] leading-relaxed">
                    {quote.deliveryTimeAr}
                  </p>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <span className="font-bold text-gray-700 block">ملاحظات والتزامات المورد:</span>
                  <p className="text-gray-500 text-[11px] leading-relaxed bg-saudi-sand-50 p-2.5 rounded-xl">
                    "{quote.notesAr}"
                  </p>
                </div>

                {/* Optional Items */}
                {quote.optionalItems && quote.optionalItems.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="font-bold text-saudi-gold-700 block text-[11px]">
                      إضافات اختيارية مقترحة:
                    </span>
                    {quote.optionalItems.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] text-gray-600">
                        <span>+ {opt.title}</span>
                        <span className="font-bold text-saudi-green-900">{formatSAR(opt.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="p-5 pt-0">
                {isAccepted ? (
                  <div className="w-full py-3 bg-saudi-green-100 text-saudi-green-900 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-saudi-green-800" />
                    <span>تم قبول هذا العرض بنجاح</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onAcceptQuote(quote)}
                    className="w-full py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <span>قبول هذا العرض والبدء بالحجز</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180 text-saudi-gold-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
