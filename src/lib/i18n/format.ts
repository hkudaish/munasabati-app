/** Fills {name} placeholders. Unknown placeholders are left as they are. */
export function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** The BCP-47 locale for numbers and dates; the provider sets it before its children render, so every formatter follows the page language. */
let numberLocale = 'ar-SA';
export const setNumberLocale = (locale: 'ar' | 'en') => { numberLocale = locale === 'en' ? 'en-US' : 'ar-SA'; };
export const getNumberLocale = () => numberLocale;
