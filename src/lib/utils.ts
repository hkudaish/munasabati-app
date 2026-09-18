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

export function generateGuestQRCode(guestId: string, occasionId: string): string {
  return `MUN-RSVP-${occasionId.slice(-3).toUpperCase()}-${guestId.slice(-4).toUpperCase()}`;
}
