/* Languages. Arabic is the default and lives at the plain paths; English lives under /en and is served by rewriting to the same routes.
   English is offered ONLY for pages whose interface is translated (TRANSLATED below): asking for any other page under /en
   goes back to its Arabic address, so nobody sees Arabic text inside a left-to-right layout. */
export type Locale = 'ar' | 'en';
export const LOCALES: Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';
export const LOCALE_COOKIE = 'locale';
export const EN_PREFIX = '/en';

/** Pages with a complete English interface (the public browsing and buying journey). Keep in step with the dictionary. */
const TRANSLATED: RegExp[] = [/^\/$/, /^\/commerce$/, /^\/commerce\/service\/[^/]+$/, /^\/commerce\/cart$/, /^\/commerce\/orders$/, /^\/marketplace$/, /^\/packages$/, /^\/service\/[^/]+$/];
const clean = (path: string) => (path.split(/[?#]/)[0].replace(/\/+$/, '') || '/');
export const isTranslatedPath = (path: string) => TRANSLATED.some(rule => rule.test(clean(path)));
export const isLocale = (value: unknown): value is Locale => value === 'ar' || value === 'en';

/** `/en/commerce` -> `/commerce`; anything else is returned unchanged. */
export function stripLocale(path: string): string {
  if (path === EN_PREFIX) return '/';
  return path.startsWith(EN_PREFIX + '/') ? path.slice(EN_PREFIX.length) : path;
}
export const localeOfPath = (path: string): Locale => (path === EN_PREFIX || path.startsWith(EN_PREFIX + '/') ? 'en' : 'ar');
/** The address of a page in a language. Pages without an English version keep their Arabic address. */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = stripLocale(path);
  if (locale !== 'en' || !isTranslatedPath(base)) return base;
  const rest = base.slice(clean(base).length);          // query string / hash
  const pathname = clean(base);
  return EN_PREFIX + (pathname === '/' ? '' : pathname) + rest;
}
/** The same page in the other language, or null when that language is not available for it. */
export function counterpart(path: string, locale: Locale): string | null {
  const arabic = stripLocale(path);
  if (locale === 'en') return arabic;
  return isTranslatedPath(arabic) ? localizePath(arabic, 'en') : null;
}
