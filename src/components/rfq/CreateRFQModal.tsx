'use client';

import React, { useState } from 'react';
import { X, Send, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/store';

interface CreateRFQModalProps {
  onClose: () => void;
  onCreated: (rfqId: string) => void;
}

export default function CreateRFQModal({ onClose, onCreated }: CreateRFQModalProps) {
  const { cities, occasionTypes, createRFQ, activeOccasion } = useApp();

  const [title, setTitle] = useState(activeOccasion?.title || 'طلب تجهيز مناسبة');
  const [occasionTypeId, setOccasionTypeId] = useState(activeOccasion?.occasionTypeId || 'graduation');
  const [cityId, setCityId] = useState(activeOccasion?.cityId || 'riyadh');
  const [date, setDate] = useState(activeOccasion?.date || '2026-11-20');
  const [guestCount, setGuestCount] = useState(activeOccasion?.guestCount ? activeOccasion.guestCount.toString() : '80');
  const [budget, setBudget] = useState(activeOccasion?.budget ? activeOccasion.budget.toString() : '15000');
  const [requirements, setRequirements] = useState('');

  const selectedCityObj = cities.find((c) => c.id === cityId) || cities[0];
  const selectedOccasionObj = occasionTypes.find((o) => o.id === occasionTypeId) || occasionTypes[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirements.trim()) return;

    const newRFQId = createRFQ({
      occasionId: activeOccasion?.id,
      occasionTitle: title,
      occasionTypeAr: selectedOccasionObj.nameAr,
      cityAr: selectedCityObj.nameAr,
      date,
      guestCount: Number(guestCount) || 50,
      budget: Number(budget) || 10000,
      requirementsAr: requirements,
      status: 'open',
    });

    onCreated(newRFQId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-saudi-green-800 text-saudi-gold-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-cairo text-gray-900">
                طلب عروض أسعار من الموردين (RFQ)
              </h3>
              <p className="text-[11px] text-gray-500">
                اطرح متطلباتك واستقبل عروضاً موحدة ومفصلة للمقارنة واختيار الأنسب.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">عنوان الطلب / المناسبة</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: حفل تخرج 80 شخص بشمال الرياض..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">نوع المناسبة</label>
              <select
                value={occasionTypeId}
                onChange={(e) => setOccasionTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
              >
                {occasionTypes.map((occ) => (
                  <option key={occ.id} value={occ.id}>
                    {occ.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">المدينة</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">عدد الضيوف</label>
              <input
                type="number"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">الميزانية (ر.س)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              المواصفات والمتطلبات التفصيلية
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              placeholder="اكتب كل ما تريده بالتفصيل (مثل: كوشة 4 أمتار مع ورد طبيعي هولندي، بوفيه ضيافة قهوة وشاي مع 2 صبابين، تصوير 3 ساعات مع تسليم ألبوم إيطالي...)"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500 leading-relaxed"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5 rotate-180 text-saudi-gold-300" />
              <span>إرسال الطلب للموردين فوراً</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
