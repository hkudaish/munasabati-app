import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSAR(amount: number, includeCurrency = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

  // Isolate the full price so Arabic surroundings cannot reorder its digits or symbol.
  return includeCurrency ? `\u2066⃁\u00a0${formatted}\u2069` : formatted;
}

export const formatSaudiRiyal = formatSAR;

export const formatSAR_EN = formatSAR;

export function formatDateArabic(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function getDaysRemaining(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  try {
    const target = new Date(targetDateStr).getTime();
    const now = new Date().getTime();
    const diffTime = target - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export function calculateVAT(subtotal: number, vatRate = 0.15) {
  const vat = subtotal * vatRate;
  const total = subtotal + vat;
  return {
    subtotal,
    vat,
    total,
  };
}

export function generateBookingNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `MUN-${year}-${randomNum}`;
}

export function generateOrderNumber(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const year = new Date().getFullYear();
  return `ORD-${year}-${randomNum}`;
}

export function generateGuestQRCode(guestId: string, occasionId: string): string {
  return `MUN-RSVP-${occasionId.slice(-3).toUpperCase()}-${guestId.slice(-4).toUpperCase()}`;
}

import type { ServiceItem, Vendor, CartItem, Coupon, ServicePackage, ServiceAddon, ServiceAvailability, VendorMetrics } from './types';

export function ensureServiceDetails(service: ServiceItem): ServiceItem & {
  packages: ServicePackage[];
  addons: ServiceAddon[];
  availability: ServiceAvailability;
} {
  // An empty package ID means the actual service base price, not a catalog package.
  // Do not invent tiers, discounts, add-ons or deliverables for an empty catalog.
  const packages = service.packages?.length ? service.packages : [{
    id: '', nameAr: 'الخدمة بالسعر الأساسي', tier: 'standard' as const, price: service.price,
    durationHours: service.executionDurationHours, featuresAr: service.featuresAr || [],
  }];
  const addons = service.addons || [];

  const availability = service.availability || {
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    timeSlots: ['04:00 م - 07:00 م', '07:00 م - 10:00 م', '10:00 م - 01:00 ص'],
    capacityPerSlot: 2,
    blackoutDates: [],
    minNoticeDays: 2,
    maxAdvanceDays: 180,
  };

  return {
    ...service,
    packages,
    addons,
    availability,
  };
}

export function ensureVendorDetails(vendor: Vendor): Vendor & { metrics: VendorMetrics; availability: ServiceAvailability } {
  const metrics: VendorMetrics = vendor.metrics || {
    averageRating: vendor.rating || 4.9,
    reviewsCount: vendor.reviewsCount || 45,
    completedOrders: vendor.completedBookingsCount || 72,
    cancelledOrders: 1,
    repeatCustomerRate: 36,
    responseTimeMinutes: vendor.responseTimeMinutes || 12,
    acceptanceRate: 98,
    onTimeRate: 99,
    satisfactionRate: 96,
    yearsOfExperience: 6,
  };

  const availability: ServiceAvailability = vendor.availability || {
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    timeSlots: ['04:00 م - 07:00 م', '07:00 م - 10:00 م', '10:00 م - 01:00 ص'],
    capacityPerSlot: 2,
    blackoutDates: [],
    minNoticeDays: 2,
    maxAdvanceDays: 180,
  };

  return {
    ...vendor,
    metrics,
    availability,
  };
}

export function calculateCartTotals(items: CartItem[], coupon: Coupon | null = null, vatRate = 0.15) {
  const subtotal = items.reduce((acc, it) => acc + (it.subtotal || it.basePrice * it.quantity), 0);
  const addonsTotal = items.reduce((acc, it) => acc + (it.addonsTotal || 0), 0);

  let discount = 0;
  if (coupon && subtotal >= coupon.minOrderAmount) {
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }
  }

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * vatRate);
  const total = taxableAmount + tax;
  const depositAmount = Math.round(total * 0.3); // 30% deposit standard in Saudi market

  return {
    subtotal,
    addonsTotal,
    discount,
    discountTotal: discount,
    taxableAmount,
    tax,
    taxAmount: tax,
    total,
    finalTotal: total,
    depositAmount,
    remainingAmount: total - depositAmount,
  };
}

