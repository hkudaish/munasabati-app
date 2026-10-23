import { getNumberLocale } from '@/lib/i18n/format';
/** Halala to a currency string in the page's language. */
export const money = (n: number) => new Intl.NumberFormat(getNumberLocale(), { style: 'currency', currency: 'SAR' }).format((n ?? 0) / 100);
