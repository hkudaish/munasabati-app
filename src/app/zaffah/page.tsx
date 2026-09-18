'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  Copy, 
  Check, 
  Share2, 
  ShieldCheck, 
  Phone, 
  Star, 
  Users, 
  Flame, 
  ArrowRight,
  Heart,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal } from '@/lib/utils';

interface FolkArtGenre {
  id: string;
  nameAr: string;
  regionAr: string;
  badge: string;
  descriptionAr: string;
  instrumentsAr: string[];
  recommendedOccasionsAr: string[];
  sampleTitle: string;
  duration: string;
  startingPrice: number;
  troupeCount: number;
  image: string;
}

const FOLK_GENRES: FolkArtGenre[] = [
  {
    id: 'ardah',
    nameAr: 'العرضة النجدية السعودية',
    regionAr: 'المنطقة الوسطى والرياض',
    badge: 'تراث وطني أصيل',
    descriptionAr: 'رمز الفخر والشهامة في الأعراس والاحتفالات الكبرى، تؤدى بالطبول والسيوف والراية مع صفوف المؤدين بالزي التراثي (المجند والمردون).',
    instrumentsAr: ['طبول التخمير', 'طبول التثليث', 'السيوف المذهبة', 'الراية السعودية'],
    recommendedOccasionsAr: ['أعراس الرجال', 'احتفالات اليوم الوطني والتأسيس', 'ملتقيات الشركات'],
    sampleTitle: 'نحمد الله جت على ما تمنى - فرقة الدرعية الملكية',
    duration: '04:15',
    startingPrice: 6500,
    troupeCount: 14,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'samri',
    nameAr: 'فن السامري والخماري',
    regionAr: 'نجد والقصيم والشرقية',
    badge: 'طرب أصيل',
    descriptionAr: 'من أعذب الفنون الغنائية النجدية، يعتمد على إيقاعات الدفوف المنسجمة مع ترديد الكورال والقصائد النبطية الغزلية والوجدانية.',
    instrumentsAr: ['الدفوف النجدية', 'المرواس', 'الكورال الجماعي'],
    recommendedOccasionsAr: ['سهرات الأعراس', 'الملكة والغمرة', 'جلسات السمر والمخيمات'],
    sampleTitle: 'يا هلا باللي حضر ليل السعادة - سامري عنيزة',
    duration: '05:30',
    startingPrice: 4500,
    troupeCount: 9,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'mizmar',
    nameAr: 'المزمار والمجس الحجازي',
    regionAr: 'مكة المكرمة وجدة والمدينة',
    badge: 'فلكلور مسجل باليونيسكو',
    descriptionAr: 'فلكلور الحجاز التراثي الشهير، يفتتح بالموال والمجس الترحيبي الحجازي مع إيقاعات العلبة والمرد وأهازيج الشوباش والرقص بالعصي (الشون).',
    instrumentsAr: ['مزمار القصب', 'علبة الإيقاع', 'المرجف', 'دف الزير'],
    recommendedOccasionsAr: ['عقد القران والملكة', 'استقبال المعازيم', 'ليالي الحجاز والمباخر'],
    sampleTitle: 'مجس حجازي ملكي: أهلاً بوفد الكرام - فرقة دان الحجاز',
    duration: '03:50',
    startingPrice: 5000,
    troupeCount: 11,
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'khubaiti',
    nameAr: 'الفن الخبيتي والينبعاوي',
    regionAr: 'الساحل الغربي وينبع',
    badge: 'إيقاع حماسي',
    descriptionAr: 'إيقاعات ساحلية سريعة ومبهجة تعتمد على آلة السمسمية التراثية، تضفي بهجة استثنائية وحماساً فائقاً على صالات الحفلات.',
    instrumentsAr: ['السمسمية الحجازية', 'الزير', 'الدفوف البحرية'],
    recommendedOccasionsAr: ['أعراس ومناسبات الشباب', 'ليالي الغمرة', 'حفلات التخرج الكبرى'],
    sampleTitle: 'يا نسيم الصباح مع إيقاع الخبيتي الحماسي',
    duration: '04:45',
    startingPrice: 4000,
    troupeCount: 8,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'khatwa',
    nameAr: 'الخطوة واللعب الجنوبي',
    regionAr: 'عسير والباحة وجازان',
    badge: 'أصالة جنوبية',
    descriptionAr: 'فن جنوبي ساحر يعتمد على التناغم الحركي الهادئ مع إيقاعات الزلفة والميجان وأشعار الكرم والترحيب الجنوبية العريقة.',
    instrumentsAr: ['الزلفة الجنوبية', 'الميجان', 'البرميل الإيقاعي'],
    recommendedOccasionsAr: ['مناسبات المنطقة الجنوبية', 'أعراس العائلات', 'استقبال كبار الضيوف'],
    sampleTitle: 'خطوة عسيرية: مرحباً هيل عد السيل',
    duration: '06:10',
    startingPrice: 4800,
    troupeCount: 7,
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'zaffah_classic',
    nameAr: 'الزفات الملكية والسينمائية',
    regionAr: 'كافة مدن المملكة',
    badge: 'اللحظة الأيقونية',
    descriptionAr: 'موسيقى وأشعار دخول العروسين بإنتاج أوركسترالي وتوزيع موسيقي فخم مع مؤثرات الدخان والبخور ودهن العود.',
    instrumentsAr: ['أوركسترا سينمائية', 'مؤثرات لايف', 'صوتيات هاي فاي'],
    recommendedOccasionsAr: ['دخول العروس', 'دخول العريس', 'لحظة تقطيع الكيكة'],
    sampleTitle: 'أقبلي يا سيدة كل العذارى - إنتاج ملكي خاص',
    duration: '07:20',
    startingPrice: 3500,
    troupeCount: 22,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
  },
];

export default function ZaffahPage() {
  const { occasions, activeOccasion } = useApp();

  // Audio Player Simulation State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'arts' | 'generator'>('arts');

  // AI Zaffah Generator State
  const [brideName, setBrideName] = useState<string>('سارة');
  const [groomName, setGroomName] = useState<string>('عبدالرحمن');
  const [familyName, setFamilyName] = useState<string>('آل سعود / المقرن');
  const [occasionCity, setOccasionCity] = useState<string>('الرياض');
  const [zaffahStyle, setZaffahStyle] = useState<'royal' | 'traditional' | 'modern' | 'poetic'>('royal');
  const [generatedPoem, setGeneratedPoem] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const togglePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const handleGenerateZaffah = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    setTimeout(() => {
      let poem = '';
      if (zaffahStyle === 'royal') {
        poem = `✨ *زفة ملكية خاصة | ليلة العمر في ${occasionCity}* ✨\n\n` +
          `أَقْبَلَتْ شَمْسُ الحَسَبِ وَالعِزِّ وَالنُّورِ المُبِينْ\n` +
          `«${brideName}» سَتْرُ الحَيَا بِنْتُ الأَكَابِرِ الطَّيِّبِينْ\n\n` +
          `يَوْمَ زَفَّتْ طَابَتِ البُشْرَى لِقَلْبِ «${groomName}»\n` +
          `فَارِسِ الأَمْجَادِ وَاللَّيْثِ الكَرِيمِ المُؤْتَمَنْ\n\n` +
          `يَا هَلَا بِـ«${familyName}» كِرَامَ الجُودِ وَالوَجْهِ الطَّلِيقْ\n` +
          `عَطَّرُوا صَحْنَ المَحَافِلِ بِالبَخُورِ وَبِالعَبِيقْ\n\n` +
          `بَارَكَ الرَّحْمَنُ خَطْوَتَكُمْ عَلَى دَرْبِ الهَنَا\n` +
          `وَجَعَلَ الأَفْرَاحَ عَامِرَةً مَدَى طُولِ الزَّمَنْ 🇸🇦🤍`;
      } else if (zaffahStyle === 'traditional') {
        poem = `🇸🇦 *أهزوجة وزفة تراثية سعودية* 🇸🇦\n\n` +
          `يَا هَلَا يَا مَرْحَبَا بِاللِّي حَضَرْ فِي عُرْسِنَا\n` +
          `نَوَّرَتْ «${occasionCity}» وَازْدَانَتْ لَيَالِي أُنْسِنَا\n\n` +
          `قَامَتِ العَرْضَةُ وَرَفْرَفْ فِي سَمَانَا بَيْرَقُ الجُودِ التَّلِيدْ\n` +
          `لِـ«${groomName}» رَاعِي المَوَاقِفِ سَيِّدِ القَوْمِ الصَّنْدِيدْ\n\n` +
          `وَ«${brideName}» زَيْنُ الصَّبَايَا بَدْرٌ تَمَّ وَاكْتَمَلْ\n` +
          `تَمْشِي بِثَوْبِ البَهَا وَالهَيْبَةِ وَنُورِ الأَمَلْ\n\n` +
          `عَاشَتْ بُيُوتُ «${familyName}» عَسَاهَا فِي عِمَارْ\n` +
          `فِي فَرَحْ دَائِمْ وَعِزٍّ مَا يِطَالِعْ لِلصَّغَارْ!`;
      } else {
        poem = `💫 *قصيدة زفة شاعرية رومانسية* 💫\n\n` +
          `تَمَايَلِي يَا قُرَّةَ العَيْنِ «${brideName}» بِالدَّلَالْ\n` +
          `فَقَدْ حَبَاكِ اللهُ مِنْ حُسْنِ المَهَابَةِ وَالجَمَالْ\n\n` +
          `يَنْتَظِرُكِ كَفُّ «${groomName}» فِي خُطَى الحُبِّ النَّقِيّ\n` +
          `يَعْقِدَانِ العَهْدَ مِيثَاقاً لِعُمْرٍ مُرْتَقِي\n\n` +
          `تَشْهَدُ «${occasionCity}» أَنَّكُمَا أَجْمَلُ مَا رَأَتِ العُيُونْ\n` +
          `عَسَى حَيَاتُكُمَا سَعَادَةً وَحِفْظاً مِنْ كُلِّ المَنُونْ.`;
      }

      setGeneratedPoem(poem);
      setIsGenerating(false);
    }, 600);
  };

  const handleCopyPoem = () => {
    navigator.clipboard.writeText(generatedPoem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Title Banner */}
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-950 text-white border border-amber-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/40">
              <Music className="w-3.5 h-3.5" />
              <span>موسوعة الفنون التراثية والزفات السعودية 🇸🇦</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              أصالة العرضة، نغم السامري، وزفات تليق بليلة العمر
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              استكشف ألوان الفنون الشعبية من مختلف مناطق المملكة، استمع إلى النماذج الصوتية، وولد نصوص وقصائد زفتك الخاصة بالذكاء الاصطناعي لتسليمها لمهندس الصوت والدي جي.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 text-sm font-bold pb-2">
          <button
            onClick={() => setActiveTab('arts')}
            className={`py-2 px-5 rounded-2xl transition flex items-center gap-2 ${
              activeTab === 'arts'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>مكتبة الفنون والفرق الشعبية</span>
          </button>

          <button
            onClick={() => setActiveTab('generator')}
            className={`py-2 px-5 rounded-2xl transition flex items-center gap-2 ${
              activeTab === 'generator'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>مُولّد نصوص وقصائد الزفة الذكي</span>
          </button>
        </div>

        {/* Section 1: Saudi Folk Arts & Music Cards */}
        {activeTab === 'arts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FOLK_GENRES.map((genre) => {
              const isPlaying = playingId === genre.id;

              return (
                <div
                  key={genre.id}
                  className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Header with Badge */}
                    <div className="relative h-48 w-full bg-neutral-900 overflow-hidden">
                      <img
                        src={genre.image}
                        alt={genre.nameAr}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-neutral-950 shadow-md">
                        {genre.badge}
                      </span>

                      <div className="absolute bottom-3 right-3 text-white">
                        <span className="text-[11px] text-amber-300 block font-semibold">{genre.regionAr}</span>
                        <h3 className="text-base font-black font-cairo">{genre.nameAr}</h3>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {genre.descriptionAr}
                      </p>

                      {/* Simulated Audio Track Bar */}
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => togglePlay(genre.id)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                              isPlaying
                                ? 'bg-amber-500 text-neutral-950 shadow-md scale-105'
                                : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:scale-105'
                            }`}
                          >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current mr-0.5" />}
                          </button>

                          <div className="flex-1 mx-3">
                            <span className="text-[11px] font-bold text-neutral-900 dark:text-white block truncate">
                              {genre.sampleTitle}
                            </span>
                            {/* Animated waveform when playing */}
                            <div className="flex items-center gap-0.5 mt-1 h-3">
                              {[12, 24, 18, 28, 14, 22, 10, 26, 16, 20, 30, 14].map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-1 rounded-full transition-all ${
                                    isPlaying
                                      ? 'bg-amber-500 animate-pulse'
                                      : 'bg-neutral-300 dark:bg-neutral-700'
                                  }`}
                                  style={{ height: isPlaying ? `${h}px` : '4px' }}
                                />
                              ))}
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-neutral-400">{genre.duration}</span>
                        </div>
                      </div>

                      {/* Instruments tags */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-neutral-400 block">الآلات والأدوات التراثية:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {genre.instrumentsAr.map((inst, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                            >
                              🥁 {inst}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="p-5 pt-0 border-t border-neutral-100 dark:border-neutral-800/60 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">تبدأ أسعار الفرق من</span>
                      <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatSaudiRiyal(genre.startingPrice)}
                      </span>
                    </div>

                    <Link
                      href={`/marketplace?cat=music`}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                    >
                      استعراض الفرق ({genre.troupeCount})
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section 2: AI Zaffah Poem Generator */}
        {activeTab === 'generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Input Form Column (6 cols) */}
            <div className="lg:col-span-6 bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                    تخصيص وكتابة نص وقصيدة الزفة
                  </h3>
                </div>
                <p className="text-xs text-neutral-500">
                  أدخل أسماء العروسين والعائلة والمدينة لتوليد نص زفة سعودي موزون مخصص لحفلتكم.
                </p>
              </div>

              <form onSubmit={handleGenerateZaffah} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      اسم العروس
                    </label>
                    <input
                      type="text"
                      required
                      value={brideName}
                      onChange={(e) => setBrideName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      اسم العريس
                    </label>
                    <input
                      type="text"
                      required
                      value={groomName}
                      onChange={(e) => setGroomName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      اسم العائلة أو القبيلة
                    </label>
                    <input
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      المدينة
                    </label>
                    <input
                      type="text"
                      value={occasionCity}
                      onChange={(e) => setOccasionCity(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                    طابع ولحن الزفة المفضل
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'royal', label: '👑 زفة ملكية فخمة', desc: 'أوركسترا وهيبة' },
                      { id: 'traditional', label: '🇸🇦 أهزوجة وعرضة تراثية', desc: 'طابع شعبي أصيل' },
                      { id: 'poetic', label: '💫 قصيدة رومانسية راقية', desc: 'أبيات شعرية عذبة' },
                      { id: 'modern', label: '✨ لحن عصري سريع', desc: 'حماسي وشبابي' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setZaffahStyle(style.id as any)}
                        className={`p-3 rounded-2xl text-right border transition-all ${
                          zaffahStyle === style.id
                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <div className="font-bold text-xs">{style.label}</div>
                        <div className="text-[10px] text-neutral-400">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-neutral-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGenerating ? 'جاري نظم وتوليد القصيدة...' : 'توليد نص وقصيدة الزفة'}</span>
                </button>
              </form>
            </div>

            {/* Generated Poem Result Column (6 cols) */}
            <div className="lg:col-span-6 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white p-6 sm:p-8 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    📜
                  </div>
                  <h4 className="font-bold text-sm text-neutral-200">
                    مخطوطة نص الزفة المخصص
                  </h4>
                </div>

                {generatedPoem && (
                  <button
                    onClick={handleCopyPoem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition border border-neutral-700"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ النص</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {generatedPoem ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-white/5 border border-amber-500/20 text-center font-serif text-sm sm:text-base leading-loose whitespace-pre-line text-amber-100">
                    {generatedPoem}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(generatedPoem)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      مشاركة مع مهندس الصوت / DJ
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-3 text-neutral-500">
                  <Sparkles className="w-10 h-10 mx-auto text-amber-500/40" />
                  <p className="text-xs">
                    اضغط على زر "توليد نص وقصيدة الزفة" لإنشاء أبيات مخصصة فورياً.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
