'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Package,
  Layers,
  MapPin,
  Clock,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface GeneratedPlan {
  occasionTitle: string;
  occasionTypeId: string;
  cityId: string;
  cityNameAr: string;
  guestCount: number;
  budget: number;
  tier: 'economy' | 'medium' | 'luxury' | 'ultra_luxury';
  allocations: { categoryAr: string; amount: number; percentage: number; descAr: string }[];
  tasks: { title: string; daysBefore: number; category: string }[];
  recommendationsAr: string[];
  suggestedPackageId?: string;
  warningsAr?: string[];
}

export default function LumaAIDrawer() {
  const router = useRouter();
  const { isAIOpen, setIsAIOpen, createOccasion, adminConfig, packages, occasionTypes, cities } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);

  const quickPrompts = [
    'أبغى حفلة تخرج بالرياض لـ 80 شخص وميزانيتي 15 ألف',
    'أبغى ملكة منزلية بسيطة بجدة لـ 50 شخص وميزانيتي 20 ألف',
    'زواج فخم لـ 200 شخص بالرياض بميزانية 50 ألف',
    'استقبال مولود جديد في البيت لـ 40 شخص بميزانية 8 آلاف',
  ];

  const handleAnalyze = (queryText: string) => {
    if (!queryText.trim()) return;
    setIsAnalyzing(true);
    setGeneratedPlan(null);

    // AI Natural Language Parsing simulation
    setTimeout(() => {
      let occasionTypeId = 'graduation';
      let occasionTitle = 'حفلة تخرج مباركة';
      let cityId = 'riyadh';
      let cityNameAr = 'الرياض';
      let guestCount = 60;
      let budget = 15000;
      let tier: 'economy' | 'medium' | 'luxury' | 'ultra_luxury' = 'medium';

      const lower = queryText.toLowerCase();

      // Occasion type detection
      if (lower.includes('زواج') || lower.includes('عرس') || lower.includes('زفاف')) {
        occasionTypeId = 'wedding';
        occasionTitle = 'حفل زفاف ملكي مبهج';
        guestCount = 200;
        budget = 50000;
        tier = 'luxury';
      } else if (lower.includes('ملكة') || lower.includes('عقد قران') || lower.includes('خطوبة')) {
        occasionTypeId = 'melka';
        occasionTitle = 'عقد قران وملكة عائلية راقية';
        guestCount = 50;
        budget = 20000;
        tier = 'luxury';
      } else if (lower.includes('مولود') || lower.includes('استقبال')) {
        occasionTypeId = 'newborn';
        occasionTitle = 'استقبال المولود الجديد';
        guestCount = 40;
        budget = 9000;
        tier = 'medium';
      } else if (lower.includes('ميلاد') || lower.includes('أطفال')) {
        occasionTypeId = 'birthday';
        occasionTitle = 'حفل عيد ميلاد سعيد';
        guestCount = 30;
        budget = 5000;
        tier = 'economy';
      } else if (lower.includes('تخرج')) {
        occasionTypeId = 'graduation';
        occasionTitle = 'حفلة تخرج وتفوق بهيجة';
        guestCount = 80;
        budget = 15000;
        tier = 'medium';
      }

      // City detection
      if (lower.includes('جدة') || lower.includes('جده')) {
        cityId = 'jeddah';
        cityNameAr = 'جدة';
      } else if (lower.includes('الدمام') || lower.includes('الخبر') || lower.includes('الشرقية')) {
        cityId = 'khobar';
        cityNameAr = 'الخبر';
      } else if (lower.includes('مكة')) {
        cityId = 'makkah';
        cityNameAr = 'مكة المكرمة';
      }

      // Extract budget numbers if typed
      const budgetMatch = queryText.match(/(\d+)\s*(ألف|الف|k)/i);
      if (budgetMatch) {
        budget = parseInt(budgetMatch[1], 10) * 1000;
      } else {
        const directNumberMatch = queryText.match(/(\d{4,6})/);
        if (directNumberMatch) {
          budget = parseInt(directNumberMatch[1], 10);
        }
      }

      // Extract guest numbers if typed
      const guestMatch = queryText.match(/(\d+)\s*(شخص|ضيف|معازيم|حضور)/);
      if (guestMatch) {
        guestCount = parseInt(guestMatch[1], 10);
      }

      // Calculate smart budget allocations
      const allocations = [
        {
          categoryAr: 'كوش وديكور وتنسيق الورد',
          amount: Math.round(budget * 0.35),
          percentage: 35,
          descAr: 'خلفية مناسبات مخصصة، ورد طبيعي، إضاءة دافئة وطاولة التقديم',
        },
        {
          categoryAr: 'ضيافة سعودية وبوفيه وحلويات',
          amount: Math.round(budget * 0.30),
          percentage: 30,
          descAr: 'قهوة سعودية أصيلة، تمر سكري، دلال رسلان، صبابات، وكيكة المناسبة',
        },
        {
          categoryAr: 'تصوير وتوثيق احترافي',
          amount: Math.round(budget * 0.18),
          percentage: 18,
          descAr: 'مصورة فوتوغراف وفيديو سينمائي 3 ساعات مع ألبوم حراري فاخر',
        },
        {
          categoryAr: 'توزيعات وهدايا ضيوف وبخور',
          amount: Math.round(budget * 0.12),
          percentage: 12,
          descAr: 'بوكسات عود موروكي ومباخر بالاسم وتوزيعات تقديم',
        },
        {
          categoryAr: 'دعوات رقمية واحتياطي طوارئ',
          amount: Math.round(budget * 0.05),
          percentage: 5,
          descAr: 'بطاقة دعوة تفاعلية مع كود QR لتأكيد الحضور عبر الواتساب',
        },
      ];

      const tasks = [
        { title: 'تأكيد وحجز كوشة الديكور وتنسيق الزهور', daysBefore: 20, category: 'الديكور' },
        { title: 'حجز طاقم تصوير نسائي لتوثيق المناسبة', daysBefore: 15, category: 'التصوير' },
        { title: 'طلب بوفيه الضيافة والقهوة السعودية والكيك', daysBefore: 12, category: 'الضيافة' },
        { title: 'إرسال بطاقات الدعوة الذكية للأهل والأصدقاء وتتبع RSVP', daysBefore: 10, category: 'الدعوات' },
        { title: 'استلام التوزيعات والتأكد من طباعة الأسماء', daysBefore: 5, category: 'الهدايا' },
      ];

      const recommendationsAr = [
        `معدل تكلفة الضيف التقريبية لمناسبتك: ${formatSAR(Math.round(budget / guestCount))} لكل ضيف (مستوى ممتاز).`,
        `ننصح ببدء حجز فريق الضيافة والتصوير قبل 14 يوماً لضمان التوفر وتجنب أوقات الذروة.`,
        `يمكنك توفير حتى 20% باختيار إحدى باقاتنا الذكية الجاهزة بدلاً من الحجز المنفرد.`,
      ];

      const matchedPackage = packages.find((p) => p.occasionTypeId === occasionTypeId);

      setGeneratedPlan({
        occasionTitle,
        occasionTypeId,
        cityId,
        cityNameAr,
        guestCount,
        budget,
        tier,
        allocations,
        tasks,
        recommendationsAr,
        suggestedPackageId: matchedPackage?.id,
      });

      setIsAnalyzing(false);
    }, 900);
  };

  const handleApplyPlan = () => {
    if (!generatedPlan) return;

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // fallback
    }

    const newOccasionId = createOccasion({
      title: generatedPlan.occasionTitle,
      occasionTypeId: generatedPlan.occasionTypeId,
      cityId: generatedPlan.cityId,
      guestCount: generatedPlan.guestCount,
      budget: generatedPlan.budget,
      tier: generatedPlan.tier,
      notes: `تم التخطيط عبر المساعد الذكي ${adminConfig.aiAssistantNameAr} بميزانية ${formatSAR(generatedPlan.budget)} لـ ${generatedPlan.guestCount} ضيف.`,
    });

    setIsAIOpen(false);
    router.push(`/occasion/${newOccasionId}`);
  };

  if (!isAIOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-saudi-green-900 to-saudi-green-800 text-white p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center font-black shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-cairo text-white">
                  المساعد الذكي: {adminConfig.aiAssistantNameAr}
                </h3>
                <span className="bg-saudi-gold-500/20 text-saudi-gold-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400/40">
                  خبير المناسبات السعودية 🇸🇦
                </span>
              </div>
              <p className="text-xs text-gray-300">
                اكتب ما يدور في بالك وسأقوم بتفكيك خطة مناسبتك وحساب ميزانيتها بالكامل!
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAIOpen(false)}
            className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-saudi-sand-50">
          {/* Quick Prompts */}
          <div>
            <span className="text-xs font-bold text-gray-600 block mb-2">
              💡 أمثلة سريعة للتجربة الفورية:
            </span>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputQuery(prompt);
                    handleAnalyze(prompt);
                  }}
                  className="text-xs text-right bg-white hover:bg-saudi-green-50 text-gray-700 hover:text-saudi-green-900 border border-saudi-sand-300 hover:border-saudi-green-600 p-2.5 rounded-xl transition shadow-sm"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {isAnalyzing && (
            <div className="p-8 text-center space-y-3 bg-white rounded-2xl border border-saudi-sand-300 shadow-sm">
              <div className="inline-block p-3 rounded-full bg-saudi-gold-100 text-saudi-gold-600 animate-spin">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-saudi-green-900">
                جاري تحليل متطلبات المناسبة وحساب الميزانية المثالية...
              </h4>
              <p className="text-xs text-gray-500">
                نطابق أفضل خيارات الكوشة، الضيافة، التصوير، والتوزيعات المناسبة لذوقك.
              </p>
            </div>
          )}

          {/* Generated Plan Output */}
          {generatedPlan && !isAnalyzing && (
            <div className="space-y-5 animate-fadeIn">
              {/* Plan Summary Card */}
              <div className="bg-white rounded-2xl p-5 border border-saudi-green-200 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-saudi-gold-600 uppercase tracking-wide">
                      الخطة المقترحة لمناسبتك
                    </span>
                    <h4 className="text-lg font-bold text-saudi-green-900 font-cairo">
                      {generatedPlan.occasionTitle}
                    </h4>
                  </div>
                  <span className="bg-saudi-green-100 text-saudi-green-800 text-xs font-bold px-3 py-1 rounded-full">
                    {generatedPlan.cityNameAr}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-saudi-sand-100 p-2.5 rounded-xl">
                    <Users className="w-4 h-4 mx-auto text-saudi-green-800 mb-1" />
                    <span className="text-[10px] text-gray-500 block">عدد الضيوف</span>
                    <span className="text-xs font-bold text-gray-900">{generatedPlan.guestCount} شخص</span>
                  </div>

                  <div className="bg-saudi-sand-100 p-2.5 rounded-xl">
                    <DollarSign className="w-4 h-4 mx-auto text-saudi-gold-600 mb-1" />
                    <span className="text-[10px] text-gray-500 block">الميزانية المقدرة</span>
                    <span className="text-xs font-bold text-saudi-green-900">{formatSAR(generatedPlan.budget)}</span>
                  </div>

                  <div className="bg-saudi-sand-100 p-2.5 rounded-xl">
                    <Clock className="w-4 h-4 mx-auto text-saudi-green-800 mb-1" />
                    <span className="text-[10px] text-gray-500 block">مستوى الفخامة</span>
                    <span className="text-xs font-bold text-saudi-gold-700">فاخرة ومكتملة</span>
                  </div>
                </div>
              </div>

              {/* Smart Budget Breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-saudi-sand-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-saudi-gold-600" />
                    <span>توزيع الميزانية الذكي ({formatSAR(generatedPlan.budget)})</span>
                  </h5>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  <div style={{ width: '35%' }} className="bg-saudi-green-800" title="الديكور 35%" />
                  <div style={{ width: '30%' }} className="bg-saudi-gold-500" title="الضيافة 30%" />
                  <div style={{ width: '18%' }} className="bg-blue-600" title="التصوير 18%" />
                  <div style={{ width: '12%' }} className="bg-amber-600" title="الهدايا 12%" />
                  <div style={{ width: '5%' }} className="bg-purple-600" title="الدعوات 5%" />
                </div>

                <div className="space-y-2 pt-2">
                  {generatedPlan.allocations.map((alloc, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                      <div>
                        <span className="font-bold text-gray-800">{alloc.categoryAr}</span>
                        <p className="text-[10px] text-gray-400">{alloc.descAr}</p>
                      </div>
                      <div className="text-left">
                        <span className="font-black text-saudi-green-900 block">{formatSAR(alloc.amount)}</span>
                        <span className="text-[10px] text-gray-500">({alloc.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automated Checklist Tasks */}
              <div className="bg-white rounded-2xl p-5 border border-saudi-sand-300 shadow-sm space-y-3">
                <h5 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-saudi-green-700" />
                  <span>الجدول الزمني وقائمة المهام التلقائية</span>
                </h5>
                <div className="space-y-2">
                  {generatedPlan.tasks.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-saudi-sand-50 rounded-xl text-xs">
                      <span className="bg-saudi-green-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        قبل {task.daysBefore} يوم
                      </span>
                      <span className="font-medium text-gray-800">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Expert Recommendations */}
              <div className="bg-saudi-gold-50/70 border border-saudi-gold-300 p-4 rounded-2xl space-y-2">
                <h5 className="text-xs font-bold text-saudi-green-950 flex items-center gap-1">
                  <Lightbulb className="w-4 h-4 text-saudi-gold-600" />
                  <span>توصيات لُـمى الذكية لمناسبتك:</span>
                </h5>
                <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside">
                  {generatedPlan.recommendationsAr.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>

              {/* Big Action CTA */}
              <button
                onClick={handleApplyPlan}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-saudi-green-800 to-saudi-green-950 text-white font-bold text-sm shadow-xl shadow-saudi-green-900/20 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-5 h-5 text-saudi-gold-400" />
                <span>اعتماد الخطة وبناء مساحة المناسبة فوراً</span>
                <ArrowRight className="w-4 h-4 rotate-180 text-saudi-gold-300" />
              </button>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-saudi-sand-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyze(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="مثال: أبغى حفلة تخرج بالرياض لـ 70 شخص بميزانية 18 ألف..."
              className="flex-1 px-4 py-3 bg-saudi-sand-100 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500 transition"
            />
            <button
              type="submit"
              disabled={isAnalyzing || !inputQuery.trim()}
              className="px-4 py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-saudi-gold-300 rounded-xl font-bold text-sm flex items-center justify-center disabled:opacity-50 transition shrink-0"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
