'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { defaultFeatures, FeatureId, FeatureState, featureForPath } from '@/lib/system/feature-catalog';
import { useGeo } from '@/components/geo/GeoProvider';
import { requestJSON } from '@/lib/api-client';
import { useLocale } from '@/components/i18n/LocaleProvider';
const Context = createContext<FeatureState[]>(defaultFeatures().map(f => ({ ...f, enabled: false, visible: false })));
export default function FeatureProvider({ initial, children }: { initial: FeatureState[]; children: React.ReactNode }) {
  const [features, setFeatures] = useState(initial);
  useEffect(() => {
    let alive = true;
    const load = () => requestJSON('/api/features').then(data => { if (alive) setFeatures(data.features); }).catch(() => { if (alive) setFeatures(defaultFeatures().map(f => ({ ...f, enabled: false, visible: false }))); });
    const refresh = () => void load();
    void load(); const timer = setInterval(refresh, 10000); window.addEventListener('focus', refresh); window.addEventListener('system-features-updated', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('system-features-updated', refresh); };
  }, []);
  const geo=useGeo();
  const effective=features.map(f=>{const a=geo.data?.availability.find(r=>r.key==='feature:'+f.id);const known=geo.data?.summary!=='UNKNOWN';return known&&a&&!a.available?{...f,enabled:false,visible:f.visible&&!geo.data?.snapshot.policy.hideUnavailable}:f;});
  return <Context.Provider value={effective}>{children}</Context.Provider>;
}
export function useFeature(id: FeatureId) { return useContext(Context).find(f => f.id === id) || { id, visible: false, enabled: false, version: 0 }; }
export function useFeatureForPath(path: string) { const all = useContext(Context); const definition = featureForPath(path); return definition ? all.find(f => f.id === definition.id) : undefined; }
export function FeatureContent({ id, children }: { id: FeatureId; children: React.ReactNode }) {
  const feature = useFeature(id), { locale } = useLocale();
  if (id === 'luma' && locale === 'en') return null; // the assistant speaks Arabic only
  return feature.visible && feature.enabled ? children : null;
}
