'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import type { CatalogOptions } from '@/lib/catalog/types';
export function useCatalogOptions() {
  const [options, setOptions] = useState<CatalogOptions>({ subcategories: [], artists: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setOptions(await requestJSON('/api/catalog/options')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل الخيارات'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 30000); const onUpdate = () => void refresh(); window.addEventListener('catalog-updated', onUpdate); return () => { clearInterval(timer); window.removeEventListener('catalog-updated', onUpdate); }; }, [refresh]);
  return { ...options, loading, error, refresh };
}
