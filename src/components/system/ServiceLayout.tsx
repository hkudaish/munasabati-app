import Link from 'next/link';
import ServiceBoundary from './ServiceBoundary';
import { FeatureId } from '@/lib/system/feature-catalog';
import { featureStates } from '@/lib/server/features';
import { getT } from '@/lib/i18n/server';
export default async function ServiceLayout({ id, children }: { id: FeatureId; children: React.ReactNode }) {
  const t = await getT();
  let enabled = false;
  try { enabled = !!(await featureStates()).find(f => f.id === id)?.enabled; } catch {}
  if (!enabled) return <div role="status" className="max-w-2xl mx-auto p-12 text-center space-y-3"><h1 className="font-bold text-xl">{t('الخدمة غير متاحة حالياً')}</h1><p>{t('يمكنك العودة للرئيسية واختيار خدمة أخرى.')}</p><Link href="/" className="underline">{t('الرئيسية')}</Link></div>;
  return <ServiceBoundary id={id}>{children}</ServiceBoundary>;
}
