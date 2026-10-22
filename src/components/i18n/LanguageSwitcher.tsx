'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, counterpart } from '@/lib/i18n/locale';
import { useLocale } from './LocaleProvider';

/** Switches between العربية and English on the same page. Where a page has no English version the switch is disabled and says why. */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? '/';
  const target = counterpart(pathname, locale);
  const label = locale === 'en' ? 'العربية' : 'English';
  const go = () => {
    if (!target) return;
    document.cookie = `${LOCALE_COOKIE}=${locale === 'en' ? 'ar' : 'en'}; path=/; max-age=31536000; samesite=lax`;
    window.location.assign(target + window.location.search + window.location.hash);
  };
  return (
    <button type="button" onClick={go} disabled={!target} lang={locale === 'en' ? 'ar' : 'en'} dir={locale === 'en' ? 'rtl' : 'ltr'}
      title={target ? undefined : locale === 'en' ? 'هذه الصفحة غير متاحة بالعربية' : 'This page is not available in English yet'}
      aria-label={locale === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      className={`rounded-lg border border-saudi-gold-400/60 px-3 py-1 text-xs font-bold text-saudi-gold-700 hover:bg-saudi-gold-50 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
      {label}
    </button>
  );
}
