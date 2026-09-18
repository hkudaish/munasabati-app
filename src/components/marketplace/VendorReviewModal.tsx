'use client';

import React, { useState } from 'react';
import { Booking } from '@/lib/types';
import { useApp } from '@/lib/store';
import { 
  X, 
  Star, 
  CheckCircle2, 
  Upload, 
  MessageSquare, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface VendorReviewModalProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const VendorReviewModal: React.FC<VendorReviewModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addReview } = useApp();

  const [qualityRating, setQualityRating] = useState<number>(5);
  const [punctualityRating, setPunctualityRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [valueRating, setValueRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const averageRating = Number(
    ((qualityRating + punctualityRating + communicationRating + valueRating) / 4).toFixed(1)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      addReview({
        vendorId: booking.vendorId,
        vendorName: booking.vendorName,
        bookingId: booking.id,
        customerName: booking.customerName || 'عميل مناسبتي',
        customerCityAr: booking.cityAr,
        occasionTypeAr: booking.occasionTitle,
        rating: averageRating,
        qualityRating,
        punctualityRating,
        communicationRating,
        valueRating,
        commentAr: comment || 'خدمة ممتازة وتعامل راقٍ، شكراً جزيلاً لكم!',
        isVerifiedBooking: true,
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    }, 600);
  };

  const renderStarSelector = (
    label: string,
    value: number,
    onChange: (val: number) => void
  ) => (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      <div className="flex items-center gap-1.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform focus:outline-none"
          >
            <Star
              className={`w-5 h-5 ${
                star <= value
                  ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                  : 'text-neutral-300 dark:text-neutral-600'
              }`}
            />
          </button>
        ))}
        <span className="w-6 text-center text-xs font-bold text-neutral-600 dark:text-neutral-400 font-mono ml-1">
          {value}.0
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white text-base">
                تقييم تجربة الخدمة
              </h3>
              <p className="text-xs text-neutral-500">{booking.vendorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-neutral-900 dark:text-white">
              تم نشر تقييمك بنجاح!
            </h4>
            <p className="text-sm text-neutral-500">
              شكراً لمشاركتك رأيك الموثوق لمساعدة أصحاب المناسبات الآخرين.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Verified Booking Banner */}
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                حجز موثق برقم: <strong className="font-mono">{booking.bookingNumber}</strong> ({booking.serviceTitleAr})
              </span>
            </div>

            {/* Overall Rating Score Card */}
            <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-xs text-amber-700 dark:text-amber-400 font-bold block mb-1">
                التقييم الإجمالي العام
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-black font-mono text-amber-500">
                  {averageRating}
                </span>
                <span className="text-sm text-neutral-400">/ 5.0</span>
              </div>
            </div>

            {/* Metric Ratings */}
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1">
              {renderStarSelector('جودة الخدمة والتنفيذ', qualityRating, setQualityRating)}
              {renderStarSelector('الالتزام بالمواعيد والوقت', punctualityRating, setPunctualityRating)}
              {renderStarSelector('حسن التعامل والتواصل', communicationRating, setCommunicationRating)}
              {renderStarSelector('القيمة مقابل السعر', valueRating, setValueRating)}
            </div>

            {/* Comment Area */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                اكتب تفاصيل تجربتك وانطباعك (اختياري)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="كيف كان التنسيق؟ هل كانت الخدمة كما توقعت؟ ما الذي أعجبك أكثر؟"
                rows={3}
                className="w-full p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-neutral-900 dark:text-white placeholder-neutral-400"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">جاري النشر...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    نشر التقييم المعتمد
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3.5 px-5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-sm hover:bg-neutral-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
