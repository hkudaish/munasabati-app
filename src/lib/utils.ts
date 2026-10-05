import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSAR(amount: number, includeCurrency = true): string {
  const formatted = new Intl.NumberFormat('ar-SA', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return includeCurrency ? `${formatted} ر.س` : formatted;
}

export const formatSaudiRiyal = formatSAR;

export function formatSAR_EN(amount: number, includeCurrency = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return includeCurrency ? `${formatted} SAR` : formatted;
}

export function formatDateArabic(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-SA', {
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
  const base = service.price || 1000;
  const packages = service.packages && service.packages.length > 0 ? service.packages : [
    {
      id: `${service.id}-pkg-basic`,
      nameAr: 'الباقة الأساسية',
      nameEn: 'Basic Package',
      tier: 'basic' as const,
      price: Math.round(base * 0.8),
      descriptionAr: 'تجهيز قياسي مناسب للمناسبات العائلية المصغرة مع أساسيات الخدمة.',
      durationHours: 3,
      featuresAr: service.featuresAr.slice(0, 3),
    },
    {
      id: `${service.id}-pkg-standard`,
      nameAr: 'الباقة المتكاملة (الأكثر طلباً)',
      nameEn: 'Standard Package',
      tier: 'standard' as const,
      price: base,
      descriptionAr: 'الخيار المثالي المتكامل مع كافة التجهيزات الموصى بها وكادر متكامل.',
      durationHours: 5,
      featuresAr: service.featuresAr,
      isPopular: true,
    },
    {
      id: `${service.id}-pkg-vip`,
      nameAr: 'الباقة الملكية VIP',
      nameEn: 'VIP Royal Package',
      tier: 'vip' as const,
      price: Math.round(base * 1.45),
      descriptionAr: 'أعلى مستوى من الفخامة مع إضافات حصرية وتغطية ممتدة وضيافة خاصة.',
      durationHours: 7,
      featuresAr: [...service.featuresAr, 'خدمة إشراف VIP مخصصة', 'أولوية التنفيذ والتجهيز المبكر', 'هدية تذكارية فاخرة للمناسبة'],
    },
  ];

  const addons = service.addons && service.addons.length > 0 ? service.addons : [
    {
      id: `${service.id}-add-1`,
      titleAr: 'ساعة إضافية في الموقع',
      descriptionAr: 'تمديد مدة تواجد الفريق أو الخدمة لمدة 60 دقيقة إضافية',
      price: Math.round(base * 0.15) || 300,
      pricingType: 'per_hour' as const,
      isAvailable: true,
      maxQuantity: 4,
    },
    {
      id: `${service.id}-add-2`,
      titleAr: 'طاقم عمل / كادر إضافي',
      descriptionAr: 'مباشر أو مساعد إضافي بزي تراثي وموحد لتسريع الخدمة',
      price: 250,
      pricingType: 'per_person' as const,
      isAvailable: true,
      maxQuantity: 6,
    },
    {
      id: `${service.id}-add-3`,
      titleAr: 'ترقية فاخرة ومباخر عود موروكي',
      descriptionAr: 'توفير مباخر نحاسية ملكية وتبخير مستمر بدهن العود طوال المناسبة',
      price: 450,
      pricingType: 'fixed' as const,
      isAvailable: true,
      maxQuantity: 2,
    },
  ];

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

