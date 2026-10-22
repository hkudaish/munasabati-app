import type { Metadata } from 'next';
import { localizePath, isTranslatedPath, stripLocale, type Locale } from '@/lib/i18n/locale';
import { siteUrl, SITE_NAME } from '@/lib/site';
import { isPrivatePath, pageMeta, HOME } from './registry';

export interface MetaInput { path: string; locale: Locale; title?: string; description?: string; image?: string; index?: boolean; keywords?: string[]; /** false when the page has no English text of its own: no English alternate, and the English address points to the Arabic page */ bilingual?: boolean }
const OPEN_GRAPH_LOCALE: Record<Locale, string> = { ar: 'ar_SA', en: 'en_US' };
const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : siteUrl() + url);

/** Complete metadata for one page in one language: title, description, canonical, language alternates, robots, Open Graph and Twitter cards. */
export function buildMetadata(input: MetaInput): Metadata {
  const arabicPath = stripLocale(input.path).replace(/\/+$/, '') || '/';
  const meta = pageMeta(arabicPath) ?? HOME;
  const title = input.title ?? meta.title[input.locale], description = input.description ?? meta.description[input.locale];
  const translated = isTranslatedPath(arabicPath) && input.bilingual !== false;
  const canonical = localizePath(arabicPath, input.locale === 'en' && translated ? 'en' : 'ar');
  const image = absolute(input.image ?? (input.locale === 'en' ? '/og-default-en.png' : '/og-default.png'));
  const indexable = input.index ?? !isPrivatePath(arabicPath);
  return {
    metadataBase: new URL(siteUrl()),
    title, description, applicationName: SITE_NAME[input.locale], keywords: input.keywords ?? (arabicPath === '/' ? HOME.keywords : undefined),
    alternates: { canonical, ...(translated && indexable ? { languages: { 'ar-SA': arabicPath, en: localizePath(arabicPath, 'en'), 'x-default': arabicPath } } : {}) },
    robots: indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } } : { index: false, follow: false, nocache: true },
    openGraph: { type: 'website', url: canonical, siteName: SITE_NAME[input.locale], title, description, locale: OPEN_GRAPH_LOCALE[input.locale], alternateLocale: OPEN_GRAPH_LOCALE[input.locale === 'en' ? 'ar' : 'en'], images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    formatDetection: { telephone: false, email: false, address: false },
    icons: { icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  };
}
