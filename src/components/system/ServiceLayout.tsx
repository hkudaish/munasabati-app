import ServiceBoundary from './ServiceBoundary';
import { FeatureId } from '@/lib/system/feature-catalog';
import { featureStates } from '@/lib/server/features';
export default async function ServiceLayout({ id, children }: { id: FeatureId; children: React.ReactNode }) {
  let enabled = false;
  try { enabled = !!(await featureStates()).find(f => f.id === id)?.enabled; } catch {}
  if (!enabled) return <div role="status" dir="rtl" className="max-w-2xl mx-auto p-12 text-center space-y-3"><h1 className="font-bold text-xl">الخدمة غير متاحة حالياً</h1><p>يمكنك العودة للرئيسية واختيار خدمة أخرى.</p><a href="/" className="underline">الرئيسية</a></div>;
  return <ServiceBoundary id={id}>{children}</ServiceBoundary>;
}
