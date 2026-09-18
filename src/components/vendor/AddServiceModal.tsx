'use client';

import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Sparkles, 
  Image as ImageIcon, 
  DollarSign, 
  MapPin, 
  Zap, 
  Layers, 
  CheckCircle2 
} from 'lucide-react';
import { useApp } from '@/lib/store';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId?: string;
  onSuccess?: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  vendorId = 'vendor-1',
  onSuccess,
}) => {
  const { serviceCategories, cities } = useApp();

  const [titleAr, setTitleAr] = useState('');
  const [categoryId, setCategoryId] = useState(serviceCategories[0]?.id || 'kosha');
  const [cityId, setCityId] = useState('riyadh');
  const [price, setPrice] = useState('5000');
  const [priceType, setPriceType] = useState<'fixed' | 'per_person' | 'starting_at'>('fixed');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [featuresText, setFeaturesText] = useState('طاقم عمل متكامل، تجهيز وتنسيق مبكر، ضمان الجودة');
  const [instantBooking, setInstantBooking] = useState(true);
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1200);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-neutral-900 dark:text-white text-base">
              إضافة خدمة أو باقة جديدة
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-neutral-900 dark:text-white">
              تم نشر الخدمة بنجاح!
            </h4>
            <p className="text-xs text-neutral-500">
              أصبحت خدمتك متاحة الآن في سوق منصة مناسبتـي لجميع العملاء.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                عنوان الخدمة أو الباقة *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: تنسيق كوشة زفاف ملكية مع ممر العروس"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  التصنيف الرئيسي
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                >
                  {serviceCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  المدينة الرئيسية
                </label>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                >
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  السعر شامل الضريبة (ر.س) *
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  نوع التسعير
                </label>
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="fixed">سعر ثابت للخدمة</option>
                  <option value="per_person">سعر لكل ضيف / شخص</option>
                  <option value="starting_at">يبدأ من (حسب المتطلبات)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                وصف وتفاصيل الخدمة
              </label>
              <textarea
                rows={2}
                placeholder="تفاصيل دقيقة عن الخدمة والمعدات وطريقة التنفيذ..."
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                المميزات الرئيسية (مفصولة بفواصل)
              </label>
              <input
                type="text"
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
              <input
                type="checkbox"
                checked={instantBooking}
                onChange={(e) => setInstantBooking(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                تفعيل الحجز الفوري المباشر للخدمة بدون انتظار موافقة مسبقة
              </span>
            </label>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'جاري الحفظ والنشر...' : 'نشر الخدمة في السوق'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-200"
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
