'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { StatCards } from '@/components/common/PublicStatistics';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
export default function AdminStats({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const r = await requestJSON('/api/system-admin/public-stats'); setData(r); setCfg(r.config); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التحميل'); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data || !cfg) return <p>{notice || 'جارٍ التحميل…'}</p>;
  const def = (id: string) => data.definitions.find((d: any) => d.id === id);
  const setCard = (id: string, patch: any) => setCfg({ ...cfg, cards: cfg.cards.map((c: any) => (c.id === id ? { ...c, ...patch } : c)) });
  const move = (id: string, delta: number) => {
    const list = [...cfg.cards], i = list.findIndex((c: any) => c.id === id), j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setCfg({ ...cfg, cards: list.map((c: any, n: number) => ({ ...c, order: n })) });
  };
  const save = async () => {
    setBusy(true); setNotice('');
    try { const r = await requestJSON('/api/system-admin/public-stats', 'PUT', cfg); setCfg(r.config); setData({ ...data, config: r.config }); setNotice('حُفظت إعدادات الإحصاءات العامة.'); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); }
  };
  const previewCards = cfg.cards.filter((c: any) => c.visible).map((c: any) => ({ id: c.id, labelAr: c.labelAr, labelEn: c.labelEn, value: data.live.values[c.id] ?? 0, icon: def(c.id)?.icon ?? 'sparkles', hide: c.hideWhenZero && (data.live.values[c.id] ?? 0) === 0 })).filter((c: any) => !c.hide);
  return (
    <div className="space-y-5">
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
      <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={!canEdit} checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />عرض قسم الإحصاءات في الصفحة الرئيسية</label>
        <label className="text-sm">النطاق<select className={input} disabled={!canEdit} value={cfg.scope} onChange={e => setCfg({ ...cfg, scope: e.target.value })}><option value="GLOBAL">كل المنصة</option><option value="CITY">مدينة واحدة</option></select></label>
        {cfg.scope === 'CITY' && <label className="text-sm">المدينة<select className={input} disabled={!canEdit} value={cfg.cityId ?? ''} onChange={e => setCfg({ ...cfg, cityId: e.target.value })}><option value="">اختر…</option>{data.cities.map((c: any) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label>}
        <label className="text-sm">الفترة (للأرقام التاريخية)<select className={input} disabled={!canEdit} value={cfg.period} onChange={e => setCfg({ ...cfg, period: e.target.value })}><option value="ALL">كل الفترات</option><option value="YEAR">آخر سنة</option><option value="QUARTER">آخر ربع سنة</option><option value="MONTH">آخر شهر</option></select></label>
      </section>
      <section className="overflow-auto rounded-2xl border bg-white">
        <table className="w-full text-sm" aria-label="بطاقات الإحصاءات">
          <thead className="bg-slate-50 text-xs"><tr><th className="p-3 text-right">البطاقة</th><th className="p-2">القيمة الآن</th><th className="p-2">إظهار</th><th className="p-2">إخفاء إذا صفر</th><th className="p-2">العنوان (عربي)</th><th className="p-2">Title (English)</th><th className="p-2">الترتيب</th></tr></thead>
          <tbody>{cfg.cards.map((c: any, i: number) => <tr key={c.id} className="border-t align-top">
            <td className="p-3"><b>{def(c.id).labelAr}</b><p className="mt-1 max-w-xs text-xs text-gray-600">{def(c.id).descriptionAr}</p><p className="text-caption2 text-gray-500">{def(c.id).kind === 'history' ? 'رقم تاريخي: لا يتأثر بتعطيل الخدمات' : 'رقم حالي: يتبع الإتاحة الفعلية'}</p></td>
            <td className="p-2 text-center text-lg font-black">{new Intl.NumberFormat('ar-SA').format(data.live.values[c.id] ?? 0)}</td>
            <td className="p-2 text-center"><input aria-label={`إظهار ${def(c.id).labelAr}`} type="checkbox" disabled={!canEdit} checked={c.visible} onChange={e => setCard(c.id, { visible: e.target.checked })} /></td>
            <td className="p-2 text-center"><input aria-label={`إخفاء ${def(c.id).labelAr} إذا كانت صفراً`} type="checkbox" disabled={!canEdit} checked={c.hideWhenZero} onChange={e => setCard(c.id, { hideWhenZero: e.target.checked })} /></td>
            <td className="p-2"><input aria-label={`عنوان ${def(c.id).labelAr}`} className={input} disabled={!canEdit} maxLength={80} value={c.labelAr} onChange={e => setCard(c.id, { labelAr: e.target.value })} /></td>
            <td className="p-2"><input aria-label={`English title of ${def(c.id).labelEn}`} dir="ltr" className={input} disabled={!canEdit} maxLength={80} value={c.labelEn} onChange={e => setCard(c.id, { labelEn: e.target.value })} /></td>
            <td className="p-2 text-center"><button type="button" disabled={!canEdit || i === 0} onClick={() => move(c.id, -1)} aria-label="أعلى" className="px-2 disabled:opacity-30">▲</button><button type="button" disabled={!canEdit || i === cfg.cards.length - 1} onClick={() => move(c.id, 1)} aria-label="أسفل" className="px-2 disabled:opacity-30">▼</button></td>
          </tr>)}</tbody>
        </table>
      </section>
      {canEdit && <button disabled={busy} onClick={() => void save()} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">حفظ الإعدادات</button>}
      <section className="space-y-3 rounded-2xl bg-slate-100 p-4" aria-label="معاينة العرض العام">
        <h3 className="font-black">معاينة العرض العام (بالقيم الفعلية الآن)</h3>
        {cfg.enabled && previewCards.length ? <StatCards cards={previewCards} /> : <p className="text-sm text-gray-600">{cfg.enabled ? 'لن يظهر القسم: لا توجد بطاقة ظاهرة بقيمة.' : 'القسم مخفي عن الزوار.'}</p>}
        <p className="text-xs text-gray-600">آخر حساب: {new Date(data.live.computedAt).toLocaleString('ar-SA')}. الأرقام العامة تُخزَّن مؤقتاً لدقيقة وتُحدَّث فوراً عند تغيير الإتاحة أو هذه الإعدادات.</p>
      </section>
    </div>
  );
}
