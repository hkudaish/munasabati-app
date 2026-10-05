'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ShoppingBag,
  Star,
  ShieldCheck,
  Zap,
  ArrowLeftRight,
  Eye,
  Check,
  AlertCircle,
  TrendingUp,
  Tag,
  ThumbsUp,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSaudiRiyal, ensureServiceDetails, ensureVendorDetails } from '@/lib/utils';
import { rankVendors, checkAvailability } from '@/lib/ranking-engine';
import { VendorRecommendationResult, VendorRecommendationCriteria, RankingWeights } from '@/lib/types';
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

interface ChatMessage {
  id: string;
  sender: 'user' | 'luma';
  text: string;
  timestamp: string;
  intent?: string;
  candidates?: VendorRecommendationResult[];
  comparisonCandidates?: VendorRecommendationResult[];
  actionType?: 'add_to_cart_success' | 'plan_generated' | 'none';
  actionData?: any;
}

export default function LumaAIDrawer() {
  const router = useRouter();
  const {
    isAIOpen,
    setIsAIOpen,
    createOccasion,
    adminConfig,
    packages,
    cities,
    vendors,
    services,
    cart,
    addToCart,
    comparisonVendorIds,
    addToComparison,
    rankingWeights,
  } = useApp();

  const [activeMode, setActiveMode] = useState<'shopping' | 'planner'>('shopping');
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedItemNotification, setAddedItemNotification] = useState<string | null>(null);

  // Shopping Assistant Conversation State & Context
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'luma',
      text: 'أهلاً بك! أنا **لُـمى**، مساعدتك الذكية لاكتشاف أفضل الموردين والخدمات الموثوقة لمناسبتك في المملكة 🇸🇦.\n\nكيف يمكنني مساعدتك اليوم؟ يمكنك إخباري باحتياجك وميزانيتك ومدينتك وسأرشح لك أفضل الخيارات وأقارنها وأضيفها لسلتك مباشرة!',
      timestamp: 'الآن',
      intent: 'WELCOME',
    },
  ]);

  // Context memory of current active candidates
  const [activeCandidatesContext, setActiveCandidatesContext] = useState<VendorRecommendationResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Occasion planner state (preserved from previous version)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);

  useEffect(() => {
    if (isAIOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAIOpen]);

  // Quick prompt suggestions
  const shoppingPrompts = [
    'أحتاج مصور زواج احترافي بالرياض الجمعة القادمة',
    'أريد مورد كوشة وضيافة بميزانية أقل من 5000 ريال',
    'رشح لي أفضل الموردين تقييماً في جدة',
    'أريد أرخص خيار متاح لتنسيق الورد',
    'قارن لي بين أفضل مصورين',
  ];

  const plannerPrompts = [
    'أبغى حفلة تخرج بالرياض لـ 80 شخص وميزانيتي 15 ألف',
    'أبغى ملكة منزلية بسيطة بجدة لـ 50 شخص وميزانيتي 20 ألف',
    'زواج فخم لـ 200 شخص بالرياض بميزانية 50 ألف',
  ];

  // Helper to extract criteria from text
  const extractCriteriaFromText = (
    text: string,
    previousContext: VendorRecommendationResult[] = []
  ): {
    criteria: VendorRecommendationCriteria;
    intent: string;
    targetIndexes?: number[];
  } => {
    const lower = text.toLowerCase();
    let intent = 'SEARCH_VENDOR';
    let categoryId: string | undefined = undefined;
    let cityId: string | undefined = undefined;
    let maxPrice: number | undefined = undefined;
    let minRating: number | undefined = undefined;
    let verifiedOnly = false;
    let date: string | undefined = undefined;
    let sortPreference: 'recommended' | 'cheapest' | 'best_rated' | 'fastest' | 'nearest' | 'best_value' =
      'recommended';
    let occasionTypeId: string | undefined = undefined;

    // Detect Comparison intent
    if (lower.includes('قارن') || lower.includes('مقارنة') || lower.includes('مين أفضل')) {
      intent = 'COMPARE_VENDORS';
      // Detect indexes like "الأول والثاني" or "الأول والثالث"
      const indexes: number[] = [];
      if (lower.includes('الأول') || lower.includes('الاول') || lower.includes('1')) indexes.push(0);
      if (lower.includes('الثاني') || lower.includes('الثاني') || lower.includes('2')) indexes.push(1);
      if (lower.includes('الثالث') || lower.includes('3')) indexes.push(2);
      if (lower.includes('الرابع') || lower.includes('4')) indexes.push(3);
      return {
        criteria: {},
        intent: 'COMPARE_VENDORS',
        targetIndexes: indexes.length >= 2 ? indexes : [0, 1],
      };
    }

    // Detect Add to Cart intent
    if (
      lower.includes('أضف للسلة') ||
      lower.includes('اضف للسلة') ||
      lower.includes('اضف الى السلة') ||
      lower.includes('احجز') ||
      lower.includes('اشتري')
    ) {
      let targetIndex = 0;
      if (lower.includes('الثاني') || lower.includes('2')) targetIndex = 1;
      if (lower.includes('الثالث') || lower.includes('3')) targetIndex = 2;
      return {
        criteria: {},
        intent: 'ADD_TO_CART',
        targetIndexes: [targetIndex],
      };
    }

    // Detect Checkout intent
    if (lower.includes('الدفع') || lower.includes('إتمام الطلب') || lower.includes('السلة')) {
      return {
        criteria: {},
        intent: 'VIEW_CART',
      };
    }

    // Sort Preference Detection
    if (lower.includes('أرخص') || lower.includes('ارخص') || lower.includes('أقل سعر') || lower.includes('الأرخص')) {
      sortPreference = 'cheapest';
      intent = 'SORT_RESULTS';
    } else if (
      lower.includes('أفضل تقييم') ||
      lower.includes('الاعلى تقييم') ||
      lower.includes('الأعلى تقييماً') ||
      lower.includes('أفضل')
    ) {
      sortPreference = 'best_rated';
      intent = 'SORT_RESULTS';
    } else if (lower.includes('أسرع') || lower.includes('اسرع') || lower.includes('الرد السريع')) {
      sortPreference = 'fastest';
      intent = 'SORT_RESULTS';
    } else if (lower.includes('قيمة') || lower.includes('أفضل قيمة') || lower.includes('توفير')) {
      sortPreference = 'best_value';
      intent = 'SORT_RESULTS';
    } else if (lower.includes('الأقرب') || lower.includes('اقرب')) {
      sortPreference = 'nearest';
      intent = 'SORT_RESULTS';
    }

    // Category detection
    if (
      lower.includes('مصور') ||
      lower.includes('تصوير') ||
      lower.includes('كاميرا') ||
      lower.includes('فوتوغرافي') ||
      lower.includes('فيديو')
    ) {
      categoryId = 'photography';
    } else if (
      lower.includes('كوش') ||
      lower.includes('ديكور') ||
      lower.includes('ورد') ||
      lower.includes('زهور') ||
      lower.includes('تنسيق')
    ) {
      categoryId = 'decor';
    } else if (
      lower.includes('ضيافة') ||
      lower.includes('قهوجي') ||
      lower.includes('صباب') ||
      lower.includes('بوفيه') ||
      lower.includes('شاي') ||
      lower.includes('عشاء')
    ) {
      categoryId = 'hospitality';
    } else if (
      lower.includes('زفة') ||
      lower.includes('دي جي') ||
      lower.includes('فرقة') ||
      lower.includes('صوتيات') ||
      lower.includes('مطرب') ||
      lower.includes('عرضة')
    ) {
      categoryId = 'music';
    } else if (
      lower.includes('توزيعات') ||
      lower.includes('هدايا') ||
      lower.includes('عطور') ||
      lower.includes('عود') ||
      lower.includes('بخور')
    ) {
      categoryId = 'gifts';
    } else if (lower.includes('كيك') || lower.includes('حلا') || lower.includes('شوكولاته')) {
      categoryId = 'sweets';
    }

    // Occasion Type detection
    if (lower.includes('زواج') || lower.includes('عرس') || lower.includes('زفاف')) {
      occasionTypeId = 'wedding';
    } else if (lower.includes('ملكة') || lower.includes('خطوبة')) {
      occasionTypeId = 'melka';
    } else if (lower.includes('تخرج')) {
      occasionTypeId = 'graduation';
    } else if (lower.includes('مولود') || lower.includes('استقبال')) {
      occasionTypeId = 'newborn';
    }

    // City detection
    if (lower.includes('الرياض') || lower.includes('بالرياض')) {
      cityId = 'riyadh';
    } else if (lower.includes('جدة') || lower.includes('جده') || lower.includes('بجدة')) {
      cityId = 'jeddah';
    } else if (lower.includes('الدمام') || lower.includes('الخبر') || lower.includes('الشرقية')) {
      cityId = 'khobar';
    } else if (lower.includes('مكة') || lower.includes('بمكة')) {
      cityId = 'makkah';
    } else if (lower.includes('المدينة') || lower.includes('بالمدينة')) {
      cityId = 'madinah';
    }

    // Price extraction
    const budgetMatch = text.match(/(\d+)\s*(ألف|الف|k)/i);
    if (budgetMatch) {
      maxPrice = parseInt(budgetMatch[1], 10) * 1000;
    } else {
      const directNumberMatch = text.match(/(\d{3,6})/);
      if (directNumberMatch) {
        maxPrice = parseInt(directNumberMatch[1], 10);
      }
    }

    // Rating extraction
    if (lower.includes('4.5') || lower.includes('ممتاز')) {
      minRating = 4.5;
    } else if (lower.includes('4')) {
      minRating = 4.0;
    }

    // Verification check
    if (lower.includes('موثق') || lower.includes('معتمد')) {
      verifiedOnly = true;
    }

    // Date extraction (e.g. الجمعة القادمة)
    if (lower.includes('الجمعة') || lower.includes('السبت') || lower.includes('تاريخ')) {
      date = '2026-10-09'; // deterministic upcoming Friday date
    }

    return {
      criteria: {
        categoryId,
        cityId,
        maxPrice,
        minRating,
        verifiedOnly,
        date,
        sortPreference,
        occasionTypeId,
      },
      intent,
    };
  };

  // Main Handler for Luma Shopping Assistant
  const handleShoppingQuery = (queryText: string) => {
    if (!queryText.trim()) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: 'الآن',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsProcessing(true);

    setTimeout(() => {
      const { criteria, intent, targetIndexes } = extractCriteriaFromText(
        queryText,
        activeCandidatesContext
      );

      // 1. ADD TO CART INTENT
      if (intent === 'ADD_TO_CART') {
        const targetIdx = targetIndexes?.[0] ?? 0;
        const candidate = activeCandidatesContext[targetIdx] || activeCandidatesContext[0];

        if (candidate && candidate.primaryService) {
          const srv = candidate.primaryService;
          const srvDetails = ensureServiceDetails(srv);
          const pkg = srvDetails.packages[0] || {
            id: 'basic',
            nameAr: 'الباقة الأساسية',
            price: srv.price,
            featuresAr: srv.featuresAr,
            durationHours: 4,
          };

          addToCart(srv, pkg, [], {
            date: '2026-10-09',
            time: '18:00',
            locationCity: srv.cityNameAr,
            notes: 'أضيف عبر مساعد لُـمى الذكي',
          });

          setAddedItemNotification(`تمت إضافة "${srv.titleAr}" إلى سلتك بنجاح! 🛍️`);
          setTimeout(() => setAddedItemNotification(null), 4000);

          try {
            confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
          } catch {}

          const lumaReply: ChatMessage = {
            id: `lum_${Date.now()}`,
            sender: 'luma',
            text: `أبشر! تمت إضافة **${srv.titleAr}** من **${candidate.vendor.businessName}** إلى سلتك بنجاح بسعر **${formatSaudiRiyal(pkg.price)}**.\n\nهل ترغب في استعراض السلة وإتمام الحجز، أو استكشاف خدمات مكملة (مثل الضيافة أو التوزيعات)؟`,
            timestamp: 'الآن',
            intent: 'ADD_TO_CART_SUCCESS',
            actionType: 'add_to_cart_success',
            actionData: {
              serviceId: srv.id,
              serviceTitle: srv.titleAr,
              vendorName: candidate.vendor.businessName,
              price: pkg.price,
            },
          };
          setMessages((prev) => [...prev, lumaReply]);
          setIsProcessing(false);
          return;
        } else {
          const lumaReply: ChatMessage = {
            id: `lum_${Date.now()}`,
            sender: 'luma',
            text: 'لم أتمكن من تحديد الخدمة المراد إضافتها بدقة. يرجى اختيار أحد الموردين أدناه بالنقر على زر "أضف للسلة".',
            timestamp: 'الآن',
          };
          setMessages((prev) => [...prev, lumaReply]);
          setIsProcessing(false);
          return;
        }
      }

      // 2. COMPARE VENDORS INTENT
      if (intent === 'COMPARE_VENDORS') {
        const pool = activeCandidatesContext.length >= 2 ? activeCandidatesContext : rankVendors(vendors, services, {}, rankingWeights);
        const idx1 = targetIndexes?.[0] ?? 0;
        const idx2 = targetIndexes?.[1] ?? 1;
        const compCandidates = [pool[idx1] || pool[0], pool[idx2] || pool[1]].filter(Boolean);

        // Also add them to global comparison store
        compCandidates.forEach((c) => addToComparison(c.vendor.id));

        const c1 = compCandidates[0];
        const c2 = compCandidates[1];

        const textResponse = `إليك مقارنة مباشرة بين:\n\n**1. ${c1.vendor.businessName}** (تقييم ${c1.vendor.rating} ★ | السعر يبدأ من ${formatSaudiRiyal(c1.primaryService?.price || 0)})\n**2. ${c2.vendor.businessName}** (تقييم ${c2.vendor.rating} ★ | السعر يبدأ من ${formatSaudiRiyal(c2.primaryService?.price || 0)})\n\n💡 **تحليل لُـمى:** ${
          c1.vendor.rating > c2.vendor.rating
            ? `${c1.vendor.businessName} يتفوق في التقييم وسرعة الرد.`
            : `${c2.vendor.businessName} يقدم ميزة تنافسية أعلى.`
        }`;

        const lumaReply: ChatMessage = {
          id: `lum_${Date.now()}`,
          sender: 'luma',
          text: textResponse,
          timestamp: 'الآن',
          intent: 'COMPARE_VENDORS',
          comparisonCandidates: compCandidates,
        };

        setMessages((prev) => [...prev, lumaReply]);
        setIsProcessing(false);
        return;
      }

      // 3. VIEW CART INTENT
      if (intent === 'VIEW_CART') {
        const lumaReply: ChatMessage = {
          id: `lum_${Date.now()}`,
          sender: 'luma',
          text: `سلتك تحتوي حالياً على **${cart.reduce((sum, i) => sum + i.quantity, 0)} خدمات**.\nيمكنك الانتقال لصفحة السلة لمراجعة الباقات وإتمام الدفع الآمن.`,
          timestamp: 'الآن',
          actionType: 'none',
        };
        setMessages((prev) => [...prev, lumaReply]);
        setIsProcessing(false);
        return;
      }

      // 4. RETRIEVAL & RANKING INTENT (Search, Filter, Sort, Ask)
      // Check if user is asking to sort "بينهم" (refining current context)
      let effectiveCriteria = { ...criteria };
      if (
        (queryText.includes('بينهم') || queryText.includes('منهم') || queryText.includes('أرخص')) &&
        activeCandidatesContext.length > 0 &&
        !criteria.categoryId
      ) {
        // preserve current category and city if already set
        const prevCategory = activeCandidatesContext[0]?.primaryService?.categoryId;
        const prevCity = activeCandidatesContext[0]?.vendor?.cityId;
        effectiveCriteria.categoryId = prevCategory;
        effectiveCriteria.cityId = prevCity;
      }

      const rankedResults = rankVendors(vendors, services, effectiveCriteria, rankingWeights);
      const topResults = rankedResults.slice(0, 4);
      setActiveCandidatesContext(topResults);

      let responseText = '';
      if (topResults.length === 0) {
        responseText =
          'لم أجد موردين يطابقون هذه المعايير بدقة في قاعدة بياناتنا الموثوقة. هل تود البحث في مدينة أخرى أو توسيع نطاق الميزانية؟';
      } else {
        const sortLabel =
          criteria.sortPreference === 'cheapest'
            ? 'الأقل سعراً'
            : criteria.sortPreference === 'best_rated'
            ? 'الأعلى تقييماً'
            : criteria.sortPreference === 'best_value'
            ? 'أفضل قيمة'
            : 'الأعلى ملاءمة';

        responseText = `وجدت لك **${rankedResults.length} موردين معتمدين**، ورتبت لك الخيارات بحسب **${sortLabel}**:\n\nلقد تحققت من توفر المواعيد والأسعار الحقيقية من الموردين مباشرة لضمان أعلى موثوقية! ✨`;
      }

      const lumaReply: ChatMessage = {
        id: `lum_${Date.now()}`,
        sender: 'luma',
        text: responseText,
        timestamp: 'الآن',
        intent: 'SEARCH_RESULTS',
        candidates: topResults,
      };

      setMessages((prev) => [...prev, lumaReply]);
      setIsProcessing(false);
    }, 850);
  };

  // Planner Handler (Legacy compatibility)
  const handleAnalyzePlanner = (queryText: string) => {
    if (!queryText.trim()) return;
    setIsProcessing(true);
    setGeneratedPlan(null);

    setTimeout(() => {
      let occasionTypeId = 'graduation';
      let occasionTitle = 'حفلة تخرج مباركة';
      let cityId = 'riyadh';
      let cityNameAr = 'الرياض';
      let guestCount = 60;
      let budget = 15000;
      let tier: 'economy' | 'medium' | 'luxury' | 'ultra_luxury' = 'medium';

      const lower = queryText.toLowerCase();

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
      } else if (lower.includes('تخرج')) {
        occasionTypeId = 'graduation';
        occasionTitle = 'حفلة تخرج وتفوق بهيجة';
        guestCount = 80;
        budget = 15000;
        tier = 'medium';
      }

      if (lower.includes('جدة') || lower.includes('جده')) {
        cityId = 'jeddah';
        cityNameAr = 'جدة';
      } else if (lower.includes('الدمام') || lower.includes('الخبر')) {
        cityId = 'khobar';
        cityNameAr = 'الخبر';
      }

      const budgetMatch = queryText.match(/(\d+)\s*(ألف|الف|k)/i);
      if (budgetMatch) {
        budget = parseInt(budgetMatch[1], 10) * 1000;
      }

      const guestMatch = queryText.match(/(\d+)\s*(شخص|ضيف|معازيم)/);
      if (guestMatch) {
        guestCount = parseInt(guestMatch[1], 10);
      }

      const allocations = [
        {
          categoryAr: 'كوش وديكور وتنسيق الورد',
          amount: Math.round(budget * 0.35),
          percentage: 35,
          descAr: 'خلفية مناسبات مخصصة، ورد طبيعي، إضاءة دافئة وطاولة التقديم',
        },
        {
          categoryAr: 'ضيافة سعودية وبوفيه وحلويات',
          amount: Math.round(budget * 0.3),
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
      ];

      const recommendationsAr = [
        `معدل تكلفة الضيف التقريبية لمناسبتك: ${formatSaudiRiyal(Math.round(budget / guestCount))} لكل ضيف (مستوى ممتاز).`,
        `ننصح ببدء حجز فريق الضيافة والتصوير قبل 14 يوماً لضمان التوفر وتجنب أوقات الذروة.`,
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

      setIsProcessing(false);
    }, 700);
  };

  const handleApplyPlan = () => {
    if (!generatedPlan) return;
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch {}

    const newOccasionId = createOccasion({
      title: generatedPlan.occasionTitle,
      occasionTypeId: generatedPlan.occasionTypeId,
      cityId: generatedPlan.cityId,
      guestCount: generatedPlan.guestCount,
      budget: generatedPlan.budget,
      tier: generatedPlan.tier,
      notes: `تم التخطيط عبر المساعد الذكي ${adminConfig.aiAssistantNameAr} بميزانية ${formatSaudiRiyal(generatedPlan.budget)} لـ ${generatedPlan.guestCount} ضيف.`,
    });

    setIsAIOpen(false);
    router.push(`/occasion/${newOccasionId}`);
  };

  const handleQuickAddService = (cand: VendorRecommendationResult) => {
    if (!cand.primaryService) return;
    const srv = cand.primaryService;
    const details = ensureServiceDetails(srv);
    const selectedPkg = details.packages[0] || {
      id: 'basic',
      nameAr: 'الباقة الأساسية',
      price: srv.price,
      featuresAr: srv.featuresAr,
      durationHours: 4,
    };

    addToCart(srv, selectedPkg, [], {
      date: '2026-10-09',
      time: '18:00',
      locationCity: srv.cityNameAr,
      notes: 'أضيف عبر بطاقة ترشيح لُـمى الذكية',
    });

    setAddedItemNotification(`تمت إضافة "${srv.titleAr}" إلى سلتك! 🛍️`);
    setTimeout(() => setAddedItemNotification(null), 3500);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}
  };

  if (!isAIOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-saudi-gold-400 to-saudi-gold-600 text-saudi-green-950 flex items-center justify-center font-black shadow-lg">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-cairo text-white">
                  المساعد الذكي: {adminConfig.aiAssistantNameAr}
                </h3>
                <span className="bg-saudi-gold-500/20 text-saudi-gold-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400/40">
                  خبير الموردين والتسوق 🇸🇦
                </span>
              </div>
              <p className="text-xs text-gray-300">
                اكتشاف الموردين • مقارنة الأسعار • فحص التوفر • إضافة مباشرة للسلة
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

        {/* Mode Tabs */}
        <div className="bg-saudi-green-950/95 px-4 py-2 flex items-center gap-2 border-b border-saudi-gold-500/20 text-xs">
          <button
            onClick={() => setActiveMode('shopping')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
              activeMode === 'shopping'
                ? 'bg-saudi-gold-500 text-saudi-green-950 shadow'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>مساعد الموردين والتسوق</span>
          </button>
          <button
            onClick={() => setActiveMode('planner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
              activeMode === 'planner'
                ? 'bg-saudi-gold-500 text-saudi-green-950 shadow'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>تخطيط الميزانية والمناسبة</span>
          </button>

          {cart.length > 0 && (
            <Link
              href="/cart"
              onClick={() => setIsAIOpen(false)}
              className="mr-auto flex items-center gap-1 bg-white/10 hover:bg-white/20 text-saudi-gold-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>السلة ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </Link>
          )}
        </div>

        {/* Added to cart toast notification */}
        {addedItemNotification && (
          <div className="bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-fadeIn shadow-md">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-300" />
              {addedItemNotification}
            </span>
            <Link
              href="/cart"
              onClick={() => setIsAIOpen(false)}
              className="underline text-saudi-gold-200 hover:text-white"
            >
              عرض السلة ←
            </Link>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-saudi-sand-50/80">
          {activeMode === 'shopping' ? (
            /* SHOPPING & DISCOVERY ASSISTANT CHAT */
            <div className="space-y-4">
              {/* Messages Stream */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  } space-y-2 animate-fadeIn`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-3xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-saudi-green-900 text-white rounded-br-none'
                        : 'bg-white text-gray-900 border border-saudi-sand-300 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line font-tajawal">{msg.text}</p>
                    <span
                      className={`text-[10px] block mt-1.5 ${
                        msg.sender === 'user' ? 'text-gray-300' : 'text-gray-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Render Comparison Cards if present */}
                  {msg.comparisonCandidates && msg.comparisonCandidates.length > 0 && (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {msg.comparisonCandidates.map((c, idx) => (
                        <div
                          key={c.vendor.id}
                          className="bg-white rounded-2xl p-4 border border-saudi-gold-300 shadow-sm space-y-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={c.vendor.logo}
                              alt={c.vendor.businessName}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-100"
                            />
                            <div>
                              <h5 className="font-bold text-xs text-gray-900">
                                {idx + 1}. {c.vendor.businessName}
                              </h5>
                              <div className="flex items-center gap-1 text-[11px] text-saudi-gold-600 font-bold">
                                <Star className="w-3 h-3 fill-current" />
                                <span>{c.vendor.rating}</span>
                                <span className="text-gray-400">({c.vendor.reviewsCount})</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs space-y-1 bg-saudi-sand-50 p-2.5 rounded-xl text-gray-700">
                            <div className="flex justify-between">
                              <span className="text-gray-500">السعر:</span>
                              <span className="font-bold text-saudi-green-900">
                                {formatSaudiRiyal(c.primaryService?.price || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">سرعة الرد:</span>
                              <span className="font-bold">{c.vendor.responseTimeMinutes} دقيقة</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">مناسبات مكتملة:</span>
                              <span className="font-bold">{c.vendor.completedBookingsCount}+</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickAddService(c)}
                              className="flex-1 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 transition"
                            >
                              <ShoppingBag className="w-3 h-3 text-saudi-gold-300" />
                              <span>أضف للسلة</span>
                            </button>
                            <Link
                              href={`/vendor/${c.vendor.id}`}
                              onClick={() => setIsAIOpen(false)}
                              className="p-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-700 rounded-xl transition"
                              title="عرض صفحة المورد"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Interactive Candidate Recommendation Cards */}
                  {msg.candidates && msg.candidates.length > 0 && (
                    <div className="w-full space-y-3 mt-1">
                      {msg.candidates.map((cand, idx) => (
                        <div
                          key={cand.vendor.id}
                          className="bg-white rounded-2xl p-4 border border-saudi-sand-300 hover:border-saudi-gold-400 shadow-sm transition space-y-3"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <img
                                src={cand.vendor.logo}
                                alt={cand.vendor.businessName}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-sm text-gray-900 font-cairo">
                                    {cand.vendor.businessName}
                                  </h4>
                                  {cand.vendor.verified && (
                                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                                  )}
                                  {cand.badges.slice(0, 1).map((b, bIdx) => (
                                    <span
                                      key={bIdx}
                                      className="bg-saudi-gold-100 text-saudi-gold-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-300"
                                    >
                                      {b}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[11px] text-gray-500">
                                  {cand.vendor.categoryNameAr} • {cand.vendor.cityNameAr} (حي {cand.vendor.neighborhood})
                                </p>
                              </div>
                            </div>

                            <div className="text-left shrink-0">
                              <span className="text-[10px] text-gray-400 block">يبدأ من</span>
                              <span className="text-sm font-black font-cairo text-saudi-green-900">
                                {formatSaudiRiyal(cand.primaryService?.price || 0)}
                              </span>
                            </div>
                          </div>

                          {/* Primary Service Name & Rating Stats */}
                          <div className="flex items-center justify-between text-xs bg-saudi-sand-50 p-2.5 rounded-xl">
                            <div className="flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-saudi-gold-600" />
                              <span className="font-bold text-gray-800 truncate max-w-[200px]">
                                {cand.primaryService?.titleAr || 'خدمات متنوعة'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-saudi-gold-700 font-bold">
                                <Star className="w-3.5 h-3.5 fill-saudi-gold-500 text-saudi-gold-500" />
                                <span>{cand.vendor.rating}</span>
                              </div>
                              <span className="text-gray-300">|</span>
                              <span className="text-gray-500 text-[11px]">
                                {cand.vendor.completedBookingsCount}+ حجز
                              </span>
                            </div>
                          </div>

                          {/* Explainability reasons */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-saudi-green-900 block">
                              لماذا رشحته لُـمى لك؟
                            </span>
                            <ul className="text-[11px] text-gray-600 space-y-0.5">
                              {cand.reasonsAr.map((reason, rIdx) => (
                                <li key={rIdx} className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-saudi-green-600 shrink-0" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                            <button
                              onClick={() => handleQuickAddService(cand)}
                              className="flex-1 py-2 px-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 text-saudi-gold-300" />
                              <span>أضف للسلة</span>
                            </button>

                            <button
                              onClick={() => {
                                addToComparison(cand.vendor.id);
                                router.push('/compare');
                                setIsAIOpen(false);
                              }}
                              className="py-2 px-3 bg-white hover:bg-saudi-sand-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 text-saudi-gold-600" />
                              <span>مقارنة</span>
                            </button>

                            <Link
                              href={`/vendor/${cand.vendor.id}`}
                              onClick={() => setIsAIOpen(false)}
                              className="py-2 px-3 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <span>الملف</span>
                              <ArrowRight className="w-3 h-3 rotate-180" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="p-4 bg-white rounded-2xl border border-saudi-sand-300 flex items-center gap-3 animate-pulse">
                  <div className="p-2 rounded-xl bg-saudi-gold-100 text-saudi-gold-600 animate-spin">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-gray-900">
                      لُـمى تقوم بفحص قواعد بيانات الموردين وحساب أفضل خيار...
                    </h5>
                    <p className="text-[10px] text-gray-400">
                      التحقق من التوفر والمطابقة مع متطلباتك
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            /* OCCASION PLANNER MODE */
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 space-y-2">
                <span className="text-xs font-bold text-gray-700 block">
                  💡 أمثلة لتخطيط مناسبتك مع لُـمى:
                </span>
                <div className="flex flex-wrap gap-2">
                  {plannerPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputQuery(p);
                        handleAnalyzePlanner(p);
                      }}
                      className="text-xs text-right bg-saudi-sand-50 hover:bg-saudi-green-50 text-gray-700 hover:text-saudi-green-900 border border-saudi-sand-200 p-2 rounded-xl transition"
                    >
                      "{p}"
                    </button>
                  ))}
                </div>
              </div>

              {generatedPlan && !isProcessing && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-white rounded-2xl p-4 border border-saudi-green-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-bold text-base text-saudi-green-900">
                        {generatedPlan.occasionTitle}
                      </h4>
                      <span className="text-xs bg-saudi-green-100 text-saudi-green-800 font-bold px-2 py-0.5 rounded-full">
                        {generatedPlan.cityNameAr}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-saudi-sand-100 p-2 rounded-xl">
                        <span className="text-[10px] text-gray-400 block">الضيوف</span>
                        <span className="font-bold">{generatedPlan.guestCount} شخص</span>
                      </div>
                      <div className="bg-saudi-sand-100 p-2 rounded-xl">
                        <span className="text-[10px] text-gray-400 block">الميزانية</span>
                        <span className="font-bold text-saudi-green-900">
                          {formatSaudiRiyal(generatedPlan.budget)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Allocations breakdown */}
                  <div className="bg-white rounded-2xl p-4 border border-saudi-sand-300 space-y-2 text-xs">
                    <h5 className="font-bold text-gray-800">توزيع الميزانية المقترح:</h5>
                    {generatedPlan.allocations.map((alloc, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-gray-50">
                        <span>{alloc.categoryAr}</span>
                        <span className="font-bold text-saudi-green-900">
                          {formatSaudiRiyal(alloc.amount)} ({alloc.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleApplyPlan}
                    className="w-full py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <Sparkles className="w-4 h-4 text-saudi-gold-300" />
                    <span>اعتماد الخطة وبناء المناسبة الآن</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-saudi-sand-200">
          {/* Quick chip suggestions if in shopping mode */}
          {activeMode === 'shopping' && messages.length <= 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
              {shoppingPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputQuery(prompt);
                    handleShoppingQuery(prompt);
                  }}
                  className="whitespace-nowrap bg-saudi-sand-100 hover:bg-saudi-green-50 text-gray-700 hover:text-saudi-green-900 text-[11px] px-2.5 py-1.5 rounded-xl border border-saudi-sand-300 transition shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeMode === 'shopping') {
                handleShoppingQuery(inputQuery);
              } else {
                handleAnalyzePlanner(inputQuery);
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                activeMode === 'shopping'
                  ? 'اكتب طلبك (مثال: أحتاج مصورة زواج بالرياض أقل من 3000 ريال)...'
                  : 'اكتب تفاصيل مناسبتك (مثال: ملكة منزلية بجدة 50 شخص ميزانية 20 ألف)...'
              }
              className="flex-1 px-4 py-3 bg-saudi-sand-50 border border-saudi-sand-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-saudi-gold-500 transition"
            />
            <button
              type="submit"
              disabled={isProcessing || !inputQuery.trim()}
              className="px-4 py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-saudi-gold-300 rounded-xl font-bold text-sm flex items-center justify-center disabled:opacity-50 transition shrink-0 shadow"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
