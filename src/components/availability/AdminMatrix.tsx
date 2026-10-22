'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { REASON_AR, STATUS_AR, STATUS_TONE } from './labels';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const SHORT: Record<string, string> = { ACTIVE: 'متاحة', PARTIALLY_AVAILABLE: 'جزئية', COMING_SOON: 'قريباً', TEMPORARILY_SUSPENDED: 'موقوفة', DISABLED: 'معطلة', MAINTENANCE: 'صيانة' };
const CHANGES: { id: string; label: string; body: { geographicEffect: string; statusOverride?: string | null } }[] = [
  { id: 'active', label: 'تفعيل (متاحة)', body: { geographicEffect: 'ALLOW', statusOverride: 'ACTIVE' } },
  { id: 'soon', label: 'قريباً', body: { geographicEffect: 'ALLOW', statusOverride: 'COMING_SOON' } },
  { id: 'suspended', label: 'إيقاف مؤقت', body: { geographicEffect: 'ALLOW', statusOverride: 'TEMPORARILY_SUSPENDED' } },
  { id: 'maintenance', label: 'صيانة', body: { geographicEffect: 'ALLOW', statusOverride: 'MAINTENANCE' } },
  { id: 'deny', label: 'منع في هذه المدن', body: { geographicEffect: 'DENY' } },
  { id: 'remove', label: 'إزالة القاعدة (العودة للوضع الافتراضي)', body: { geographicEffect: 'REMOVE' } },
];

export default function AdminMatrix({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState({ categoryId: '', search: '', status: '' });
  const [rows, setRows] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState<Set<string>>(new Set());
  const [change, setChange] = useState('soon');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    try { setData(await requestJSON('/api/system-admin/availability/matrix?' + q.toString())); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التحميل'); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);
  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); apply(next); setPreview(null); };
  const body = () => ({ targets: Array.from(rows).map(entityId => ({ entityType: 'SERVICE', entityId })), cityIds: Array.from(cols), change: CHANGES.find(c => c.id === change)!.body, reason: reason.trim() });
  const run = async (apply: boolean) => {
    setBusy(true); setNotice('');
    try {
      const result = await requestJSON('/api/system-admin/availability/bulk', 'POST', { ...body(), dryRun: !apply });
      if (apply) { setNotice(`طُبّق التغيير على ${result.policies} سياسة (${result.affectedCount} خلية تغيّرت).`); setPreview(null); setRows(new Set()); setCols(new Set()); await load(); } else setPreview(result);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التنفيذ'); } finally { setBusy(false); }
  };
  if (!data) return <p>{notice || 'جارٍ تحميل المصفوفة…'}</p>;
  const ready = rows.size > 0 && cols.size > 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">التصنيف<select className={input} value={filters.categoryId} onChange={e => setFilters({ ...filters, categoryId: e.target.value })}><option value="">كل التصنيفات</option>{data.categories.map((c: any) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label>
        <label className="text-sm">الحالة<select className={input} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">كل الحالات</option>{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm sm:col-span-2">بحث بالاسم<input className={input} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs" aria-label="دليل الألوان">{Object.entries(SHORT).map(([k, v]) => <span key={k} className={`rounded-full border px-2 py-0.5 font-bold ${STATUS_TONE[k]}`}>{v}</span>)}<span className="px-2 py-0.5">● = مغلقة للحجز الآن رغم حالتها (سعة أو جدول)</span></div>
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
      <div className="overflow-auto rounded-2xl border bg-white">
        <table className="w-full whitespace-nowrap text-xs" aria-label="مصفوفة إتاحة الخدمات">
          <thead className="bg-slate-50"><tr><th className="p-3 text-right">الخدمة</th>{data.cities.map((c: any) => <th key={c.id} className="p-2">{canEdit && <input type="checkbox" aria-label={`اختيار ${c.nameAr}`} checked={cols.has(c.id)} onChange={() => toggle(cols, c.id, setCols)} className="ml-1" />}{c.nameAr}</th>)}</tr></thead>
          <tbody>{data.rows.map((r: any) => <tr key={r.serviceId} className="border-t">
            <td className="p-3 font-bold">{canEdit && <input type="checkbox" aria-label={`اختيار ${r.title}`} checked={rows.has(r.serviceId)} onChange={() => toggle(rows, r.serviceId, setRows)} className="ml-2" />}{r.title}<span className="block text-caption2 font-normal text-gray-500">{r.vendorName ?? 'منصة مناسبتـي'}</span></td>
            {data.cities.map((c: any) => { const cell = r.cells[c.id]; return <td key={c.id} className="p-1 text-center"><span title={cell.m || REASON_AR['STATUS_' + cell.s]} className={`inline-block min-w-[64px] rounded-lg border px-2 py-1 font-bold ${STATUS_TONE[cell.s]}`}>{SHORT[cell.s]}{!cell.b && (cell.s === 'ACTIVE' || cell.s === 'PARTIALLY_AVAILABLE') ? ' ●' : ''}</span></td>; })}
          </tr>)}</tbody>
        </table>
        {!data.rows.length && <p className="p-6 text-center text-sm text-gray-500">لا توجد خدمات منشورة مطابقة.</p>}
      </div>
      {canEdit && <section className="space-y-3 rounded-2xl border bg-slate-50 p-4" aria-label="تعديل جماعي">
        <h3 className="font-black">تعديل جماعي ({rows.size} خدمة × {cols.size} مدينة)</h3>
        <p className="text-xs text-gray-600">يُنشئ أو يعدّل قاعدة جغرافية على سياسة كل خدمة محددة. لا يُطبَّق شيء قبل المعاينة والتأكيد وكتابة السبب.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">التغيير<select className={input} value={change} onChange={e => { setChange(e.target.value); setPreview(null); }}>{CHANGES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">سبب التغيير (مطلوب للتطبيق)<input className={input} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        </div>
        <div className="flex gap-3"><button disabled={!ready || busy} onClick={() => void run(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">معاينة التأثير</button><button disabled={!ready || busy || !preview || !reason.trim()} onClick={() => void run(true)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">تطبيق التغيير</button></div>
        {preview && <div className="space-y-2 text-sm" aria-label="نتيجة المعاينة">
          <p className="font-bold">سيتغير وضع {preview.affectedCount} خلية.</p>
          {preview.conflicts.map((c: any, i: number) => <p key={i} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs">⚠ {c.message}</p>)}
          <div className="max-h-56 overflow-auto rounded-xl border bg-white"><table className="w-full text-xs"><tbody>{preview.affected.slice(0, 80).map((a: any, i: number) => <tr key={i} className="border-b"><td className="p-2">{a.title}</td><td className="p-2">{a.city}</td><td className="p-2">{SHORT[a.before.status]}{a.before.canBook ? '' : ' (مغلقة)'} ← {SHORT[a.after.status]}{a.after.canBook ? '' : ' (مغلقة)'}</td></tr>)}</tbody></table></div>
        </div>}
      </section>}
    </div>
  );
}
