// Automated Supplier Routing & Assignment Engine
// Evaluates vendor criteria (availability, coverage, active capacity, metrics, response speed, price fit)
// and computes weighted composite scores for automated routing or fallback exception creation.

import type { Vendor, ServiceItem } from '../types';
import type { OMSRoutingWeights, RoutingScoreResult } from './types';

export const DEFAULT_ROUTING_WEIGHTS: OMSRoutingWeights = {
  availabilityWeight: 20,
  coverageWeight: 15,
  capacityWeight: 10,
  responseTimeWeight: 15,
  onTimeRateWeight: 15,
  ratingWeight: 15,
  priceFitWeight: 10,
};

export function scoreVendorForRouting(
  vendor: Vendor,
  matchedService: ServiceItem | undefined,
  targetCityId: string,
  targetDate: string,
  targetBudget: number | undefined,
  activeVendorOrdersCount: number,
  weights: OMSRoutingWeights = DEFAULT_ROUTING_WEIGHTS
): RoutingScoreResult {
  let isEligible = true;
  let ineligibilityReasonAr: string | undefined;

  // 1. Coverage Check
  const isCityMatch = vendor.cityId === targetCityId || vendor.serviceAreas.includes(targetCityId);
  const coverageScore = isCityMatch ? 100 : 0;
  if (!isCityMatch) {
    isEligible = false;
    ineligibilityReasonAr = 'المورد لا يغطي منطقة أو مدينة الطلب';
  }

  // 2. Status Check
  if (vendor.status !== 'active') {
    isEligible = false;
    ineligibilityReasonAr = 'حساب المورد معطل أو تحت المراجعة';
  }

  // 3. Availability Check
  let availabilityScore = 80;
  if (vendor.availability) {
    const dateObj = new Date(targetDate);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday
    const isWorkingDay = vendor.availability.workingDays.includes(dayOfWeek);
    const isBlackout = vendor.availability.blackoutDates.includes(targetDate);

    if (!isWorkingDay || isBlackout) {
      availabilityScore = 0;
      isEligible = false;
      ineligibilityReasonAr = 'المورد غير متاح في تاريخ الفعالية المطلوب';
    } else {
      availabilityScore = 100;
    }
  }

  // 4. Capacity Check (e.g. max 5 active bookings per vendor)
  const maxCapacity = vendor.availability?.capacityPerSlot || 5;
  const currentLoadRatio = activeVendorOrdersCount / maxCapacity;
  let capacityScore = Math.max(0, 100 - Math.round(currentLoadRatio * 100));
  if (activeVendorOrdersCount >= maxCapacity) {
    capacityScore = 0;
    isEligible = false;
    ineligibilityReasonAr = 'المورد يمر بأقصى طاقة استيعابية للطلبات النشطة';
  }

  // 5. Response Time Score (Faster response = higher score)
  const responseMins = vendor.responseTimeMinutes || vendor.metrics?.responseTimeMinutes || 15;
  // 15 mins = 100%, 120 mins = 20%
  const responseTimeScore = Math.max(10, Math.round(100 - (responseMins / 120) * 80));

  // 6. On-Time & Acceptance Rate Score
  const onTimeRate = vendor.metrics?.onTimeRate ?? 95;
  const acceptanceRate = vendor.metrics?.acceptanceRate ?? 95;
  const onTimeRateScore = Math.round((onTimeRate + acceptanceRate) / 2);

  // 7. Rating Score (Rating out of 5 to 100)
  const rating = vendor.rating || 5.0;
  const ratingScore = Math.round((rating / 5) * 100);

  // 8. Price Fit Score
  let priceFitScore = 80;
  const vendorPrice = matchedService?.price || vendor.startingPrice || 0;
  if (targetBudget && targetBudget > 0 && vendorPrice > 0) {
    const diffRatio = Math.abs(vendorPrice - targetBudget) / targetBudget;
    priceFitScore = Math.max(10, Math.round(100 - diffRatio * 100));
  }

  // Calculate Weighted Total Score
  const totalWeight =
    weights.availabilityWeight +
    weights.coverageWeight +
    weights.capacityWeight +
    weights.responseTimeWeight +
    weights.onTimeRateWeight +
    weights.ratingWeight +
    weights.priceFitWeight;

  const weightedSum =
    availabilityScore * weights.availabilityWeight +
    coverageScore * weights.coverageWeight +
    capacityScore * weights.capacityWeight +
    responseTimeScore * weights.responseTimeWeight +
    onTimeRateScore * weights.onTimeRateWeight +
    ratingScore * weights.ratingWeight +
    priceFitScore * weights.priceFitWeight;

  const totalScore = isEligible ? Math.round(weightedSum / (totalWeight || 1)) : 0;

  return {
    vendorId: vendor.id,
    vendorName: vendor.businessName,
    totalScore,
    scores: {
      availability: availabilityScore,
      coverage: coverageScore,
      capacity: capacityScore,
      responseTime: responseTimeScore,
      onTimeRate: onTimeRateScore,
      rating: ratingScore,
      priceFit: priceFitScore,
    },
    isEligible,
    ineligibilityReasonAr,
  };
}

export function routeBestSupplier(
  candidates: Vendor[],
  servicesMap: Record<string, ServiceItem>,
  targetCityId: string,
  targetDate: string,
  targetBudget?: number,
  activeOrdersCountMap: Record<string, number> = {},
  weights: OMSRoutingWeights = DEFAULT_ROUTING_WEIGHTS
): { bestVendor?: Vendor; evaluationLog: RoutingScoreResult[] } {
  const evaluations = candidates.map((vendor) => {
    const matchedService = servicesMap[vendor.id];
    const activeCount = activeOrdersCountMap[vendor.id] || 0;
    return scoreVendorForRouting(
      vendor,
      matchedService,
      targetCityId,
      targetDate,
      targetBudget,
      activeCount,
      weights
    );
  });

  // Sort by total score descending
  const sorted = evaluations
    .filter((e) => e.isEligible)
    .sort((a, b) => b.totalScore - a.totalScore);

  if (sorted.length === 0) {
    return { evaluationLog: evaluations };
  }

  const winner = candidates.find((c) => c.id === sorted[0].vendorId);
  return {
    bestVendor: winner,
    evaluationLog: evaluations,
  };
}
