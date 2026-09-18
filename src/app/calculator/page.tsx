'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal } from '@/lib/utils';
import { 
  Calculator, 
  Sparkles, 
  Users, 
  Building2, 
  Layers, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  Share2, 
  Printer, 
  HelpCircle,
  ShieldCheck,
  Zap,
  Coffee,
  Camera,
  Music,
  Utensils
} from 'lucide-react';

interface CostBreakdownItem {
  id: string;
  nameAr: string;
  category: string;
  cost: number;
  icon: string;
  included: boolean;
}

export default function CalculatorPage() {
  const router = useRouter();
  const { cities, occasionTypes, createOccasion } = useApp();

  // Inputs
  const [occasionType, setOccasionType] = useState<string>('wedding');
  const [cityId, setCityId] = useState<string>('riyadh');
  const [menGuestCount, setMenGuestCount] = useState<number>(100);
  const [womenGuestCount, setWomenGuestCount] = useState<number>(100);
  const [venueType, setVenueType] = useState<'hotel' | 'hall' | 'istiraha' | 'home'>('hall');
  const [tier, setTier] = useState<'economy' | 'medium' | 'luxury' | 'ultra_luxury'>('medium');

  // Add-ons / Service toggles
  const [includeCatering, setIncludeCatering] = useState<boolean>(true);
  const [includeHospitality, setIncludeHospitality] = useState<boolean>(true);
  const [includeKosha, setIncludeKosha] = useState<boolean>(true);
  const [includePhoto, setIncludePhoto] = useState<boolean>(true);
  const [includeMusic, setIncludeMusic] = useState<boolean>(true);
  const [includeInvites, setIncludeInvites] = useState<boolean>(true);

  const totalGuests = menGuestCount + womenGuestCount;

  // Multipliers based on tier & city
  const tierMultiplier = {
    economy: 0.75,
    medium: 1.0,
    luxury: 1.65,
    ultra_luxury: 2.8,
  }[tier];

  const cityMultiplier = cityId === 'riyadh' || cityId === 'jeddah' ? 1.15 : 1.0;

  // Calculate Venue Cost
  let baseVenueCost = 0;
  if (venueType === 'hotel') baseVenueCost = 35000;
  else if (venueType === 'hall') baseVenueCost = 22000;
  else if (venueType === 'istiraha') baseVenueCost = 6000;
  else baseVenueCost = 1500; // Home setup

  const venueCost = Math.round(baseVenueCost * tierMultiplier * cityMultiplier);

  // Catering (Buffet / Carcass per person)
  const cateringPerPerson = tier === 'economy' ? 85 : tier === 'medium' ? 140 : tier === 'luxury' ? 240 : 420;
  const cateringCost = includeCatering ? Math.round(totalGuests * cateringPerPerson * cityMultiplier) : 0;

  // Hospitality (Coffee & dates crew)
  const hospitalityPerPerson = tier === 'economy' ? 15 : tier === 'medium' ? 25 : tier === 'luxury' ? 45 : 80;
  const hospitalityCost = includeHospitality ? Math.round(totalGuests * hospitalityPerPerson * cityMultiplier) : 0;

  // Kosha & Decoration
  const baseKosha = tier === 'economy' ? 4000 : tier === 'medium' ? 8500 : tier === 'luxury' ? 18000 : 40000;
  const koshaCost = includeKosha ? Math.round(baseKosha * cityMultiplier) : 0;

  // Photography & Video
  const basePhoto = tier === 'economy' ? 2500 : tier === 'medium' ? 5000 : tier === 'luxury' ? 11000 : 25000;
  const photoCost = includePhoto ? Math.round(basePhoto * cityMultiplier) : 0;

  // Music & Folk Troupe (Ardah/DJ)
  const baseMusic = tier === 'economy' ? 2000 : tier === 'medium' ? 4500 : tier === 'luxury' ? 9500 : 22000;
  const musicCost = includeMusic ? Math.round(baseMusic * cityMultiplier) : 0;

  // Digital Invitations & Printing
  const baseInvites = Math.round(totalGuests * 3 + 350);
  const invitesCost = includeInvites ? baseInvites : 0;

  // Subtotal & VAT (15%)
  const subtotal = venueCost + cateringCost + hospitalityCost + koshaCost + photoCost + musicCost + invitesCost;
  const vatAmount = Math.round(subtotal * 0.15);
  const grandTotal = subtotal + vatAmount;
  const costPerGuest = totalGuests > 0 ? Math.round(grandTotal / totalGuests) : 0;

  // Market Benchmark rating
  let marketBenchmark = 'في النطاق الطبيعي والمعتاد للسوق السعودي';
  let marketBadgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (costPerGuest < 120) {
    marketBenchmark = 'اقتصادي وموفر للغاية مقارنة بمتوسط السوق';
    marketBadgeColor = 'text-blue-600 bg-blue-50 border-blue-200';
  } else if (costPerGuest > 450) {
    marketBenchmark = 'فاخر وعالي المستوى مع أعلى معايير الرفاهية';
    marketBadgeColor = 'text-purple-600 bg-purple-50 border-purple-200';
  }

  const handleCreateOccasionFromCalculator = () => {
    const occId = createOccasion({
      title: `مناسبة ${occasionTypes.find(t => t.id === occasionType)?.nameAr || 'جديدة'}`,
      occasionTypeId: occasionType,
      cityId,
      guestCount: totalGuests,
      tier,
      budget: grandTotal,
    });
    router.push(`/occasion/${occId}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Title Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800">
            <Calculator className="w-3.5 h-3.5" />
            <span>حاسبة أسعار السوق السعودي لعام 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
            حاسبة تكاليف وميزانية المناسبات الذكية
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
            احسب التكلفة التقديرية لمناسبتك بدقة متناهية حسب المدينة، عدد الضيوف، فئة الحفل، وباقات الخدمات مع احتساب ضريبة القيمة المضافة 15%.
          </p>
        </div>

        {/* Main Grid: Inputs (Right) & Summary Matrix (Left) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inputs Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Occasion & City Card */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
                  1
                </span>
                نوع المناسبة والمدينة
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                    نوع المناسبة
                  </label>
                  <select
                    value={occasionType}
                    onChange={(e) => setOccasionType(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {occasionTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                    المدينة بالمملكة
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.nameAr} ({city.regionAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Guests & Venue Card */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
                  2
                </span>
                عدد الضيوف ومكان الحفل
              </h2>

              {/* Guest Count Inputs (Men & Women Split) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      قسم الرجال
                    </span>
                    <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {menGuestCount} ضيف
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={10}
                    value={menGuestCount}
                    onChange={(e) => setMenGuestCount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      قسم النساء
                    </span>
                    <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {womenGuestCount} ضيفة
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={10}
                    value={womenGuestCount}
                    onChange={(e) => setWomenGuestCount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Venue Selector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                  مكان إقامة الحفل
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'hall', label: 'قاعة احتفالات', desc: 'مجهزة بالكامل' },
                    { id: 'hotel', label: 'فندق 5 نجوم', desc: 'قاعة فندقية فاخرة' },
                    { id: 'istiraha', label: 'استراحة / شاليه', desc: 'أجواء عائلية' },
                    { id: 'home', label: 'منزل / فيلا خاصة', desc: 'جلسات خارجية' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVenueType(v.id as any)}
                      className={`p-3 rounded-2xl text-right border transition-all ${
                        venueType === v.id
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{v.label}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier Selector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                  فئة ومستوى المناسبة
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'economy', label: 'اقتصادية', badge: 'موفرة' },
                    { id: 'medium', label: 'متوسطة قياسية', badge: 'الأكثر طلباً' },
                    { id: 'luxury', label: 'فاخرة', badge: 'بريميوم' },
                    { id: 'ultra_luxury', label: 'VIP ملوكي', badge: 'أعلى مستوى' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTier(t.id as any)}
                      className={`p-3 rounded-2xl text-right border transition-all ${
                        tier === t.id
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{t.label}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{t.badge}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Services & Inclusions Checkboxes */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
                  3
                </span>
                الخدمات المشمولة في الحسبة
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCatering}
                    onChange={(e) => setIncludeCatering(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">بوفيه العشاء والذبائح</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(cateringCost)}</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHospitality}
                    onChange={(e) => setIncludeHospitality(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">الضيافة والقهوة والصبابين</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(hospitalityCost)}</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeKosha}
                    onChange={(e) => setIncludeKosha(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">الكوشة والتنسيق والورد</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(koshaCost)}</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePhoto}
                    onChange={(e) => setIncludePhoto(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">التصوير الفوتوغرافي والفيديو</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(photoCost)}</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMusic}
                    onChange={(e) => setIncludeMusic(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">العرضة أو الدي جي والصوتيات</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(musicCost)}</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInvites}
                    onChange={(e) => setIncludeInvites(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white">بطاقات الدعوة الرقمية وQR</div>
                      <div className="text-[10px] text-neutral-500">{formatSaudiRiyal(invitesCost)}</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Summary / Price Matrix Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-0.5">
                    التقدير الإجمالي للميزانية
                  </span>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatSaudiRiyal(grandTotal)}
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-neutral-400 block mb-0.5">التكلفة لكل ضيف</span>
                  <div className="text-base font-bold font-mono text-neutral-800 dark:text-neutral-200">
                    {formatSaudiRiyal(costPerGuest)}
                  </div>
                </div>
              </div>

              {/* Market Benchmark Badge */}
              <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${marketBadgeColor}`}>
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>{marketBenchmark}</span>
              </div>

              {/* Line Items Cost List */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <span>إيجار وتجهيز المكان / القاعة:</span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(venueCost)}</span>
                </div>
                {includeCatering && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>بوفيه العشاء والذبائح ({totalGuests} ضيف):</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(cateringCost)}</span>
                  </div>
                )}
                {includeHospitality && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>الضيافة والقهوة والحلويات:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(hospitalityCost)}</span>
                  </div>
                )}
                {includeKosha && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>الكوشة والتنسيق والإضاءة:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(koshaCost)}</span>
                  </div>
                )}
                {includePhoto && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>التصوير الفوتوغرافي والفيديو:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(photoCost)}</span>
                  </div>
                )}
                {includeMusic && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>العرضة أو الدي جي والصوتيات:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(musicCost)}</span>
                  </div>
                )}
                {includeInvites && (
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <span>بطاقات الدعوة الرقمية:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(invitesCost)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 text-neutral-500 font-medium">
                  <span>المبلغ قبل الضريبة:</span>
                  <span className="font-mono">{formatSaudiRiyal(subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-600 font-medium">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span className="font-mono">{formatSaudiRiyal(vatAmount)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleCreateOccasionFromCalculator}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 group"
                >
                  <span>إنشاء مناسبة بهذه الميزانية</span>
                  <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push('/marketplace')}
                    className="py-2.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 text-xs font-semibold transition-colors text-center"
                  >
                    تصفح الموردين
                  </button>
                  <button
                    onClick={handlePrint}
                    className="py-2.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة التقرير
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
