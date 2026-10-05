'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
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
  SlidersHorizontal,
  Search,
  MapPin,
  Calendar,
  Award,
  Clock,
  X,
  ShoppingBag,
  MessageCircle,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal } from '@/lib/utils';
import { CartItem } from '@/lib/types';

// ==========================================
// 1. DATA TYPES
// ==========================================

interface FolkArtGenre {
  id: string;
  nameAr: string;
  regionAr: string;
  regionKey: 'central' | 'west' | 'south' | 'east' | 'north' | 'womens';
  badge: string;
  badgeColor?: string;
  descriptionAr: string;
  historicalSignificanceAr: string;
  instrumentsAr: string[];
  dressCodeAr: string;
  recommendedOccasionsAr: string[];
  sampleTitle: string;
  duration: string;
  startingPrice: number;
  troupeCount: number;
  image: string;
  rhythmBpm: number;
}

interface TroupePackageTier {
  id: string;
  nameAr: string;
  price: number;
  durationHours: number;
  performersCount: number;
  featuresAr: string[];
}

interface FolkTroupe {
  id: string;
  nameAr: string;
  leaderNameAr: string;
  cityAr: string;
  cityId: string;
  regionKey: 'central' | 'west' | 'south' | 'east' | 'north' | 'womens';
  coverageAr: string;
  genreId: string;
  genreNameAr: string;
  badgeAr: string;
  badgeType: 'official' | 'vip' | 'popular' | 'unesco';
  rating: number;
  reviewsCount: number;
  membersCountRange: string;
  startingPrice: number;
  verifiedLicense: string;
  instrumentsAr: string[];
  inclusionsAr: string[];
  dressCodeAr: string;
  sampleAudioTitle: string;
  audioDuration: string;
  image: string;
  whatsappPhone: string;
  phone: string;
  packages: TroupePackageTier[];
}

// ==========================================
// 2. SAMPLE DATA: FOLK ART GENRES (11 GENRES)
// ==========================================

const FOLK_GENRES: FolkArtGenre[] = [
  {
    id: 'ardah',
    nameAr: 'العرضة النجدية السعودية الملكية',
    regionAr: 'المنطقة الوسطى والرياض والدرعية',
    regionKey: 'central',
    badge: 'تراث وطني باليونيسكو 🇸🇦',
    badgeColor: 'bg-emerald-600 text-white',
    descriptionAr: 'رمز الفخر والشهامة في الأعراس والاحتفالات الكبرى، تؤدى بصفوف متراصة ترتدي الزي التراثي بالطبول المهيبة والسيوف المذهبة وبيرق التوحيد.',
    historicalSignificanceAr: 'نشأت في نجد كرمز للقوة والنصر ووفاء القبائل، وأصبحت الرقصة الرسمية للدولة في الأعياد والمناسبات والانتصارات الملكية.',
    instrumentsAr: ['طبول التخمير الكبيرة', 'طبول التثليث', 'السيوف المذهبة', 'بيرق التوحيد الأخضر'],
    dressCodeAr: 'المردون النجدي الأبيض، الصاية والمجند المطرز، حزام الفشك، والجنبية المذهبة',
    recommendedOccasionsAr: ['أعراس الرجال وزفة المعرس', 'احتفالات اليوم الوطني ويوم التأسيس', 'ملتقيات الشركات والوفود'],
    sampleTitle: 'نحمد الله جت على ما تمنى - فرقة الدرعية الملكية',
    duration: '04:15',
    startingPrice: 6500,
    troupeCount: 18,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 92,
  },
  {
    id: 'samri',
    nameAr: 'فن السامري والخماري والحوطي',
    regionAr: 'نجد والقصيم وحائل والشرقية',
    regionKey: 'central',
    badge: 'طرب شعبي أصيل 🪘',
    badgeColor: 'bg-amber-500 text-neutral-950',
    descriptionAr: 'من أعذب الفنون الغنائية النجدية الوجدانية، يعتمد على إيقاعات الدفوف المنسجمة مع الكورال المتبادل والقصائد النبطية الغزلية الرقيقة.',
    historicalSignificanceAr: 'تطور في مدن نجد (عنيزة، حائل، حوطة بني تميم) متوارثاً عبر أجيال العشاق والشعراء في ليالي السمر وجلسات القمراء.',
    instrumentsAr: ['الدفوف النجدية الخشبية', 'طبل المرواس', 'الكورال التبادلي الصوتي'],
    dressCodeAr: 'الثوب السعودي، الدقلة النجدية المطرزة، والشماغ الأحمر أو الأبيض',
    recommendedOccasionsAr: ['سهرات الأعراس العائلية', 'ليالي الملكة وعقد القران', 'جلسات السمر والمخيمات الفاخرة'],
    sampleTitle: 'يا هلا باللي حضر ليل السعادة - سامري عنيزة وحائل',
    duration: '05:30',
    startingPrice: 4500,
    troupeCount: 14,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 84,
  },
  {
    id: 'mizmar',
    nameAr: 'المزمار والمجس والمجرور الحجازي',
    regionAr: 'مكة المكرمة، جدة، المدينة، والطائف',
    regionKey: 'west',
    badge: 'تراث إنساني باليونيسكو 🌴',
    badgeColor: 'bg-emerald-700 text-white',
    descriptionAr: 'فلكلور الحجاز التراثي الشهير؛ يفتتح بالموال والمجس الترحيبي الحجازي الرخيم، متبوعاً بإيقاعات علبة المزمار والمرجف وأهازيج الشوباش والرقص بالعصي.',
    historicalSignificanceAr: 'رمز كرم وأفراح حارات مكة وجدة التاريخية، يعبر عن البهجة والترحاب الحار بزوار وأهل العرس.',
    instrumentsAr: ['مزمار القصب المزدوج', 'علبة الإيقاع الحجازية', 'المرجف', 'عصي الشون للنزال الفني'],
    dressCodeAr: 'الغبانة الحجازية الصفراء، الثوب العربي، الصديري الحجازي، والشال الحريري',
    recommendedOccasionsAr: ['عقد القران والملكة', 'استقبال المعازيم بالمباخر والورد الطائفي', 'ليالي الغمرة والحناء'],
    sampleTitle: 'مجس حجازي ملكي: أهلاً بوفد الكرام مع إيقاع المزمار والشوباش',
    duration: '03:50',
    startingPrice: 5000,
    troupeCount: 16,
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 108,
  },
  {
    id: 'khubaiti',
    nameAr: 'الفن الخبيتي والينبعاوي والرديح',
    regionAr: 'ينبع والساحل الغربي وجدة',
    regionKey: 'west',
    badge: 'طرب ساحلي حماسي 🔥',
    badgeColor: 'bg-rose-500 text-white',
    descriptionAr: 'إيقاعات ساحلية سريعة ومبهجة تعتمد على آلة السمسمية التراثية الساحرة، تضفي بهجة استثنائية وحماساً فائقاً على صالات الحفلات.',
    historicalSignificanceAr: 'فنون ارتبطت ببحارة الساحل الغربي وقوافل التجارة، تطورت لتصبح روح الاحتفالات الشبابية الكبرى.',
    instrumentsAr: ['السمسمية الحجازية الأصيلة', 'طبل الزير الكبير', 'الدفوف البحرية', 'الصاجات النحاسية'],
    dressCodeAr: 'الثوب الينبعاوي الفضفاض والشال الساحلي الخفيف',
    recommendedOccasionsAr: ['سهرات الشباب والأعراس', 'ليالي الغمرة وتوديع العزوبية', 'حفلات التخرج والأعياد'],
    sampleTitle: 'يا نسيم الصباح مع إيقاع السمسمية والرديح الينبعاوي',
    duration: '04:45',
    startingPrice: 4200,
    troupeCount: 12,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 124,
  },
  {
    id: 'khatwa',
    nameAr: 'الخطوة واللعب والعرضة الجنوبية',
    regionAr: 'عسير وأبها والباحة وجازان',
    regionKey: 'south',
    badge: 'شموخ السراة والجنوب ⛰️',
    badgeColor: 'bg-indigo-600 text-white',
    descriptionAr: 'فن جنوبي ساحر يعتمد على التناغم الحركي الهادئ والخطى المتناسقة مع إيقاعات الزلفة والميجان وأشعار الكرم والترحيب الجنوبية العريقة.',
    historicalSignificanceAr: 'فن أصيل توارثته قبائل عسير وغامد وزهران ورجال الحجر، يعبر عن الانسجام والوقار والتلاحم الجماعي.',
    instrumentsAr: ['الزلفة الجنوبية', 'الميجان الإيقاعي', 'برميل الإيقاع النحاسي', 'الصنج المعدني'],
    dressCodeAr: 'الثوب العسيري، المحزم والجنبية الجنوبية التراثية، وطوق الورد والريحان الطبيعي',
    recommendedOccasionsAr: ['مناسبات المنطقة الجنوبية', 'أعراس العائلات والقبائل', 'استقبال كبار الضيوف والوفود'],
    sampleTitle: 'خطوة عسيرية مهيبة: مرحباً هيل عد السيل مع دق الزلفة',
    duration: '06:10',
    startingPrice: 4800,
    troupeCount: 15,
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 76,
  },
  {
    id: 'dahha',
    nameAr: 'فن الدحة الشمالية والهجيني',
    regionAr: 'تبوك والجوف والحدود الشمالية وحائل',
    regionKey: 'north',
    badge: 'هدير الفرسان وعزوة الشمال 🦅',
    badgeColor: 'bg-stone-700 text-amber-300',
    descriptionAr: 'هدير الفرسان وزئير الحماسة؛ صفوف متلاحمة تصفق صفقات متناغمة (القصعة) مع أصوات الكورال والقصائد الحماسية وعزف الربابة التراثي.',
    historicalSignificanceAr: 'كانت تؤدى بعد معارك الدفاع عن الديار لإرهاب الأعداء وإعلان الظفر، وأصبحت اليوم مظهر الفخر والاحتفال بالكرامة.',
    instrumentsAr: ['القصعة بالأيدي المتناسقة', 'الهدير الصوتي الجماعي', 'الربابة البدوية الأصلية'],
    dressCodeAr: 'الثوب الشمالي الصوفي، الشماغ المهدب، الدقلة الشتوية، ومحزم الفشك',
    recommendedOccasionsAr: ['أعراس البادية والحاضرة', 'سهرات الفرح الرجالية الكبرى', 'أعياد الوطن والمهرجانات التراثية'],
    sampleTitle: 'دحة فرسان الشمال: هلا هلا به يا هلا.. إيقاع القصعة وزئير الفرسان',
    duration: '05:15',
    startingPrice: 5500,
    troupeCount: 9,
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 98,
  },
  {
    id: 'qazoui',
    nameAr: 'فن القزوعي والزامل النجراني',
    regionAr: 'نجران وظهران الجنوب وشرورة',
    regionKey: 'south',
    badge: 'حماسة ووقار الفرسان 🗡️',
    badgeColor: 'bg-yellow-700 text-white',
    descriptionAr: 'فن حماسي مهيب يعتمد على دوي الأقدام والرزفة المتناسقة مع لمعان الجنابي النجرانية والقصائد النبطية الفصيحة في الكرم والشجاعة.',
    historicalSignificanceAr: 'رمز التحالفات القبلية واستقبال وفود الأعراس عند مداخل القرى، معبرة عن أعلى درجات الحفاوة والإجلال.',
    instrumentsAr: ['الرزف الجماعي بالأقدام', 'الزامل الصوتي الكورالي', 'الخناجر النجرانية المذهبة'],
    dressCodeAr: 'الثوب الأبيض والمذيل، المحزم الجلدي العريض، والجنبية النجرانية الصيفية',
    recommendedOccasionsAr: ['زفة المعرس واستقبال القبائل', 'أعراس الزواج الكبرى بالجنوب', 'مناسبات الصلح والتكريم'],
    sampleTitle: 'زامل وقزوعي نجران: سلام يا روس الرجال أهل الوفا والجاه',
    duration: '04:30',
    startingPrice: 5200,
    troupeCount: 8,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 88,
  },
  {
    id: 'bahri_liwa',
    nameAr: 'الفنون البحرية والليوة والصوت الحساوي',
    regionAr: 'الأحساء والدمام والخبر والجبيل',
    regionKey: 'east',
    badge: 'سحر واحة الأحساء وبحر الخليج 🌊',
    badgeColor: 'bg-cyan-700 text-white',
    descriptionAr: 'مزيج فريد بين فنون واحة الأحساء وأهازيج نهامي البحر، مع إيقاعات طبل الليوة ورقصة الفريسة الشعبية والصوت الحساوي الأصيل.',
    historicalSignificanceAr: 'تراث غني يجمع بين تراث مزارعي النخيل وغواصي اللؤلؤ في الخليج العربي، يتميز بالحيوية والألحان الشجية.',
    instrumentsAr: ['طبل الليوة الإفريقي الخليجي', 'المرواس الحساوي', 'المزامير الخشبية', 'صفقات الكورال المتناغمة'],
    dressCodeAr: 'البشت الحساوي المطرز (الدربوية الملكية)، الثوب الأبيض، والعقال المقصب',
    recommendedOccasionsAr: ['أعراس المنطقة الشرقية', 'ليالي الحناء وزفة المعرس الحساوية', 'مهرجانات التمور والفعاليات الثقافية'],
    sampleTitle: 'صوت سامري حساوي مع نهمات البحر وإيقاع الليوة الطربي',
    duration: '04:55',
    startingPrice: 4600,
    troupeCount: 11,
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 112,
  },
  {
    id: 'rufaihi',
    nameAr: 'الرفيحي والسامري العلاوي',
    regionAr: 'العلا وتبوك والوجه وضباء',
    regionKey: 'north',
    badge: 'عبق الآثار وألحان العلا 🏜️',
    badgeColor: 'bg-amber-700 text-white',
    descriptionAr: 'فن شعبي سريع ورشيق يتميز بالتصفيق السريع المتلاحق والخطوات الراقصة الخفيفة مع أبيات شعرية عذبة تتغنى بجمال جبال وتراث العلا.',
    historicalSignificanceAr: 'تراث أصيل بين بوادي وحواضر شمال الحجاز ووادي القرى، يحمل خفة الروح والبهجة التلقائية.',
    instrumentsAr: ['الدفوف الخفيفة', 'المرواس', 'التصفيق الرفاعي السريع المنفرد'],
    dressCodeAr: 'الثوب السعودي، المحزم الجلدي الخفيف، والشماغ المهدب',
    recommendedOccasionsAr: ['مناسبات وادي العلا السياحية', 'أعراس شباب الشمال', 'مخيمات واحتفالات الشتاء'],
    sampleTitle: 'رفيحي العلا التراثي: يا غزالٍ مر في وادي القرى',
    duration: '04:40',
    startingPrice: 4400,
    troupeCount: 7,
    image: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 130,
  },
  {
    id: 'zaffah_classic',
    nameAr: 'الزفات الملكية والكورال الأوركسترالي',
    regionAr: 'كافة مدن المملكة (الرياض، جدة، الشرقية)',
    regionKey: 'central',
    badge: 'اللحظة الأيقونية الفخمة 👑',
    badgeColor: 'bg-purple-600 text-white',
    descriptionAr: 'إنتاج موسيقي أوركسترالي متكامل مخصص لزفة العروسين بأسمائهما مع آلات حية، توزيع سينمائي، ومؤثرات صوتية وضوئية فائقة الدقة.',
    historicalSignificanceAr: 'تطور فني حديث يدمج بين الشعر النبطي والأوركسترا العالمية لخلق لحظة أسطورية لا تُنسى في صالات الأفراح.',
    instrumentsAr: ['أوركسترا حية', 'آلات القانون والعود والكمان', 'مؤثرات هاي فاي', 'إضاءات وسحب دخان'],
    dressCodeAr: 'أزياء سهرة رسمية موحدة ومحتشمة لكامل الطاقم الفني',
    recommendedOccasionsAr: ['دخول العروس الملكي', 'دخول العريس والشبكة', 'لحظة تقطيع الكيكة والرقصة الأولى'],
    sampleTitle: 'أقبلي يا سيدة كل العذارى - إنتاج سيمفوني خاص بأحدث التقنيات',
    duration: '07:20',
    startingPrice: 3500,
    troupeCount: 24,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 68,
  },
  {
    id: 'duff_womens',
    nameAr: 'فرق الدفوف والزفات النسائية الإسلامية VIP',
    regionAr: 'الرياض وجدة والدمام ومكة',
    regionKey: 'womens',
    badge: 'طرب نسائي خاص 100% 🪘',
    badgeColor: 'bg-pink-600 text-white',
    descriptionAr: 'فرق نسائية محترفة ومعتمدة لإحياء ليالي الأعراس النسائية بطرب راقٍ وأصيل بالدفوف الصافية الخالية من أي شبهة أو آلات ممنوعة وبخصوصية تامة.',
    historicalSignificanceAr: 'تراث أصيل لزواجات النساء السعودية، يحافظ على الخصوصية الكاملة مع تقديم أجمل أغاني الزفات والشيلات الحماسية.',
    instrumentsAr: ['الدفوف الإسلامية الصافية الخشبية', 'الكورال النسائي النقي', 'الأورج الشرقي الصوتي المعتمد'],
    dressCodeAr: 'عبايات فاخرة وموحدة، طاقم نسائي كامل 100% مع أجهزة تشويش وتأمين',
    recommendedOccasionsAr: ['زواجات النساء وصالات الأفراح', 'ليالي الملكة والغمرة', 'حفلات التخرج والاستقبال الخاصة'],
    sampleTitle: 'زفة بدر البدور - بالدفوف الصافية والكورال النسائي النقي',
    duration: '05:45',
    startingPrice: 6000,
    troupeCount: 19,
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
    rhythmBpm: 104,
  },
];

// ==========================================
// 3. SAMPLE DATA: CERTIFIED FOLK TROUPES (10 TROUPES)
// ==========================================

const FOLK_TROUPES: FolkTroupe[] = [
  {
    id: 'troupe-1',
    nameAr: 'فرقة سيوف نجد الملكية للعرضة والسامري',
    leaderNameAr: 'المايسترو / تركي بن محمد السبيعي',
    cityAr: 'الرياض',
    cityId: 'ruh',
    regionKey: 'central',
    coverageAr: 'تغطية كاملة لكافة مدن ومناطق المملكة والخليج',
    genreId: 'ardah',
    genreNameAr: 'العرضة النجدية والسامري',
    badgeAr: 'الفرقة الرسمية المعتمدة',
    badgeType: 'official',
    rating: 4.98,
    reviewsCount: 240,
    membersCountRange: '25 - 40 مؤدي وعارض محترف',
    startingPrice: 7500,
    verifiedLicense: 'سجل تجاري رقم 1010892341 (مرخص من المركز الوطني للفعاليات)',
    instrumentsAr: ['طبول التخمير الكبيرة', 'طبول التثليث المذهبة', 'السيوف المصقولة', 'بيرق التوحيد الأخضر'],
    inclusionsAr: [
      'صف عارضين كامل يرتدون المردون النجدي التراثي الفاخر',
      'حامل بيرق التوحيد الرسمي',
      'تجهيز السيوف المذهبة لفرسان العرس وأهل المعرس',
      'فقرة سامري إضافية ختامية عند الطلب',
      'نقل وتأمين كامل المؤدين بسيارات VIP مخصصة',
    ],
    dressCodeAr: 'المردون النجدي الأبيض المطرز والمجند المذهب الفاخر',
    sampleAudioTitle: 'العرضة الملكية: نحمد الله جت على ما تمنى',
    audioDuration: '04:15',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966501234567',
    phone: '+966 50 123 4567',
    packages: [
      {
        id: 'ardah-pkg-standard',
        nameAr: 'باقة العرضة الكلاسيكية (20 عارض)',
        price: 7500,
        durationHours: 2,
        performersCount: 20,
        featuresAr: ['20 مؤدي وعارض', 'طبول التخمير والتثليث', 'السيوف التراثية', 'استقبال المعرس والضيوف'],
      },
      {
        id: 'ardah-pkg-royal',
        nameAr: 'الباقة الملكية الشاملة (35 عارض + سامري)',
        price: 12000,
        durationHours: 4,
        performersCount: 35,
        featuresAr: [
          '35 مؤدي وعارض بالزي التراثي الكامل',
          'بيرق التوحيد الرسمي المطرز بخيوط الذهب',
          'فقرة العرضة الملكية + فقرة سامري حائل وعنيزة',
          'سيوف إضافية خاصة لضيوف الحفل',
          'مهندس صوت خاص لضبط الصدى والطبول',
        ],
      },
    ],
  },
  {
    id: 'troupe-2',
    nameAr: 'فرقة دان الحجاز للمزمار والمجس والمجرور',
    leaderNameAr: 'الجسّيس / هتان بن طلال مكي',
    cityAr: 'جدة ومكة المكرمة',
    cityId: 'jed',
    regionKey: 'west',
    coverageAr: 'جدة، مكة، المدينة، الطائف، وينبع',
    genreId: 'mizmar',
    genreNameAr: 'المزمار والمجس الحجازي',
    badgeAr: 'تراث يونيسكو معتمد',
    badgeType: 'unesco',
    rating: 4.95,
    reviewsCount: 192,
    membersCountRange: '16 - 22 مؤدي وعازف',
    startingPrice: 5500,
    verifiedLicense: 'ترخيص هيئة الموسيقى رقم MUS-2024-8841',
    instrumentsAr: ['مزمار القصب المزدوج', 'علبة الإيقاع الحجازية', 'المرجف', 'دف الزير', 'عصي الشون'],
    inclusionsAr: [
      'مجس ترحيبي حجازي ملكي مخصص بأسماء العروسين والعائلات',
      'زفة المزمار الحماسية ودخول المعرس على أهازيج الشوباش',
      'رقصة الشون الاستعراضية بالعصي الحجازية التراثية',
      'مباخر العود والجاوي الحجازية ومسارح الورد الطائفي',
    ],
    dressCodeAr: 'الغبانة الحجازية الصفراء، الثوب العربي، والصديري المطرز',
    sampleAudioTitle: 'مجس حجازي ملكي مع إيقاع المزمار وعصي الشون',
    audioDuration: '03:50',
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966502345678',
    phone: '+966 50 234 5678',
    packages: [
      {
        id: 'mizmar-pkg-standard',
        nameAr: 'باقة المزمار الحجازي (16 مؤدي)',
        price: 5500,
        durationHours: 2.5,
        performersCount: 16,
        featuresAr: ['مجسين ترحيبيين', 'مزمار وعلبة وإيقاع حي', 'استقبال الضيوف والمعازيم', 'رقصة الشون'],
      },
      {
        id: 'mizmar-pkg-vip',
        nameAr: 'الباقة الحجازية المتكاملة مع المجرور الطائفي',
        price: 8500,
        durationHours: 4,
        performersCount: 22,
        featuresAr: [
          '22 مؤدي وعازف بالزي الحجازي التراثي الكامل',
          '3 مجسات حصرية مسجلة بأرقى الألحان',
          'فقرة المجرور الطائفي الأصيل بالدفوف والصفوف المتقابلة',
          'طاقم ضيافة مباخر العود الملكي مع الزفة',
        ],
      },
    ],
  },
  {
    id: 'troupe-3',
    nameAr: 'فرقة أصايل عنيزة للسامري والخماري',
    leaderNameAr: 'الفنان والمنشد / صالح بن إبراهيم التميمي',
    cityAr: 'القصيم (عنيزة وبريدة)',
    cityId: 'qassim',
    regionKey: 'central',
    coverageAr: 'منطقة القصيم، الرياض، حائل، والمنطقة الشرقية',
    genreId: 'samri',
    genreNameAr: 'السامري والخماري والحوطي',
    badgeAr: 'سفراء الطرب النجدي',
    badgeType: 'popular',
    rating: 4.93,
    reviewsCount: 168,
    membersCountRange: '12 - 18 مؤدي ومنشد',
    startingPrice: 4800,
    verifiedLicense: 'وثيقة عمل حر فئة الفنون التراثية رقم FL-8839210',
    instrumentsAr: ['الدفوف النجدية الخشبية المعتدلة', 'المرواس', 'الكورال الجماعي الشجي'],
    inclusionsAr: [
      'نخبة من المنشدين أصحاب الحناجر النجدية الطربية',
      'قصائد نبطية غزلية مخصصة للعروسين',
      'إيقاعات الدفوف المنسجمة مع صفقات الحضور التفاعلية',
      'جلسة سمر نجدية حول دلال القهوة والبخور',
    ],
    dressCodeAr: 'الثوب السعودي النقي والدقلة النجدية التراثية مع الشماغ الأحمر',
    sampleAudioTitle: 'سامري عنيزة الأصيل: يا ليل دانه على العشاق',
    audioDuration: '05:30',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966503456789',
    phone: '+966 50 345 6789',
    packages: [
      {
        id: 'samri-pkg-standard',
        nameAr: 'سهرة السامري الأصيل (12 مؤدي)',
        price: 4800,
        durationHours: 3,
        performersCount: 12,
        featuresAr: ['12 منشد وضارب دف', 'ألحان سامري عنيزة وحائل', 'قصائد نبطية ترحيبية', 'تفاعل مع المعازيم'],
      },
      {
        id: 'samri-pkg-full',
        nameAr: 'ليلة الطرب النجدي الشاملة (سامري + خماري + حوطي)',
        price: 7500,
        durationHours: 5,
        performersCount: 18,
        featuresAr: [
          '18 مؤدي ومنشد بأعذب الأصوات',
          'دمج بين السامري والخماري والحوطي الحماسي',
          'تسجيل صوتي عالي الدقة للسهرة هدية لأهل العرس',
          'معدات هندسة صوتية متنقلة خاصة بالدفوف',
        ],
      },
    ],
  },
  {
    id: 'troupe-4',
    nameAr: 'فرقة ليالي ينبع للطرب والسمسمية والرديح',
    leaderNameAr: 'عازف السمسمية / مروان الينبعاوي',
    cityAr: 'ينبع والمدينة المنورة',
    cityId: 'med',
    regionKey: 'west',
    coverageAr: 'ينبع، جدة، المدينة، ورابغ والوجه',
    genreId: 'khubaiti',
    genreNameAr: 'الفن الخبيتي والينبعاوي',
    badgeAr: 'طرب ساحلي مشتعل',
    badgeType: 'popular',
    rating: 4.91,
    reviewsCount: 145,
    membersCountRange: '10 - 16 مؤدي وعازف',
    startingPrice: 4500,
    verifiedLicense: 'سجل تجاري رقم 4030781290 - تنظيم المؤتمرات والاحتفالات',
    instrumentsAr: ['السمسمية الينبعاوية الأثرية', 'طبل الزير الكبير', 'الدفوف البحرية', 'الصاجات النحاسية'],
    inclusionsAr: [
      'عزف حي مباشر على آلة السمسمية التراثية',
      'إيقاعات الخبيتي الحماسية التي تشعل حماس الشباب والمعازيم',
      'أهازيج الرديح الينبعاوي الشجي مع المواويل الساحلية',
      'استعراض الرقص الإيقاعي التراثي بالخيزران',
    ],
    dressCodeAr: 'الثوب الينبعاوي الخفيف مع الشال الملون الساحلي',
    sampleAudioTitle: 'طرب ينبعاوي حماسي: يا شراع الهوى والنسيم الساحلي',
    audioDuration: '04:45',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966504567890',
    phone: '+966 50 456 7890',
    packages: [
      {
        id: 'yanbu-pkg-standard',
        nameAr: 'باقة الينبعاوي والسمسمية (10 مؤدين)',
        price: 4500,
        durationHours: 3,
        performersCount: 10,
        featuresAr: ['عزف سمسمية حي', 'إيقاعات الخبيتي', 'أهازيج ساحلية تراثية', 'مشاركة الشباب بالرقص'],
      },
      {
        id: 'yanbu-pkg-deluxe',
        nameAr: 'باقة ليلة الساحل الملكية (16 مؤدي + خبيتي ورديح)',
        price: 7000,
        durationHours: 4.5,
        performersCount: 16,
        featuresAr: [
          '16 عازف ومؤدي',
          'سمسميتين حيتين وتناغم إيقاعي مزدوج',
          'جلسة رديح مطولة للمتذوقين وأهل الطرب',
          'إضاءات ليزر ومؤثرات دخان ساحلية متنقلة',
        ],
      },
    ],
  },
  {
    id: 'troupe-5',
    nameAr: 'فرقة صدى الجنوب للخطوة واللعب والزامل',
    leaderNameAr: 'الشاعر والمايسترو / مسفر بن سعد الشهراني',
    cityAr: 'أبها وخميس مشيط',
    cityId: 'abha',
    regionKey: 'south',
    coverageAr: 'عسير، الباحة، جازان، نجران، والرياض',
    genreId: 'khatwa',
    genreNameAr: 'الخطوة العسيرية والعرضة الجنوبية',
    badgeAr: 'هيبة السراة ورجال الحجر',
    badgeType: 'official',
    rating: 4.97,
    reviewsCount: 210,
    membersCountRange: '20 - 32 مؤدي وعارض',
    startingPrice: 5200,
    verifiedLicense: 'ترخيص المركز الوطني للفعاليات فئة عروض شعبية',
    instrumentsAr: ['الزلفة الجنوبية الفخمة', 'الميجان الإيقاعي', 'برميل النحاس الرنان', 'الجنابي التراثية'],
    inclusionsAr: [
      'صفوف الخطوة العسيرية المتناسقة بانسيابية وهيبة عالية',
      'زامل الترحيب بالضيوف وأهل العروسين عند مدخل القاعة',
      'فقرة اللعب والمسيرة الجنوبية التراثية',
      'أطواق الورد الجبلي والكاذي والريحان الطبيعي لفرسان العرس',
    ],
    dressCodeAr: 'الثوب العسيري مع المحزم الجلدي والجنبية الجنوبية التراثية وطوق الورد',
    sampleAudioTitle: 'خطوة عسيرية فخمة: مرحباً بأهل الوفا والجاه',
    audioDuration: '06:10',
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966505678901',
    phone: '+966 50 567 8901',
    packages: [
      {
        id: 'south-pkg-standard',
        nameAr: 'باقة الخطوة والزامل الترحيبي (20 مؤدي)',
        price: 5200,
        durationHours: 3,
        performersCount: 20,
        featuresAr: ['زامل المدخل', 'صفوف الخطوة العسيرية', 'أطواق الكاذي والورد', 'دق الزلفة والميجان'],
      },
      {
        id: 'south-pkg-vip',
        nameAr: 'الباقة الجنوبية الملكية الشاملة (32 مؤدي)',
        price: 8800,
        durationHours: 5,
        performersCount: 32,
        featuresAr: [
          '32 مؤدي وعارض بكامل العتاد والزي الجنوبي الأصيل',
          'زاملين شعريين مخصصين بأسماء العائلات والقبائل',
          'استعراض العرضة واللعب الشهري والخطوة المطولة',
          'توزيع 50 طوق ورد طبيعي للمعازيم وكبار الضيوف',
        ],
      },
    ],
  },
  {
    id: 'troupe-6',
    nameAr: 'فرقة فرسان الشمال للدحة والهجيني',
    leaderNameAr: 'المنشد والبارع / نايف بن عودة الشمري',
    cityAr: 'تبوك والجوف',
    cityId: 'tabuk',
    regionKey: 'north',
    coverageAr: 'تبوك، الجوف، سكاكا، عرعر، حائل، والحدود الشمالية',
    genreId: 'dahha',
    genreNameAr: 'الدحة الشمالية والهجيني',
    badgeAr: 'هدير الشمال وعزوة النشامى',
    badgeType: 'popular',
    rating: 4.94,
    reviewsCount: 130,
    membersCountRange: '18 - 28 مؤدي',
    startingPrice: 5800,
    verifiedLicense: 'سجل تجاري رقم 3350129480 معتمد من وزارة التجارة',
    instrumentsAr: ['القصعة الإيقاعية بالأيدي', 'الكورال والهدير الصوتي المهيب', 'الربابة البدوية التراثية'],
    inclusionsAr: [
      'صفوف الدحة الشمالية المتلاصقة بهيبة الفرسان',
      'حداء وهجيني أصيل ترحيباً بالعريس والقبائل',
      'عازف ربابة محترف لقصائد الفخر والوفاء النبطية',
      'القصعة السريعة وحماس التفاعل مع أهل المعرس',
    ],
    dressCodeAr: 'الثوب الشمالي الصوفي والشماغ المهدب ومحازم الفشك التراثية',
    sampleAudioTitle: 'الدحة الشمالية الرسمية مع القصعة وزئير الفرسان',
    audioDuration: '05:15',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966506789012',
    phone: '+966 50 678 9012',
    packages: [
      {
        id: 'north-pkg-standard',
        nameAr: 'باقة الدحة الشمالية (18 مؤدي)',
        price: 5800,
        durationHours: 2.5,
        performersCount: 18,
        featuresAr: ['18 مؤدي صف دحة', 'قصائد الهجيني والحداء', 'عزف الربابة التراثي', 'استقبال فرسان العرس'],
      },
      {
        id: 'north-pkg-deluxe',
        nameAr: 'باقة ملتقى النشامى الملكية (28 مؤدي)',
        price: 9200,
        durationHours: 4.5,
        performersCount: 28,
        featuresAr: [
          '28 مؤدي وعارض بالزي الشمالي المهدب الكامل',
          'صفوف دحة مزدوجة ومبارزة شعرية بالقصائد النبطية',
          'فقرة السامري الرفيحي الشمالي الإضافية',
          'ضيافة الدلة الشمالية الصفراء وبخور العود التراثي',
        ],
      },
    ],
  },
  {
    id: 'troupe-7',
    nameAr: 'فرقة دانات الأحساء للفنون البحرية والليوة',
    leaderNameAr: 'النهام والباحث التراثي / يوسف بن أحمد الملا',
    cityAr: 'الأحساء والدمام',
    cityId: 'khobar',
    regionKey: 'east',
    coverageAr: 'الأحساء، الدمام، الخبر، الجبيل، والرياض',
    genreId: 'bahri_liwa',
    genreNameAr: 'الفنون البحرية والليوة والصوت الحساوي',
    badgeAr: 'عبق واحة الأحساء وبحر الخليج',
    badgeType: 'unesco',
    rating: 4.92,
    reviewsCount: 155,
    membersCountRange: '14 - 20 مؤدي وعازف',
    startingPrice: 4900,
    verifiedLicense: 'ترخيص هيئة الموسيقى والجمعية السعودية للثقافة والفنون',
    instrumentsAr: ['طبل الليوة الإفريقي الخليجي', 'المرواس الحساوي', 'المزامير الخشبية', 'صفقات النهام'],
    inclusionsAr: [
      'نهمات بحرية أصيلة بصوت نهام حائز على جوائز التراث الخليجي',
      'إيقاع الليوة الطربي المبهج الذي يدعو الجميع للمشاركة',
      'رقصة الفريسة التراثية المستوحاة من تاريخ الأحساء',
      'صوت سامري حساوي شجي بالبشوت الدربوية الفاخرة',
    ],
    dressCodeAr: 'البشت الحساوي المطرز، الثوب الأبيض النقي، والعقال المقصب',
    sampleAudioTitle: 'ليوة حساوية طربية مع نهمات البحر التراثية',
    audioDuration: '04:55',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966507890123',
    phone: '+966 50 789 0123',
    packages: [
      {
        id: 'east-pkg-standard',
        nameAr: 'باقة الفنون الحساوية والبحرية (14 مؤدي)',
        price: 4900,
        durationHours: 3,
        performersCount: 14,
        featuresAr: ['طبل الليوة والمزامير', 'نهمات بحرية للغوص', 'صوت سامري حساوي', 'استقبال الضيوف بالمرواس'],
      },
      {
        id: 'east-pkg-royal',
        nameAr: 'الباقة الحساوية الملكية (20 مؤدي + فريسة وبشوت)',
        price: 7800,
        durationHours: 4.5,
        performersCount: 20,
        featuresAr: [
          '20 مؤدي بالبشوت الحساوية المطرزة بالزري الأصلي',
          'استعراض رقصة الفريسة التراثية التاريخية',
          'جلسة طرب سامري حساوي مفتوحة بعد العشاء',
          'طاقم بخور العود الحساوي وماء الورد الحبيشي',
        ],
      },
    ],
  },
  {
    id: 'troupe-8',
    nameAr: 'فرقة لؤلؤة الخليج للدفوف والزفات النسائية VIP',
    leaderNameAr: 'الفنانة والمنسقة / أم خالد الدوسري',
    cityAr: 'الرياض وجدة والشرقية',
    cityId: 'ruh',
    regionKey: 'womens',
    coverageAr: 'الرياض، جدة، الخبر، الدمام، مكة، والقصيم (طاقم نسائي 100%)',
    genreId: 'duff_womens',
    genreNameAr: 'الدفوف الصافية والزفات النسائية',
    badgeAr: 'الخيار الأول للصالات النسائية الملكية',
    badgeType: 'vip',
    rating: 4.99,
    reviewsCount: 310,
    membersCountRange: '8 - 14 منشدة وكورال نسائي محترف',
    startingPrice: 7000,
    verifiedLicense: 'ترخيص رسمي لتنظيم وإحياء الفعاليات النسائية بخصوصية تامة',
    instrumentsAr: ['الدفوف الإسلامية الصافية الخالية من المخالفات', 'الكورال النسائي النقي', 'هندسة صوتية نسائية متخصصة'],
    inclusionsAr: [
      'خصوصية تامة 100% مع التزام كامل بالضوابط والأمان',
      'زفة دخول العروس بكلمات خاصة بأسماء العروسين والعائلات',
      'إحياء كامل السهرة بأعذب الأغاني الخليجية والسعودية التراثية والحديثة بالدفوف الصافية',
      'أجهزة تحكم صوتية خبيرة لموازنة الصوت مع أصداء القاعة',
    ],
    dressCodeAr: 'عبايات سهرة ملكية موحدة لكامل الطاقم النسائي',
    sampleAudioTitle: 'زفة أقبلت نور الليالي - بالدفوف الصافية والكورال النسائي',
    audioDuration: '05:45',
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966508901234',
    phone: '+966 50 890 1234',
    packages: [
      {
        id: 'womens-pkg-standard',
        nameAr: 'باقة الزفة والدفوف التراثية (8 منشدات)',
        price: 7000,
        durationHours: 3.5,
        performersCount: 8,
        featuresAr: ['زفة دخول العروس مخصصة', 'طرب دفوف صافية', 'أغاني تراثية وخليجية', 'مهندسة صوت نسائية'],
      },
      {
        id: 'womens-pkg-royal',
        nameAr: 'الباقة الملكية الذهبية للسهرة كاملة (14 منشدة)',
        price: 13500,
        durationHours: 6,
        performersCount: 14,
        featuresAr: [
          'طاقم نسائي كامل 14 منشدة وكورال محترف',
          'زفتين دخول مسجلتين بإنتاج استوديو حصري هدية',
          'إحياء السهرة من الساعة 10 مساءً حتى نهاية الفرح',
          'أجهزة إضاءة ومؤثرات سحب الدخان البارد للزفة',
          'تنسيق مباشر مع أم العروس ومنسقة الحفل',
        ],
      },
    ],
  },
  {
    id: 'troupe-9',
    nameAr: 'فرقة شموخ نجران للقزوعي والزامل التراثي',
    leaderNameAr: 'المنسق والشاعر / سالم بن مانع اليامي',
    cityAr: 'نجران وظهران الجنوب',
    cityId: 'najran',
    regionKey: 'south',
    coverageAr: 'نجران، شرورة، عسير، والرياض',
    genreId: 'qazoui',
    genreNameAr: 'القزوعي والزامل والرزفة',
    badgeAr: 'وقار يام وهمدان الأصيل',
    badgeType: 'official',
    rating: 4.93,
    reviewsCount: 122,
    membersCountRange: '18 - 26 مؤدي',
    startingPrice: 5400,
    verifiedLicense: 'توثيق منصة العمل الحر فئة العروض الفلكلورية والمسرحية',
    instrumentsAr: ['دوي الأقدام الرنان (الرزف)', 'الزامل الصوتي الكورالي', 'الخناجر النجرانية الصيفية'],
    inclusionsAr: [
      'استقبال رسمي بزامل ترحيبي مهيب عند بوابة القاعة أو المخيم',
      'فقرة القزوعي الحماسي المتناسق بالأقدام والخناجر المذهبة',
      'إلقاء قصائد المدح والشهامة النبطية المنظومة خصيصاً للمناسبة',
      'مشاركة أهل المعرس وضيوفهم في صفوف الرزف والوقار',
    ],
    dressCodeAr: 'الثوب الأبيض والمذيل مع المحزم الجلدي العريض والجنبية النجرانية',
    sampleAudioTitle: 'زامل وقزوعي نجراني: يا ليل البها والنور',
    audioDuration: '04:30',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966509012345',
    phone: '+966 50 901 2345',
    packages: [
      {
        id: 'najran-pkg-standard',
        nameAr: 'باقة الزامل والقزوعي (18 مؤدي)',
        price: 5400,
        durationHours: 3,
        performersCount: 18,
        featuresAr: ['زامل المدخل', 'صفوف القزوعي الحماسية', 'قصائد نبطية ترحيبية', 'الزي النجراني الأصيل'],
      },
      {
        id: 'najran-pkg-vip',
        nameAr: 'باقة شموخ نجران الملكية (26 مؤدي)',
        price: 8200,
        durationHours: 5,
        performersCount: 26,
        featuresAr: [
          '26 مؤدي بالخناجر المذهبة والمحازم المطرزة',
          '3 زوامل ترحيبية مهيبة لكبار الوفود والقبائل',
          'رزفة واستعراض مطول لأهل الحفل والضيوف',
          'مباخر الجاوي والعود الأزرق النجراني الملكي',
        ],
      },
    ],
  },
  {
    id: 'troupe-10',
    nameAr: 'فرقة العلا التراثية لفن الرفيحي والسامري',
    leaderNameAr: 'المنشد / فهد بن مسلم البلوي',
    cityAr: 'العلا وتبوك',
    cityId: 'alula',
    regionKey: 'north',
    coverageAr: 'العلا، خيبر، تبوك، تيماء، والمدينة المنورة',
    genreId: 'rufaihi',
    genreNameAr: 'الرفيحي والسامري العلاوي',
    badgeAr: 'نغم الحجر والتراث العريق',
    badgeType: 'unesco',
    rating: 4.90,
    reviewsCount: 98,
    membersCountRange: '12 - 16 مؤدي',
    startingPrice: 4600,
    verifiedLicense: 'ترخيص هيئة التراث والفعاليات الثقافية',
    instrumentsAr: ['الدفوف الخفيفة', 'المرواس', 'التصفيق الرفاعي المتلاحق'],
    inclusionsAr: [
      'استعراض فن الرفيحي السريع والرشيق بتناغم استثنائي',
      'أبيات نبطية تتغنى بجمال العلا وتاريخ الحجر والمملكة',
      'فقرة سامري خفيف ملائم لجلسات المخيمات والقاعات',
      'تناغم حركي خفيف ومبهج يرفع طاقة الحفل',
    ],
    dressCodeAr: 'الثوب السعودي التراثي والمحزم الجلدي الخفيف والشماغ المهدب',
    sampleAudioTitle: 'رفيحي العلا التراثي: يا ساري في دجى الليل',
    audioDuration: '04:40',
    image: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&auto=format&fit=crop&q=80',
    whatsappPhone: '966500123456',
    phone: '+966 50 012 3456',
    packages: [
      {
        id: 'alula-pkg-standard',
        nameAr: 'باقة الرفيحي الأصيل (12 مؤدي)',
        price: 4600,
        durationHours: 2.5,
        performersCount: 12,
        featuresAr: ['12 مؤدي رفيحي', 'تصفيق إيقاعي سريع', 'قصائد تراث العلا', 'مشاركة الحضور'],
      },
      {
        id: 'alula-pkg-deluxe',
        nameAr: 'سهرة ليالي العلا التراثية الشاملة (16 مؤدي)',
        price: 6900,
        durationHours: 4.5,
        performersCount: 16,
        featuresAr: [
          '16 مؤدي ومنشد',
          'دمج بين الرفيحي السريع وسامري العلا الهادئ',
          'ضيافة التمر العلاوي والقهوة بالهيل والزعفران',
          'تسجيل فيديو تذكاري احترافي لفقرة الفرقة',
        ],
      },
    ],
  },
];

// ==========================================
// 4. MAIN PAGE COMPONENT
// ==========================================

export default function ZaffahPage() {
  const { occasions, activeOccasion, addToCart } = useApp();

  // Top Tabs: 'arts' (مكتبة الفنون والفرق) vs 'generator' (مولد الزفات)
  const [activeTab, setActiveTab] = useState<'arts' | 'generator'>('arts');

  // Sub View Switcher inside 'arts': 'genres' (ألوان الفنون) vs 'troupes' (الفرق الشعبية)
  const [subView, setSubView] = useState<'genres' | 'troupes'>('genres');

  // Region Filter: 'all', 'central', 'west', 'south', 'east', 'north', 'womens'
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Audio Playback Simulation State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rhythmIntervalRef = useRef<any>(null);

  // Selected Troupe for Booking Modal
  const [selectedTroupeForBooking, setSelectedTroupeForBooking] = useState<FolkTroupe | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('2026-10-15');
  const [bookingCity, setBookingCity] = useState<string>('الرياض');
  const [cartSuccessNotice, setCartSuccessNotice] = useState<string | null>(null);

  // AI Zaffah Generator State
  const [brideName, setBrideName] = useState<string>('سارة');
  const [groomName, setGroomName] = useState<string>('عبدالرحمن');
  const [familyName, setFamilyName] = useState<string>('آل سعود / المقرن');
  const [occasionCity, setOccasionCity] = useState<string>('الرياض');
  const [zaffahStyle, setZaffahStyle] = useState<'royal' | 'traditional' | 'modern' | 'poetic'>('royal');
  const [generatedPoem, setGeneratedPoem] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // ----------------------------------------------------
  // Native Percussion Audio Synthesizer (Web Audio API)
  // Generates real rhythmic authentic percussion in the browser!
  // ----------------------------------------------------
  const playSyntheticPercussionBeat = (bpm: number = 96, isHeavy: boolean = false) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (isMuted) return;

      // Primary Bass Drum (Dumm)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isHeavy ? 110 : 130, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.28);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.32);

      // Secondary High Snare / Clap (Tak) with slight delay
      setTimeout(() => {
        try {
          if (!audioCtxRef.current || isMuted) return;
          const ctx2 = audioCtxRef.current;
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(340, ctx2.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(80, ctx2.currentTime + 0.12);

          gain2.gain.setValueAtTime(0.18, ctx2.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.14);

          osc2.connect(gain2);
          gain2.connect(ctx2.destination);

          osc2.start();
          osc2.stop(ctx2.currentTime + 0.15);
        } catch {
          // ignore web audio limitations
        }
      }, 220);
    } catch {
      // safe fallback if audio context blocked by browser autoplay policy
    }
  };

  const togglePlay = (id: string, bpm: number = 96, isHeavy: boolean = false) => {
    if (playingId === id) {
      // Pause
      setPlayingId(null);
      if (rhythmIntervalRef.current) {
        clearInterval(rhythmIntervalRef.current);
        rhythmIntervalRef.current = null;
      }
    } else {
      // Play
      if (rhythmIntervalRef.current) {
        clearInterval(rhythmIntervalRef.current);
      }
      setPlayingId(id);

      // Trigger first beat immediately
      playSyntheticPercussionBeat(bpm, isHeavy);

      // Loop rhythm based on BPM
      const intervalMs = Math.round((60 / bpm) * 1000);
      rhythmIntervalRef.current = setInterval(() => {
        playSyntheticPercussionBeat(bpm, isHeavy);
      }, intervalMs);
    }
  };

  // Cleanup audio on unmount or tab switch
  useEffect(() => {
    return () => {
      if (rhythmIntervalRef.current) {
        clearInterval(rhythmIntervalRef.current);
      }
    };
  }, []);

  // Filter Folk Genres
  const filteredGenres = FOLK_GENRES.filter((genre) => {
    const matchesRegion = selectedRegion === 'all' || genre.regionKey === selectedRegion;
    const matchesQuery = 
      !searchQuery ||
      genre.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      genre.regionAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      genre.instrumentsAr.some((inst) => inst.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRegion && matchesQuery;
  });

  // Filter Folk Troupes
  const filteredTroupes = FOLK_TROUPES.filter((troupe) => {
    const matchesRegion = selectedRegion === 'all' || troupe.regionKey === selectedRegion;
    const matchesQuery =
      !searchQuery ||
      troupe.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      troupe.leaderNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      troupe.cityAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      troupe.genreNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      troupe.instrumentsAr.some((inst) => inst.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRegion && matchesQuery;
  });

  // Open Troupe Booking Modal
  const handleOpenBookingModal = (troupe: FolkTroupe) => {
    setSelectedTroupeForBooking(troupe);
    setSelectedPackageId(troupe.packages[0]?.id || '');
    setBookingCity(troupe.cityAr);
  };

  // Confirm Troupe Booking & Add to Cart
  const handleAddToCart = () => {
    if (!selectedTroupeForBooking) return;
    const selectedPkg = selectedTroupeForBooking.packages.find((p) => p.id === selectedPackageId) || selectedTroupeForBooking.packages[0];

    const cartItemData: CartItem = {
      id: `cart-item-${Date.now()}`,
      vendorId: selectedTroupeForBooking.id,
      vendorName: selectedTroupeForBooking.nameAr,
      vendorLogo: selectedTroupeForBooking.image,
      cityId: selectedTroupeForBooking.cityId,
      cityNameAr: selectedTroupeForBooking.cityAr,
      serviceId: `srv-${selectedTroupeForBooking.id}`,
      serviceTitleAr: `${selectedTroupeForBooking.genreNameAr} - ${selectedTroupeForBooking.nameAr}`,
      serviceImage: selectedTroupeForBooking.image,
      packageId: selectedPkg.id,
      packageNameAr: selectedPkg.nameAr,
      selectedPackage: {
        id: selectedPkg.id,
        nameAr: selectedPkg.nameAr,
        tier: 'standard',
        price: selectedPkg.price,
        durationHours: selectedPkg.durationHours,
        featuresAr: selectedPkg.featuresAr,
      },
      packagePrice: selectedPkg.price,
      basePrice: selectedPkg.price,
      totalPrice: selectedPkg.price,
      addons: [],
      selectedAddons: [],
      addonsTotal: 0,
      quantity: 1,
      scheduledDate: bookingDate,
      scheduleDate: bookingDate,
      scheduledTime: '20:00',
      scheduleTime: '20:00',
      notes: `حجز الفرقة التراثية: ${selectedTroupeForBooking.nameAr} - ${selectedPkg.nameAr}`,
      subtotal: selectedPkg.price,
      taxAmount: Math.round(selectedPkg.price * 0.15),
      totalAmount: Math.round(selectedPkg.price * 1.15),
    };

    addToCart(cartItemData);
    setCartSuccessNotice(`تمت إضافة "${selectedTroupeForBooking.nameAr}" إلى سلة المشتريات بنجاح!`);
    setTimeout(() => {
      setCartSuccessNotice(null);
      setSelectedTroupeForBooking(null);
    }, 2000);
  };

  // AI Zaffah Generator Submission
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
    <div className="min-h-screen bg-neutral-50/50 dark:bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ========================================== */}
        {/* 1. HERO TITLE BANNER                       */}
        {/* ========================================== */}
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-950 text-white border border-amber-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/40">
              <Music className="w-3.5 h-3.5" />
              <span>موسوعة الفنون التراثية والفرق الشعبية السعودية 🇸🇦</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight font-cairo">
              أصالة العرضة، نغم السامري، وزفات تليق بليلة العمر
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
              استكشف ألوان الفنون الشعبية من كافة مناطق المملكة (نجد، الحجاز، الجنوب، الشرقية، والشمال)، استمع لنبضات الإيقاع التراثي الحي، واحجز أفضل الفرق الشعبية المعتمدة بتراخيص رسمية وضمان من منصة مناسبتي.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-bold bg-white/5 py-1.5 px-3.5 rounded-full border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>فرق معتمدة بسجلات تجارية وتراخيص هيئة الموسيقى</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-300 bg-white/5 py-1.5 px-3.5 rounded-full border border-white/10">
                <Users className="w-4 h-4 text-amber-400" />
                <span>+150 فرقة فلكلورية مسجلة بكافة المدن</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. MAIN TABS SWITCHER                      */}
        {/* ========================================== */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              onClick={() => setActiveTab('arts')}
              className={`py-2.5 px-5 rounded-2xl transition flex items-center gap-2 ${
                activeTab === 'arts'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>مكتبة الفنون والفرق الشعبية</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-neutral-950 font-black">
                {FOLK_GENRES.length + FOLK_TROUPES.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`py-2.5 px-5 rounded-2xl transition flex items-center gap-2 ${
                activeTab === 'generator'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>مُولّد نصوص وقصائد الزفة بالذكاء الاصطناعي</span>
            </button>
          </div>

          <Link
            href="/marketplace?cat=zaffah"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>الانتقال لكامل سوق الزفات والموسيقى</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* ========================================== */}
        {/* TAB 1: مكتبة الفنون والفرق الشعبية         */}
        {/* ========================================== */}
        {activeTab === 'arts' && (
          <div className="space-y-6">

            {/* Sub-View Switcher + Search + Audio Mute */}
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Switch between Genres and Troupes */}
                <div className="inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80">
                  <button
                    onClick={() => setSubView('genres')}
                    className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      subView === 'genres'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🎭 ألوان الفنون التراثية</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 font-bold">
                      {FOLK_GENRES.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setSubView('troupes')}
                    className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      subView === 'troupes'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <span>👥 الفرق الشعبية المعتمدة للحجز</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-bold">
                      {FOLK_TROUPES.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={subView === 'genres' ? 'ابحث عن لون تراثي أو آلة موسيقية...' : 'ابحث باسم الفرقة، رئيس الفرقة، أو المدينة...'}
                    className="w-full pr-10 pl-4 py-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sound control button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition ${
                    isMuted
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                  title={isMuted ? 'إلغاء كتم الإيقاع' : 'كتم الإيقاع التفاعلي'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
                  <span className="hidden sm:inline">{isMuted ? 'الصوت مكتوم' : 'إيقاع حي مفعّل'}</span>
                </button>
              </div>

              {/* Regional Pills Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
                <span className="text-[11px] font-bold text-neutral-400 pl-2 shrink-0">تصفية حسب المنطقة:</span>
                {[
                  { id: 'all', label: 'كافة المناطق 🇸🇦' },
                  { id: 'central', label: 'نجد والوسطى 🏛️' },
                  { id: 'west', label: 'الحجاز والغربية 🌴' },
                  { id: 'south', label: 'عسير والجنوب ⛰️' },
                  { id: 'east', label: 'الأحساء والشرقية 🌊' },
                  { id: 'north', label: 'تبوك والشمال 🦅' },
                  { id: 'womens', label: 'الدفوف والزفات النسائية 👑' },
                ].map((region) => (
                  <button
                    key={region.id}
                    onClick={() => setSelectedRegion(region.id)}
                    className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition ${
                      selectedRegion === region.id
                        ? 'bg-amber-500 text-neutral-950 shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {region.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Toast */}
            {cartSuccessNotice && (
              <div className="p-4 rounded-2xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-between shadow-xl animate-bounce">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{cartSuccessNotice}</span>
                </div>
                <Link href="/cart" className="underline text-xs bg-white/20 py-1 px-3 rounded-lg hover:bg-white/30">
                  عرض السلة
                </Link>
              </div>
            )}

            {/* ========================================== */}
            {/* SUB-VIEW 1: FOLK ART GENRES CARDS         */}
            {/* ========================================== */}
            {subView === 'genres' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGenres.map((genre) => {
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
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                          <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold shadow-md ${genre.badgeColor || 'bg-amber-500 text-neutral-950'}`}>
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

                          {/* Historical Significance Pill */}
                          <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                            <span className="font-bold ml-1">📜 الأصل التاريخي:</span>
                            {genre.historicalSignificanceAr}
                          </div>

                          {/* Audio Track Bar with live synth */}
                          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => togglePlay(genre.id, genre.rhythmBpm, genre.id === 'ardah' || genre.id === 'dahha')}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                  isPlaying
                                    ? 'bg-amber-500 text-neutral-950 shadow-md scale-105 animate-pulse'
                                    : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:scale-105'
                                }`}
                                title={isPlaying ? 'إيقاف الإيقاع' : 'تشغيل نبض الإيقاع الحي'}
                              >
                                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current mr-0.5" />}
                              </button>

                              <div className="flex-1 mx-3">
                                <span className="text-[11px] font-bold text-neutral-900 dark:text-white block truncate">
                                  {genre.sampleTitle}
                                </span>
                                {/* Animated waveform when playing */}
                                <div className="flex items-center gap-0.5 mt-1.5 h-3">
                                  {[10, 24, 16, 28, 14, 22, 10, 26, 16, 20, 30, 14, 22, 18].map((h, i) => (
                                    <div
                                      key={i}
                                      className={`w-1 rounded-full transition-all duration-150 ${
                                        isPlaying
                                          ? 'bg-amber-500 animate-pulse'
                                          : 'bg-neutral-300 dark:bg-neutral-700'
                                      }`}
                                      style={{ height: isPlaying ? `${Math.max(4, (h * (i % 2 === 0 ? 1 : 0.7)))}px` : '4px' }}
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

                          {/* Dress Code Tag */}
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 p-2 rounded-xl">
                            <span className="font-bold text-neutral-700 dark:text-neutral-300 ml-1">👗 الزي التراثي:</span>
                            {genre.dressCodeAr}
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

                        <button
                          onClick={() => {
                            setSubView('troupes');
                            setSelectedRegion(genre.regionKey);
                          }}
                          className="py-2 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-bold shadow-sm transition"
                        >
                          استعراض الفرق ({genre.troupeCount})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================== */}
            {/* SUB-VIEW 2: FOLK TROUPES DIRECTORY        */}
            {/* ========================================== */}
            {subView === 'troupes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>تم العثور على <strong>{filteredTroupes.length}</strong> فرقة شعبية معتمدة ومسجلة</span>
                  <span className="text-emerald-600 font-bold">✓ جميع الفرق تملك تراخيص وسجلات موثقة</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredTroupes.map((troupe) => {
                    const isPlaying = playingId === troupe.id;

                    return (
                      <div
                        key={troupe.id}
                        className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="p-6 space-y-4">
                          {/* Top Row: Avatar + Title + Badges */}
                          <div className="flex items-start gap-4">
                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-700 bg-neutral-800">
                              <img
                                src={troupe.image}
                                alt={troupe.nameAr}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  <Award className="w-3 h-3" />
                                  {troupe.badgeAr}
                                </span>

                                <div className="flex items-center gap-1 text-xs font-bold text-neutral-900 dark:text-white">
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                                  <span>{troupe.rating}</span>
                                  <span className="text-[10px] text-neutral-400 font-normal">({troupe.reviewsCount})</span>
                                </div>
                              </div>

                              <h3 className="text-base font-black text-neutral-900 dark:text-white truncate font-cairo">
                                {troupe.nameAr}
                              </h3>

                              <div className="text-xs text-neutral-500 flex items-center gap-2">
                                <span>{troupe.leaderNameAr}</span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <MapPin className="w-3 h-3" />
                                  {troupe.cityAr}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* License badge */}
                          <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-[11px] text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="truncate">{troupe.verifiedLicense}</span>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                              <span className="text-[10px] text-neutral-400 block">عدد المؤدين والعارضين:</span>
                              <span className="font-bold text-neutral-900 dark:text-white">{troupe.membersCountRange}</span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                              <span className="text-[10px] text-neutral-400 block">نطاق التغطية:</span>
                              <span className="font-bold text-neutral-900 dark:text-white truncate block">{troupe.coverageAr}</span>
                            </div>
                          </div>

                          {/* Troupe Inclusions Preview */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-neutral-400 block">ما تتضمنه باقة الفرقة:</span>
                            <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                              {troupe.inclusionsAr.slice(0, 3).map((inc, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate">{inc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Audio Demo Bar */}
                          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-700/70 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => togglePlay(troupe.id, 92, troupe.genreId === 'ardah')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isPlaying
                                  ? 'bg-amber-500 text-neutral-950 shadow-md scale-105'
                                  : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                              }`}
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current mr-0.5" />}
                            </button>

                            <div className="flex-1 mx-3 min-w-0">
                              <span className="text-[11px] font-bold text-neutral-900 dark:text-white truncate block">
                                {troupe.sampleAudioTitle}
                              </span>
                              <span className="text-[10px] text-neutral-400">عينة أداء حي ومباشر</span>
                            </div>

                            <span className="text-[10px] font-mono text-neutral-400">{troupe.audioDuration}</span>
                          </div>
                        </div>

                        {/* Footer Price & Booking CTA */}
                        <div className="p-6 pt-0 border-t border-neutral-100 dark:border-neutral-800/60 mt-2 flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] text-neutral-400 block">السعر يبدأ من</span>
                            <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                              {formatSaudiRiyal(troupe.startingPrice)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`https://wa.me/${troupe.whatsappPhone}?text=${encodeURIComponent(`السلام عليكم، أرغب بالاستفسار عن حجز فرقة (${troupe.nameAr}) عبر منصة مناسبتي.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition"
                              title="تواصل فوري عبر واتساب"
                            >
                              <MessageCircle className="w-4 h-4 text-emerald-500" />
                            </a>

                            <button
                              onClick={() => handleOpenBookingModal(troupe)}
                              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>طلب حجز الفرقة</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: AI ZAFFHA POEM GENERATOR            */}
        {/* ========================================== */}
        {activeTab === 'generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Input Form Column (6 cols) */}
            <div className="lg:col-span-6 bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white font-cairo">
                    تخصيص وكتابة نص وقصيدة الزفة بالذكاء الاصطناعي
                  </h3>
                </div>
                <p className="text-xs text-neutral-500">
                  أدخل أسماء العروسين والعائلة والمدينة لتوليد نص زفة سعودي موزون مخصص لحفلتكم لتسليمه لمهندس الصوت أو الفرقة.
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

        {/* ========================================== */}
        {/* 5. MODAL: TROUPE BOOKING & PACKAGE DETAILS */}
        {/* ========================================== */}
        {selectedTroupeForBooking && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800 shadow-2xl">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-800 shrink-0">
                    <img
                      src={selectedTroupeForBooking.image}
                      alt={selectedTroupeForBooking.nameAr}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white font-cairo">
                      {selectedTroupeForBooking.nameAr}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {selectedTroupeForBooking.leaderNameAr} • {selectedTroupeForBooking.cityAr}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTroupeForBooking(null)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Package Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                  اختر باقة الفرقة المناسبة لحفلتك:
                </label>
                <div className="space-y-2">
                  {selectedTroupeForBooking.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedPackageId === pkg.id
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">{pkg.nameAr}</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatSaudiRiyal(pkg.price)}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mb-2">
                        المدة: {pkg.durationHours} ساعات • عدد المؤدين: {pkg.performersCount} عارض
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pkg.featuresAr.map((f, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                            ✓ {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Date and City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    تاريخ المناسبة
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    مدينة الحفل
                  </label>
                  <select
                    value={bookingCity}
                    onChange={(e) => setBookingCity(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                  >
                    <option value="الرياض">الرياض</option>
                    <option value="جدة">جدة</option>
                    <option value="مكة المكرمة">مكة المكرمة</option>
                    <option value="المدينة المنورة">المدينة المنورة</option>
                    <option value="الدمام والخبر">الدمام والخبر</option>
                    <option value="الأحساء">الأحساء</option>
                    <option value="القصيم">القصيم</option>
                    <option value="أبها وعسير">أبها وعسير</option>
                    <option value="تبوك">تبوك</option>
                    <option value="العلا">العلا</option>
                    <option value="نجران">نجران</option>
                  </select>
                </div>
              </div>

              {/* Trust badges */}
              <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>ضمان منصة مناسبتي للحجوزات الفلكلورية:</span>
                </div>
                <p className="text-[10px] leading-relaxed">
                  حجزك مؤمّن بنظام الضمان المالي السعودي (Escrow)؛ لا يتم تحويل المبلغ للفرقة إلا بعد إتمام العرض في ليلة الفرح بنجاح ورضاكم التام.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>تأكيد وإضافة الفرقة إلى السلة</span>
                </button>

                <a
                  href={`https://wa.me/${selectedTroupeForBooking.whatsappPhone}?text=${encodeURIComponent(`السلام عليكم، أود التنسيق لحجز فرقة (${selectedTroupeForBooking.nameAr}) لتاريخ ${bookingDate} في مدينة ${bookingCity}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  <span>واتساب الفرقة</span>
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
