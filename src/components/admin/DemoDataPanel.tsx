'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

type Status = { services: number; offers: number; packages: number; vendors: number; steps: number };

/** Adds or removes the demo vendors, services, offers and packages that make the marketplace look populated. */
export function DemoDataPanel() {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [note, setNote] = useState('');
  const load = useCallback(async () => { try { setStatus(await requestJSON('/api/admin/demo-data')); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [t]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    if (!status) return;
    setError(''); setNote('');
    try {
      for (let i = 0; i < status.steps; i++) { setBusy(t('جارٍ الإضافة') + ` ${i + 1}/${status.steps}`); await requestJSON('/api/admin/demo-data', 'POST', { action: 'seed', step: i }); }
      setNote(t('تمت إضافة البيانات التجريبية.'));
    } catch (e) { setError(e instanceof Error ? e.message : t('تعذر تنفيذ الطلب')); }
    setBusy(''); void load();
  };
  const remove = async () => {
    if (!window.confirm(t('سيتم حذف كل البيانات التجريبية (الموردين والخدمات والعروض والباقات). هل تريد المتابعة؟'))) return;
    setError(''); setNote(''); setBusy(t('جارٍ الحذف'));
    try {
      const r = await requestJSON('/api/admin/demo-data', 'POST', { action: 'remove' });
      setNote(r.kept ? t('تعذر حذف البيانات التجريبية لارتباطها بطلبات أو أسعار محفوظة، لذلك أُخفيت من السوق وتعود عند إعادة إضافتها.') : t('تم حذف البيانات التجريبية.'));
    } catch (e) { setError(e instanceof Error ? e.message : t('تعذر تنفيذ الطلب')); }
    setBusy(''); void load();
  };
  const has = !!status && (status.services > 0 || status.vendors > 0 || status.packages > 0);
  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 space-y-4 max-w-3xl mb-6" aria-labelledby="demo-data">
      <h4 id="demo-data" className="text-base font-bold text-gray-900 font-cairo">{t('البيانات التجريبية للسوق')}</h4>
      <p className="text-sm text-gray-700">{t('موردون وخدمات وعروض وباقات تجريبية تملأ السوق قبل انضمام الموردين الحقيقيين. الموردون التجريبيون بلا كلمة مرور ولا يمكنهم تسجيل الدخول، ويمكنك حذفها كلها في أي وقت.')}</p>
      {status && <p className="text-sm font-bold text-gray-900" role="status">{t('الحالي')}: {status.vendors} {t('موردين')} · {status.services} {t('خدمة')} · {status.offers} {t('عرضاً')} · {status.packages} {t('باقة')}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {note && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{note}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={add} disabled={!status || !!busy} className="rounded-xl bg-saudi-green-800 px-5 py-3 text-sm font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600">{busy && !busy.startsWith(t('جارٍ الحذف')) ? busy : has ? t('إكمال البيانات التجريبية') : t('إضافة بيانات تجريبية')}</button>
        <button type="button" onClick={remove} disabled={!has || !!busy} className="rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy === t('جارٍ الحذف') ? busy : t('حذف كل البيانات التجريبية')}</button>
      </div>
    </section>
  );
}
