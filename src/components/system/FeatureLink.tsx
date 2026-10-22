'use client';
import Link from '@/components/i18n/Link';
import { ComponentProps } from 'react';
import { useFeatureForPath } from './FeatureProvider';
import { useT } from '@/components/i18n/LocaleProvider';
export default function FeatureLink(props: ComponentProps<typeof Link>) {
  const t = useT();
  const href = typeof props.href === 'string' ? props.href : props.href.pathname || '';
  const feature = useFeatureForPath(href.split('?')[0]);
  if (feature && !feature.visible) return null;
  if (feature && !feature.enabled) return <span className={props.className} aria-disabled="true" title={t('الخدمة معطلة حالياً')} style={{ opacity: 0.5 }}>{props.children}</span>;
  return <Link {...props} />;
}
