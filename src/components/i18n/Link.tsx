'use client';
import React, { forwardRef } from 'react';
import NextLink from 'next/link';
import { useLocale } from './LocaleProvider';
import { localizePath } from '@/lib/i18n/locale';

/** next/link that keeps English visitors on English addresses (only for pages that have an English version). */
const Link = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof NextLink>>(function Link({ href, ...props }, ref) {
  const { locale } = useLocale();
  const target = typeof href === 'string' ? localizePath(href, locale) : href && typeof href === 'object' && href.pathname ? { ...href, pathname: localizePath(href.pathname, locale) } : href;
  return <NextLink ref={ref} href={target} {...props} />;
});
export default Link;
