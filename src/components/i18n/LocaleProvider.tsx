'use client';
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Locale, localizePath, stripLocale } from '@/lib/i18n/locale';
import { format, setNumberLocale } from '@/lib/i18n/format';
import { setMessageTranslator } from '@/lib/api-client';

type Vars = Record<string, string | number>;
interface Ctx { locale: Locale; dir: 'rtl' | 'ltr'; t: (source: string, vars?: Vars) => string; pick: (ar: string, en?: string | null) => string; localize: (path: string) => string }
const fallback: Ctx = { locale: 'ar', dir: 'rtl', t: (source, vars) => format(source, vars), pick: ar => ar, localize: path => stripLocale(path) };
const LocaleContext = createContext<Ctx>(fallback);

/** Provides the page language. The Arabic text is the key: English pages get the dictionary, Arabic pages never download it. */
export default function LocaleProvider({ locale, dictionary, children }: { locale: Locale; dictionary?: Record<string, string>; children: React.ReactNode }) {
  setNumberLocale(locale);
  const t = useCallback((source: string, vars?: Vars) => format(locale === 'en' && dictionary ? dictionary[source] ?? source : source, vars), [locale, dictionary]);
  setMessageTranslator(t);
  const pick = useCallback((ar: string, en?: string | null) => (locale === 'en' ? (en && en.trim() ? en : t(ar)) : ar), [locale, t]);
  const value = useMemo<Ctx>(() => ({ locale, dir: locale === 'en' ? 'ltr' : 'rtl', t, pick, localize: path => localizePath(path, locale) }), [locale, t, pick]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
/** `const t = useT(); t('نص عربي')` gives the text in the page language; `t('مرحباً {name}', { name })` fills placeholders. */
export const useT = () => useContext(LocaleContext).t;
/** `pick(item.titleAr, item.titleEn)`: the English text when the page is English and one was written, else the dictionary, else the Arabic. */
export const usePick = () => useContext(LocaleContext).pick;
/** The current path without the /en prefix, for matching routes. */
export function useInnerPathname() { const pathname = usePathname() ?? '/'; return stripLocale(pathname); }
