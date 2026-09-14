'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Building,
  DollarSign,
  Crown,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { OccasionTier, GenderSection, VenueType } from '@/lib/types';
import { formatSAR } from '@/lib/utils';
import confetti from 'canvas-confetti';

function PlanWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { occasionTypes, cities, serviceCategories, createOccasion, adminConfig } = useApp();

  // Wizard Step (1 to 10)
  const [step, setStep] = useState(1);

  // Form states
  const [occasionTypeId, setOccasionTypeId] = useState('graduation');
  const [cityId, setCityId] = useState('riyadh');
  const [date, setDate] = useState('2026-11-20');
  const [isApproximateDate, setIsApproximateDate] = useState(false);
  const [guestCount, setGuestCount] = useState(60);
  const [guestsSection, setGuestsSection] = useState<GenderSection>('women');
  const [venueType, setVenueType] = useState<VenueType>('home');
  const [budget, setBudget] = useState(18000);
  const [tier, setTier] = useState<OccasionTier>('luxury');
  const [title, setTitle] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'decor',
    'hospitality',
    'photography',
    'giveaways',
    'invitations',
  ]);

  // Read URL query if any (e.g. /plan?type=wedding)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      setOccasionTypeId(typeParam);
    }
  }, [searchParams]);

  const selectedOccasionObj = occasionTypes.find((o) => o.id === occasionTypeId) || occasionTypes[0];
  const selectedCityObj = cities.find((c) => c.id === cityId) || cities[0];

  const toggleService = (catId: string) => {
    if (selectedServices.includes(catId)) {
      setSelectedServices(selectedServices.filter((s) => s !== catId));
    } else {
      setSelectedServices([...selectedServices, catId]);
    }
  };

  const handleFinishWizard = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // fallback
    }

    const occasionTitle = title.trim() || `مناسبة ${selectedOccasionObj.nameAr} - ${selectedCityObj.nameAr}`;

    const newId = createOccasion({
      title: occasionTitle,
      occasionTypeId,
      cityId,
      date,
      isApproximateDate,
      guestCount,
      guestsSection,
      venueType,
      budget,
      tier,
      notes: `تم إنشاء المناسبة عبر المعالج التفاعلي في ${selectedCityObj.nameAr} لمستوى ${tier}.`,
    });

    router.push(`/occasion/${newId}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Wizard Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
          <span>الخطوة {step} من 7</span>
          <span className="text-saudi-green-800">
            {step === 1 && 'نوع المناسبة'}
            {step === 2 && 'المدينة والموعد'}
            {step === 3 && 'الضيوف وتوزيع الأقسام'}
            {step === 4 && 'موقع الحفل'}
            {step === 5 && 'الميزانية والفخامة'}
            {step === 6 && 'الخدمات والتجهيزات'}
            {step === 7 && 'مراجعة وبناء الخطة'}
          </span>
        </div>
        <div className="w-full bg-saudi-sand-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-saudi-green-800 h-full transition-all duration-300"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Containers */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-saudi-sand-300 shadow-card min-h-[420px] flex flex-col justify-between">
        {/* Step 1: ما المناسبة؟ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">1. البداية</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                ما المناسبة التي ترغب في التخطيط لها؟ 🎉
              </h2>
              <p className="text-xs text-gray-500">
                اختر نوع المناسبة وسنقوم بتخصيص كافة الخدمات والمهام المناسبة لها.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
              {occasionTypes.map((occ) => (
                <button
                  key={occ.id}
                  onClick={() => setOccasionTypeId(occ.id)}
                  className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between gap-2 ${
                    occasionTypeId === occ.id
                      ? 'border-saudi-green-800 bg-saudi-green-50/80 ring-2 ring-saudi-green-800/20 shadow-sm'
                      : 'border-gray-200 hover:border-saudi-gold-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-cairo">{occ.nameAr}</span>
                    {occasionTypeId === occ.id && (
                      <CheckCircle2 className="w-4 h-4 text-saudi-green-800 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 line-clamp-1">{occ.descriptionAr}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: في أي مدينة؟ ومتى الموعد؟ */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">2. المكان والموعد</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                في أي مدينة؟ ومتى موعد المناسبة؟ 📅
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">اختر المدينة:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {cities.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCityId(c.id)}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        cityId === c.id
                          ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-900 ring-2 ring-saudi-green-800/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{c.nameAr}</span>
                      {cityId === c.id && <Check className="w-3.5 h-3.5 text-saudi-green-800" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-2">تاريخ المناسبة:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-saudi-gold-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="approxDate"
                    checked={isApproximateDate}
                    onChange={(e) => setIsApproximateDate(e.target.checked)}
                    className="rounded text-saudi-green-800"
                  />
                  <label htmlFor="approxDate" className="text-xs text-gray-600">
                    التاريخ تقريبي وقابل للتعديل
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: عدد الضيوف وتوزيع الأقسام */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">3. الضيوف والأقسام</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                كم عدد الضيوف المتوقع؟ وتوزيع الحضور؟ 👥
              </h2>
            </div>

            <div className="space-y-6">
              <div className="bg-saudi-sand-50 p-6 rounded-2xl border border-saudi-sand-300 text-center space-y-3">
                <span className="text-xs text-gray-500 block">عدد الضيوف التقديري:</span>
                <span className="text-4xl font-black font-cairo text-saudi-green-950 block">
                  {guestCount} ضيف
                </span>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full max-w-md mx-auto accent-saudi-green-800 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-gray-400 max-w-md mx-auto">
                  <span>10 أشخاص (جلسة خاصة)</span>
                  <span>100 شخص</span>
                  <span>500 شخص (قاعة كبرى)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">نوع وقسم الحضور:</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setGuestsSection('women')}
                    className={`p-3.5 rounded-2xl border text-xs font-bold transition text-center ${
                      guestsSection === 'women'
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-950 ring-2 ring-saudi-green-800/20'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>قسم نساء</span>
                  </button>
                  <button
                    onClick={() => setGuestsSection('men')}
                    className={`p-3.5 rounded-2xl border text-xs font-bold transition text-center ${
                      guestsSection === 'men'
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-950 ring-2 ring-saudi-green-800/20'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>قسم رجال</span>
                  </button>
                  <button
                    onClick={() => setGuestsSection('families')}
                    className={`p-3.5 rounded-2xl border text-xs font-bold transition text-center ${
                      guestsSection === 'families'
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-950 ring-2 ring-saudi-green-800/20'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>عائلات / مشترك</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: موقع الاحتفال */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">4. المكان والموقع</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                أين ستقام المناسبة؟ 🏰
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'home', title: 'في المنزل', desc: 'صالة / حديقة منزلية' },
                { id: 'hall', title: 'قاعة احتفالات / فندق', desc: 'قاعة مخصصة ومجهزة' },
                { id: 'chalet', title: 'شاليه خاص', desc: 'أجواء عصرية مسبح وجلسات' },
                { id: 'istiraha', title: 'استراحة / منتجع', desc: 'مسطحات خضراء ومجالس' },
                { id: 'farm', title: 'مزرعة خاصة', desc: 'طبيعة وجلسات خارجية' },
                { id: 'undecided', title: 'لم أحدد بعد', desc: 'ابحث لي عن مواقع متاحة' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVenueType(v.id as any)}
                  className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
                    venueType === v.id
                      ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-950 ring-2 ring-saudi-green-800/20 shadow-sm'
                      : 'border-gray-200 hover:border-saudi-gold-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-cairo">{v.title}</span>
                    {venueType === v.id && <CheckCircle2 className="w-4 h-4 text-saudi-green-800" />}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: الميزانية ومستوى الفخامة */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">5. الميزانية والمستوى</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                ما الميزانية التقريبية ومستوى الفخامة؟ 💰
              </h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">الميزانية المقدرة (ر.س):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full sm:w-64 px-4 py-3 border border-gray-300 rounded-xl text-base font-black text-saudi-green-950 focus:outline-none focus:border-saudi-gold-500"
                  />
                  <span className="text-xs font-bold text-gray-500">ريال سعودي</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {[8000, 15000, 25000, 50000, 80000].map((b) => (
                    <button
                      key={b}
                      onClick={() => setBudget(b)}
                      className="px-3 py-1 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-700 rounded-lg text-xs font-bold transition"
                    >
                      {formatSAR(b)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">مستوى المناسبة:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'economy', title: 'اقتصادية ميسرة', desc: 'ترتيبات أساسية ذكية' },
                    { id: 'medium', title: 'متوسطة أنيقة', desc: 'تنسيق متكامل متوازن' },
                    { id: 'luxury', title: 'فاخرة VIP', desc: 'ورد طبيعي ومباشرين' },
                    { id: 'ultra_luxury', title: 'ملكية استثنائية', desc: 'أعلى معايير الفخامة' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTier(t.id as any)}
                      className={`p-3 rounded-2xl border text-right transition ${
                        tier === t.id
                          ? 'border-saudi-gold-500 bg-saudi-gold-50/70 text-saudi-green-950 ring-2 ring-saudi-gold-500/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold block">{t.title}</span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: ما الخدمات المطلوبة؟ */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">6. التجهيزات</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                ما هي الخدمات والتجهيزات التي تحتاجها؟ 🛍️
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
              {serviceCategories.map((cat) => {
                const isSelected = selectedServices.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleService(cat.id)}
                    className={`p-3 rounded-2xl border text-right transition flex items-center justify-between ${
                      isSelected
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-950 font-bold'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs">{cat.nameAr}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded text-saudi-green-800"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 7: المراجعة وتأكيد الخطة */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-saudi-gold-600 block uppercase">7. الخطة الجاهزة</span>
              <h2 className="text-2xl font-black font-cairo text-saudi-green-950">
                جاهزون لبناء مساحة عمل مناسبتك! 🚀
              </h2>
              <p className="text-xs text-gray-500">
                راجع ملخص البيانات أدناه واعتمد الخطة للانتقال فوراً لغرفة عمليات المناسبة.
              </p>
            </div>

            <div className="bg-saudi-sand-50 p-5 rounded-2xl border border-saudi-sand-300 space-y-3 text-xs">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">نوع المناسبة:</span>
                <span className="font-bold text-gray-900">{selectedOccasionObj.nameAr}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">المدينة والموعد:</span>
                <span className="font-bold text-gray-900">{selectedCityObj.nameAr} • {date}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">عدد الضيوف والأقسام:</span>
                <span className="font-bold text-gray-900">{guestCount} ضيف ({guestsSection === 'women' ? 'نساء' : 'رجال'})</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">الميزانية المقدرة:</span>
                <span className="font-black text-saudi-green-900 text-sm">{formatSAR(budget)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500">الخدمات المختارة:</span>
                <span className="font-bold text-saudi-green-800">{selectedServices.length} خدمات مجهزة</span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-6 border-t border-saudi-sand-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-5 py-2.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <div />
          )}

          {step < 7 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <span>التالي</span>
              <ArrowLeft className="w-4 h-4 text-saudi-gold-300" />
            </button>
          ) : (
            <button
              onClick={handleFinishWizard}
              className="px-8 py-3 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4 text-saudi-green-950" />
              <span>توليد "خطة مناسبتي" وفتح مساحة العمل</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto p-12 text-center text-xs text-gray-500 font-bold">
          جاري تحميل معالج إنشاء المناسبة...
        </div>
      }
    >
      <PlanWizardContent />
    </Suspense>
  );
}
