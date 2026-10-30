'use client';
import { NOTICE_UNITS, UNIT_LABELS_AR, defaultAdvanceNotice, describeMinutes, requiredMinutes } from '@/lib/booking/advance-notice';

const field = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';

/** The service's advance-booking rule: how much notice it needs, how long it takes to prepare, whether customers may ask for an exception. */
export default function AdvanceNoticeFields({ value, onChange }: { value?: any; onChange: (next: any) => void }) {
  const rule = { ...defaultAdvanceNotice(), ...(value ?? {}) };
  const set = (patch: Record<string, unknown>) => onChange({ ...rule, ...patch });
  const minutes = requiredMinutes(rule);
  return (
    <fieldset className="space-y-3 rounded-xl border border-saudi-sand-300 p-4">
      <legend className="px-1 font-bold">الحجز المسبق</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={rule.enabled} onChange={e => set({ enabled: e.target.checked })} />تطبيق حد أدنى للمدة المسبقة على هذه الخدمة</label>
      {rule.enabled && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>الحد الأدنى للمدة المسبقة<input type="number" min={0} className={field} value={rule.value} onChange={e => set({ value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
          <label>الوحدة<select className={field} value={rule.unit} onChange={e => set({ unit: e.target.value })}>{NOTICE_UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS_AR[u][0]}</option>)}</select></label>
          <label>مدة التجهيز (بالدقائق)<input type="number" min={0} className={field} value={rule.preparationMinutes} onChange={e => set({ preparationMinutes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
          <label>مدة التنفيذ (بالدقائق)<input type="number" min={0} className={field} value={rule.serviceDurationMinutes} onChange={e => set({ serviceDurationMinutes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
          <label>المنطقة الزمنية<input dir="ltr" className={field} value={rule.timezone} onChange={e => set({ timezone: e.target.value })} /></label>
          <label>إغلاق الحجز بعد (اختياري)<input type="datetime-local" className={field} value={rule.cutoffAt ? new Date(Date.parse(rule.cutoffAt) + 10800000).toISOString().slice(0, 16) : ''} onChange={e => set({ cutoffAt: e.target.value ? new Date(e.target.value + ':00+03:00').toISOString() : null })} /></label>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={rule.allowExceptionRequests} onChange={e => set({ allowExceptionRequests: e.target.checked })} />السماح للعميل بطلب استثناء إذا لم تُستوفَ المدة</label>
        <p className="text-sm text-gray-700">المدة المطلوبة فعلياً: <strong>{minutes ? describeMinutes(minutes) : 'لا يوجد حد'}</strong>. تُطبّق الأطول بين هذه المدة وشروط العرض والمورد وسياسات التوفر.</p>
      </>}
    </fieldset>
  );
}
