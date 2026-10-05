import { 
  Vendor, 
  ServiceItem, 
  RankingWeights, 
  VendorRecommendationResult, 
  ServiceAvailability 
} from './types';

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  ratingWeight: 25,
  priceWeight: 20,
  availabilityWeight: 15,
  ordersWeight: 15,
  onTimeWeight: 10,
  responseSpeedWeight: 5,
  verificationWeight: 5,
  distanceWeight: 5,
};

export interface RankingCriteria {
  cityId?: string;
  categoryId?: string;
  targetDate?: string;
  budgetMax?: number;
  minRating?: number;
  priority?: 'cheapest' | 'best_rated' | 'fastest' | 'best_value' | 'nearest' | 'default';
  verifiedOnly?: boolean;
}

/**
 * Check if a vendor or service is available on a specific target date
 */
export function checkAvailability(
  availability: ServiceAvailability | undefined,
  targetDateStr: string | undefined
): { isAvailable: boolean; available: boolean; reasonAr: string; reason: string } {
  if (!targetDateStr) {
    return { isAvailable: true, available: true, reasonAr: 'متاح للحجز الفوري', reason: 'متاح للحجز الفوري' };
  }

  if (!availability) {
    // Default open availability
    return { isAvailable: true, available: true, reasonAr: 'متاح في الموعد المحدد', reason: 'متاح في الموعد المحدد' };
  }

  const targetDate = new Date(targetDateStr);
  const now = new Date();
  
  // 1. Min notice days
  const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < availability.minNoticeDays) {
    const reason = `يتطلب الحجز إشعاراً مسبقاً قبل ${availability.minNoticeDays} أيام على الأقل.`;
    return {
      isAvailable: false,
      available: false,
      reasonAr: reason,
      reason,
    };
  }

  // 2. Max advance booking days
  if (availability.maxAdvanceDays && diffDays > availability.maxAdvanceDays) {
    const reason = `الحجز متاح حتى ${availability.maxAdvanceDays} يوماً مقدماً فقط.`;
    return {
      isAvailable: false,
      available: false,
      reasonAr: reason,
      reason,
    };
  }

  // 3. Blackout dates check
  const dateFormatted = targetDate.toISOString().split('T')[0];
  if (availability.blackoutDates && availability.blackoutDates.includes(dateFormatted)) {
    const reason = 'الموعد محجوز بالكامل أو ضمن أيام التوقف للمورد.';
    return {
      isAvailable: false,
      available: false,
      reasonAr: reason,
      reason,
    };
  }

  // 4. Working days check (0 = Sunday in JS, matching Saudi calendar)
  const dayOfWeek = targetDate.getDay();
  if (availability.workingDays && availability.workingDays.length > 0 && !availability.workingDays.includes(dayOfWeek)) {
    const reason = 'المورد لا يعمل في هذا اليوم من الأسبوع.';
    return {
      isAvailable: false,
      available: false,
      reasonAr: reason,
      reason,
    };
  }

  return { isAvailable: true, available: true, reasonAr: 'الموعد متاح ومؤكد للحجز', reason: 'الموعد متاح ومؤكد للحجز' };
}

/**
 * Dynamically adjust ranking weights based on user explicit priorities
 */
export function getDynamicWeights(
  baseWeights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
  priority: RankingCriteria['priority'] = 'default'
): RankingWeights {
  const w = { ...baseWeights };

  switch (priority) {
    case 'cheapest':
      return {
        ...w,
        priceWeight: 45,
        ratingWeight: 15,
        ordersWeight: 10,
        availabilityWeight: 15,
        distanceWeight: 5,
        onTimeWeight: 5,
        responseSpeedWeight: 3,
        verificationWeight: 2,
      };
    case 'best_rated':
      return {
        ...w,
        ratingWeight: 40,
        ordersWeight: 20,
        onTimeWeight: 15,
        priceWeight: 5,
        availabilityWeight: 10,
        responseSpeedWeight: 5,
        verificationWeight: 5,
        distanceWeight: 0,
      };
    case 'fastest':
      return {
        ...w,
        responseSpeedWeight: 35,
        onTimeWeight: 25,
        availabilityWeight: 20,
        ratingWeight: 10,
        priceWeight: 5,
        ordersWeight: 5,
        distanceWeight: 0,
        verificationWeight: 0,
      };
    case 'nearest':
      return {
        ...w,
        distanceWeight: 40,
        availabilityWeight: 20,
        ratingWeight: 15,
        priceWeight: 10,
        ordersWeight: 10,
        onTimeWeight: 5,
        responseSpeedWeight: 0,
        verificationWeight: 0,
      };
    case 'best_value':
      return {
        ...w,
        priceWeight: 25,
        ratingWeight: 25,
        ordersWeight: 15,
        onTimeWeight: 15,
        availabilityWeight: 10,
        responseSpeedWeight: 5,
        verificationWeight: 5,
        distanceWeight: 0,
      };
    default:
      return w;
  }
}

/**
 * Deterministic Vendor Ranking Engine
 * Evaluates real candidates, calculates 0-100 normalized scores, applies weights,
 * and generates factual explainability points.
 */
export function rankVendors(
  vendors: Vendor[],
  services: ServiceItem[],
  criteria: RankingCriteria,
  baseWeights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): VendorRecommendationResult[] {
  if (!vendors || vendors.length === 0) return [];

  // Step 1: Apply HARD Constraints
  const candidates = vendors.filter((v) => {
    if (v.status !== 'active') return false;
    if (criteria.verifiedOnly && !v.verified) return false;
    if (criteria.categoryId && criteria.categoryId !== 'all' && v.categoryId !== criteria.categoryId) return false;
    if (criteria.cityId && criteria.cityId !== 'all' && v.cityId !== criteria.cityId) {
      // Check if vendor serves this city
      if (!v.serviceAreas || !v.serviceAreas.includes(criteria.cityId)) {
        return false;
      }
    }
    if (criteria.minRating && v.rating < criteria.minRating) return false;
    if (criteria.budgetMax && v.startingPrice > criteria.budgetMax) return false;

    // Check availability hard constraint if target date provided
    if (criteria.targetDate) {
      const avail = checkAvailability(v.availability, criteria.targetDate);
      if (!avail.isAvailable) return false;
    }

    return true;
  });

  if (candidates.length === 0) return [];

  // Find min/max ranges for normalization
  const prices = candidates.map((v) => v.startingPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const ratings = candidates.map((v) => v.rating);
  const maxRating = Math.max(...ratings);

  const ordersList = candidates.map((v) => v.completedBookingsCount || 0);
  const maxOrders = Math.max(...ordersList, 1);

  const responseTimes = candidates.map((v) => v.responseTimeMinutes || 30);
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);

  // Dynamic weights based on user intent
  const weights = getDynamicWeights(baseWeights, criteria.priority);
  const totalWeight =
    weights.ratingWeight +
    weights.priceWeight +
    weights.availabilityWeight +
    weights.ordersWeight +
    weights.onTimeWeight +
    weights.responseSpeedWeight +
    weights.verificationWeight +
    weights.distanceWeight;

  // Step 2: Score candidates
  const scoredResults: VendorRecommendationResult[] = candidates.map((v) => {
    // Matched representative service
    const vendorServices = services.filter((s) => s.vendorId === v.id);
    const matchedService = criteria.categoryId
      ? vendorServices.find((s) => s.categoryId === criteria.categoryId) || vendorServices[0]
      : vendorServices[0];

    // 1. Rating Score: 0 - 100
    const ratingScore = Math.min(100, Math.round((v.rating / 5) * 100));

    // 2. Price Score: Lower is better, inverted scale 0 - 100
    let priceScore = 75;
    if (maxPrice > minPrice) {
      priceScore = Math.round(100 - ((v.startingPrice - minPrice) / (maxPrice - minPrice)) * 80);
    }

    // 3. Orders Score: Experience & completed volume
    const ordersScore = Math.min(100, Math.round(((v.completedBookingsCount || 0) / maxOrders) * 100));

    // 4. Response Speed Score: Faster response (fewer minutes) gives higher score
    let responseScore = 80;
    if (maxResponseTime > minResponseTime) {
      responseScore = Math.round(
        100 - ((v.responseTimeMinutes - minResponseTime) / (maxResponseTime - minResponseTime)) * 60
      );
    }

    // 5. Reliability / On-time score
    const onTimeScore = v.metrics?.onTimeRate || 95;

    // 6. Availability score
    const availCheck = checkAvailability(v.availability, criteria.targetDate);
    const availabilityScore = availCheck.isAvailable ? 100 : 20;

    // 7. Distance / City matching score
    const distanceScore = v.cityId === criteria.cityId ? 100 : 70;

    // 8. Verification score
    const verificationScore = v.verified ? 100 : 50;

    // Best Value Score: Harmonic combination of rating, price position, and reliability
    const bestValueScore = Math.round(
      ratingScore * 0.35 + priceScore * 0.35 + (v.metrics?.satisfactionRate || 92) * 0.3
    );

    // Weighted Composite Score
    const compositeScore = Math.round(
      (ratingScore * weights.ratingWeight +
        priceScore * weights.priceWeight +
        availabilityScore * weights.availabilityWeight +
        ordersScore * weights.ordersWeight +
        onTimeScore * weights.onTimeWeight +
        responseScore * weights.responseSpeedWeight +
        verificationScore * weights.verificationWeight +
        distanceScore * weights.distanceWeight) /
        totalWeight
    );

    // Generate Factual Explainability points
    const reasonsAr: string[] = [];
    if (v.rating >= 4.8) {
      reasonsAr.push(`تقييم استثنائي (${v.rating} من 5) بناءً على ${v.reviewsCount} تقييم حقيقي.`);
    }
    if (v.startingPrice === minPrice) {
      reasonsAr.push(`الخيار الأقل تكلفة في الفئة بدءاً من ${v.startingPrice} ر.س.`);
    } else if (criteria.budgetMax && v.startingPrice <= criteria.budgetMax * 0.8) {
      reasonsAr.push(`سعر منافس وموفر يوفر لك أكثر من 20% من سقف الميزانية.`);
    }
    if (v.completedBookingsCount && v.completedBookingsCount >= 50) {
      reasonsAr.push(`أكثر من ${v.completedBookingsCount} حفل ومناسبة مكتملة بنجاح.`);
    }
    if (v.responseTimeMinutes <= 15) {
      reasonsAr.push(`سرعة استجابة فائقة (خلال ${v.responseTimeMinutes} دقيقة).`);
    }
    if (v.verified) {
      reasonsAr.push(`مورد معتمد ومرخص رسميًا (سجل تجاري / وثيقة عمل حر).`);
    }
    if (criteria.targetDate && availCheck.isAvailable) {
      reasonsAr.push(`توفر مؤكد في التاريخ المطلوب (${criteria.targetDate}).`);
    }

    return {
      vendor: v,
      matchedService,
      compositeScore,
      priceScore,
      ratingScore,
      reliabilityScore: onTimeScore,
      availabilityScore,
      bestValueScore,
      badges: [],
      reasonsAr: reasonsAr.slice(0, 4),
    };
  });

  // Sort descending by composite score
  scoredResults.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign Badges non-duplicatively based on factual criteria
  if (scoredResults.length > 0) {
    // 1. Luma Choice: Top 1 composite
    scoredResults[0].badges.push('اختيار لُـمى');

    // 2. Highest Rated
    const highestRated = [...scoredResults].sort((a, b) => b.vendor.rating - a.vendor.rating)[0];
    if (highestRated && highestRated.vendor.rating >= 4.8 && !highestRated.badges.includes('الأفضل تقييماً')) {
      highestRated.badges.push('الأفضل تقييماً');
    }

    // 3. Lowest Price
    const lowestPrice = [...scoredResults].sort((a, b) => a.vendor.startingPrice - b.vendor.startingPrice)[0];
    if (lowestPrice && !lowestPrice.badges.includes('الأقل سعراً')) {
      lowestPrice.badges.push('الأقل سعراً');
    }

    // 4. Best Value
    const bestValue = [...scoredResults].sort((a, b) => b.bestValueScore - a.bestValueScore)[0];
    if (bestValue && !bestValue.badges.includes('أفضل قيمة') && !bestValue.badges.includes('الأقل سعراً')) {
      bestValue.badges.push('أفضل قيمة');
    }

    // 5. Fastest
    const fastest = [...scoredResults].sort((a, b) => a.vendor.responseTimeMinutes - b.vendor.responseTimeMinutes)[0];
    if (fastest && fastest.vendor.responseTimeMinutes <= 15 && !fastest.badges.includes('الأسرع تجاوباً')) {
      fastest.badges.push('الأسرع تجاوباً');
    }
  }

  return scoredResults;
}
