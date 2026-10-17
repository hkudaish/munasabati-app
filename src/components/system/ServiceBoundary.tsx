'use client';
import { FeatureId } from '@/lib/system/feature-catalog';
import { useFeature } from './FeatureProvider';
import { useGeo } from '@/components/geo/GeoProvider';
export default function ServiceBoundary({ id, children }: { id: FeatureId; children: React.ReactNode }) {
  const feature = useFeature(id);const geo=useGeo();const rule=geo.data?.availability.find(a=>a.key==='feature:'+id);
  if(geo.loading)return <div role="status" className="m-6 h-48 rounded-2xl bg-slate-100 animate-pulse"><span className="sr-only">جارٍ التحقق من التغطية…</span></div>;
  if (!feature.enabled) return <div role="status" dir="rtl" className="max-w-2xl mx-auto p-12 text-center space-y-3"><h1 className="font-bold text-xl">الخدمة غير متاحة حالياً</h1><p>{rule?.message||rule?.reason}</p><button className="underline mx-3" onClick={geo.openPicker}>تغيير المدينة</button><a href="/" className="underline">الرئيسية</a></div>;
  return children;
}
