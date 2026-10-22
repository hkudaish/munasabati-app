'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
import { useApp } from '@/lib/store';
import AdminMatrix from './AdminMatrix';
import AdminPreview from './AdminPreview';
import AdminStats from './AdminStats';
import PolicyEditor from './PolicyEditor';
import { BOOKING_AR, ENTITY_AR, STATUS_AR, STATUS_TONE, VISIBILITY_AR } from './labels';

type Tab = 'overview' | 'matrix' | 'preview' | 'stats' | 'audit' | 'interest';
const TABS: [Tab, string][] = [['overview', 'السياسات والتحكم العام'], ['matrix', 'مصفوفة الإتاحة'], ['preview', 'معاينة كعميل'], ['stats', 'الإحصاءات العامة'], ['audit', 'سجل التغييرات'], ['interest', 'طلبات الاهتمام']];
const small = 'rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-slate-50';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const when = (p: any) => (p.effectiveFrom || p.effectiveUntil ? `${p.effectiveFrom ? new Date(p.effectiveFrom).toLocaleDateString('ar-SA') : '…'} → ${p.effectiveUntil ? new Date(p.effectiveUntil).toLocaleDateString('ar-SA') : '…'}` : 'دائمة');
const inForce = (p: any) => (!p.effectiveFrom || Date.parse(p.effectiveFrom) <= Date.now()) && (!p.effectiveUntil || Date.parse(p.effectiveUntil) > Date.now());
function Chip({ status }: { status: string }) { return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[status]}`}>{STATUS_AR[status]}</span>; }

/** The availability console: global controls, policies, the services × cities matrix, the customer preview, statistics settings, history and interest requests. */
export default function AdminAvailability() {
  const { currentUser } = useApp();
  const canEdit = currentUser?.hasSystemAccess === true;
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{ initial?: any; preset?: any } | null>(null);
  const [filter, setFilter] = useState({ type: '', status: '', q: '' });
  const load = useCallback(async () => { try { setData(await requestJSON('/api/system-admin/availability')); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التحميل'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const nameOf = useCallback((type: string, id: string) => (data?.entities[type] ?? []).find((e: any) => e.id === id)?.name ?? id, [data]);
  const current = (type: string, id: string) => (data?.policies ?? []).filter((p: any) => p.entityType === type && p.entityId === id && inForce(p)).sort((a: any, b: any) => b.priority - a.priority)[0];
  const rows = useMemo(() => (data?.policies ?? []).filter((p: any) => (!filter.type || p.entityType === filter.type) && (!filter.status || p.configuredStatus === filter.status) && (!filter.q || nameOf(p.entityType, p.entityId).includes(filter.q))), [data, filter, nameOf]);
  const remove = async (p: any) => {
    const reason = window.prompt(`حذف سياسة «${nameOf(p.entityType, p.entityId)}» يعيد الكيان إلى وضعه الافتراضي. اكتب سبب الحذف:`);
    if (!reason?.trim()) return;
    try { await requestJSON('/api/system-admin/availability', 'DELETE', { id: p.id, reason }); setNotice('حُذفت السياسة وسُجّل ذلك في السجل.'); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحذف'); }
  };
  if (!data) return <div dir="rtl" className="p-6" role="status">{notice || 'جارٍ تحميل إدارة الإتاحة…'}</div>;
  const platform = current('PLATFORM', 'platform');
  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-950 p-6 text-white">
        <div><h1 className="text-2xl font-black">إدارة إتاحة المنصة والخدمات</h1><p className="mt-1 text-sm text-slate-300">الحالة المضبوطة، الظهور، أهلية الحجز، السعة والتغطية الجغرافية: أبعاد منفصلة يقيّمها محرك واحد في الخادم.</p></div>
        <div className="flex gap-3 text-sm"><Link href="/system-admin" className="rounded-xl bg-white/10 px-4 py-2">مدير النظام</Link><Link href="/system-admin/geography" className="rounded-xl bg-amber-400 px-4 py-2 text-slate-950">الدول والمدن وقواعد التغطية</Link></div>
      </header>
      {!canEdit && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">عرض للقراءة فقط: تعديل الإتاحة متاح لمدير النظام.</p>}
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
      <div role="tablist" aria-label="أقسام إدارة الإتاحة" className="flex flex-wrap gap-2">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setNotice(''); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}</div>

      {tab === 'overview' && <div className="space-y-5">
        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="تحكم المنصة">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">المنصة كاملة</h2><p className="text-xs text-gray-600">يتحكم في المعاملات الجديدة في كل الوحدات. يبقى بإمكان العملاء رؤية طلباتهم وطلب الدعم.</p></div>{platform ? <Chip status={platform.configuredStatus} /> : <Chip status="ACTIVE" />}</div>
          {canEdit && <div className="flex flex-wrap gap-2">
            <button className={small} onClick={() => setEditor(platform ? { initial: platform } : { preset: { entityType: 'PLATFORM', entityId: 'platform' } })}>{platform ? 'تعديل سياسة المنصة' : 'إنشاء سياسة للمنصة'}</button>
            {!platform && <><button className={small} onClick={() => setEditor({ preset: { entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'MAINTENANCE' } })}>وضع الصيانة</button><button className={small} onClick={() => setEditor({ preset: { entityType: 'PLATFORM', entityId: 'platform', configuredStatus: 'TEMPORARILY_SUSPENDED' } })}>إيقاف مؤقت للمعاملات</button></>}
            {platform && platform.configuredStatus !== 'ACTIVE' && <button className={small} onClick={() => setEditor({ initial: platform, preset: undefined })}>استعادة التشغيل (تعديل الحالة إلى متاحة)</button>}
          </div>}
        </section>
        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="الوحدات التشغيلية">
          <h2 className="font-black">الوحدات التشغيلية</h2><p className="text-xs text-gray-600">لإيقاف ميزة كاملة من الواجهة استخدم أيضاً «إعدادات الميزات» في مدير النظام؛ هنا تتحكم بالحالة والرسالة والجدولة.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.entities.MODULE.map((m: any) => { const p = current('MODULE', m.id); return <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border p-3"><div><p className="text-sm font-bold">{m.name}</p><Chip status={p?.configuredStatus ?? 'ACTIVE'} /></div>{canEdit && <button className={small} onClick={() => setEditor(p ? { initial: p } : { preset: { entityType: 'MODULE', entityId: m.id } })}>{p ? 'تعديل' : 'ضبط'}</button>}</div>; })}</div>
        </section>
        <section className="space-y-3 rounded-2xl border bg-white p-5" aria-label="السياسات">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-black">كل السياسات ({rows.length})</h2>
            {canEdit && <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white" onClick={() => setEditor({})}>+ سياسة جديدة</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">النطاق<select className={input} value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}><option value="">الكل</option>{data.entityTypes.map((t: string) => <option key={t} value={t}>{ENTITY_AR[t]}</option>)}</select></label>
            <label className="text-sm">الحالة<select className={input} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}><option value="">الكل</option>{data.statuses.map((s: string) => <option key={s} value={s}>{STATUS_AR[s]}</option>)}</select></label>
            <label className="text-sm">بحث بالاسم<input className={input} value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} /></label>
          </div>
          <div className="overflow-auto"><table className="w-full whitespace-nowrap text-sm" aria-label="جدول السياسات"><thead className="bg-slate-50 text-xs"><tr><th className="p-2 text-right">الكيان</th><th className="p-2">الحالة</th><th className="p-2">الظهور</th><th className="p-2">الحجز</th><th className="p-2">الفترة</th><th className="p-2">أولوية</th><th className="p-2">قواعد</th><th className="p-2"></th></tr></thead>
            <tbody>{rows.map((p: any) => <tr key={p.id} className="border-t"><td className="p-2"><b>{nameOf(p.entityType, p.entityId)}</b><span className="block text-xs text-gray-500">{ENTITY_AR[p.entityType]}</span></td><td className="p-2 text-center"><Chip status={p.configuredStatus} />{!inForce(p) && <span className="block text-caption2 text-gray-500">غير سارية الآن</span>}</td><td className="p-2 text-center text-xs">{VISIBILITY_AR[p.visibilityMode]}</td><td className="p-2 text-center text-xs">{BOOKING_AR[p.bookingMode]}</td><td className="p-2 text-center text-xs">{when(p)}</td><td className="p-2 text-center">{p.priority}</td><td className="p-2 text-center text-xs">{p.geoRules.length} جغرافية · {p.schedules.length} جدول</td>
              <td className="p-2">{canEdit && <><button className={small} onClick={() => setEditor({ initial: p })}>تعديل</button> <button className={`${small} text-red-700`} onClick={() => void remove(p)}>حذف</button></>}</td></tr>)}</tbody></table>
            {!rows.length && <p className="p-6 text-center text-sm text-gray-500">لا توجد سياسات؛ كل الخدمات تعمل وفق التغطية الحالية.</p>}</div>
        </section>
      </div>}
      {tab === 'matrix' && <AdminMatrix canEdit={canEdit} />}
      {tab === 'preview' && <AdminPreview data={data} />}
      {tab === 'stats' && <AdminStats canEdit={canEdit} />}
      {tab === 'audit' && <AuditTab nameOf={nameOf} />}
      {tab === 'interest' && <InterestTab canEdit={canEdit} nameOf={nameOf} cities={data.places.cities} />}
      {editor && <PolicyEditor data={data} initial={editor.initial} preset={editor.preset} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('حُفظت السياسة وسُجّل التغيير.'); void load(); }} />}
    </div>
  );
}

function AuditTab({ nameOf }: { nameOf: (t: string, id: string) => string }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  useEffect(() => { requestJSON(`/api/system-admin/availability/audit?page=${page}`).then(setData).catch(() => setData({ rows: [], total: 0 })); }, [page]);
  if (!data) return <p>جارٍ التحميل…</p>;
  const names: Record<string, string> = { POLICY_CREATED: 'إنشاء سياسة', POLICY_UPDATED: 'تعديل سياسة', STATUS_CHANGED: 'تغيير حالة', POLICY_DELETED: 'حذف سياسة', BULK_APPLIED: 'تعديل جماعي', INTEREST_NOTIFIED: 'إبلاغ المهتمين', STATS_CONFIG_SAVED: 'حفظ إعدادات الإحصاءات' };
  return <section className="space-y-3 rounded-2xl border bg-white p-4" aria-label="سجل التغييرات">
    <p className="text-xs text-gray-600">السجل للإضافة فقط: لا يمكن تعديل أو حذف أي سطر منه، حتى لو حُذفت السياسة نفسها.</p>
    <div className="overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs"><tr><th className="p-2 text-right">الوقت</th><th className="p-2">الإجراء</th><th className="p-2">الكيان</th><th className="p-2">المنفّذ</th><th className="p-2">السبب</th><th className="p-2">التفاصيل</th></tr></thead>
      <tbody>{data.rows.map((r: any) => <tr key={r.id} className="border-t align-top"><td className="p-2 text-xs">{new Date(r.createdAt).toLocaleString('ar-SA')}</td><td className="p-2 text-center font-bold">{names[r.action] ?? r.action}</td><td className="p-2 text-xs">{r.entityType ? `${ENTITY_AR[r.entityType] ?? r.entityType}: ${nameOf(r.entityType, r.entityId)}` : '—'}</td><td className="p-2 text-center font-mono text-xs">{(r.actorId ?? '').slice(0, 8)}</td><td className="p-2 text-xs">{r.reason ?? ''}</td><td className="p-2"><details><summary className="cursor-pointer text-xs">قبل / بعد</summary><pre dir="ltr" className="mt-1 max-h-48 max-w-md overflow-auto rounded bg-slate-950 p-2 text-caption2 text-slate-100">{JSON.stringify({ before: r.previousValue, after: r.newValue }, null, 1)}</pre></details></td></tr>)}</tbody></table>
      {!data.rows.length && <p className="p-6 text-center text-sm text-gray-500">لا توجد تغييرات مسجلة بعد.</p>}</div>
    <div className="flex items-center gap-3 text-sm"><button className={small} disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button><span>{page * 50 + 1}–{Math.min(data.total, page * 50 + data.rows.length)} من {data.total}</span><button className={small} disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>التالي</button></div>
  </section>;
}
function InterestTab({ canEdit, nameOf, cities }: { canEdit: boolean; nameOf: (t: string, id: string) => string; cities: any[] }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => requestJSON('/api/system-admin/availability/interest').then(r => setRows(r.rows)).catch(() => setRows([])), []);
  useEffect(() => { void load(); }, [load]);
  if (!rows) return <p>جارٍ التحميل…</p>;
  const mark = async (row: any) => { try { const r = await requestJSON('/api/system-admin/availability/interest', 'POST', { serviceId: row.serviceId, cityId: row.cityId }); setNotice(`وُسم ${r.notified} مهتماً كمُبلَّغين.`); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر التنفيذ'); } };
  return <section className="space-y-3 rounded-2xl border bg-white p-4" aria-label="طلبات الاهتمام">
    <p className="text-xs text-gray-600">عملاء طلبوا إبلاغهم عند توفر خدمة في مدينة. بعد فتح الخدمة تواصل معهم عبر قنوات الرسائل المفعلة ثم اضغط «تم إبلاغهم». لا تُرسل رسائل تلقائياً من هذه الشاشة.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <table className="w-full text-sm"><thead className="bg-slate-50 text-xs"><tr><th className="p-2 text-right">الخدمة</th><th className="p-2">المدينة</th><th className="p-2">الحالة</th><th className="p-2">العدد</th><th className="p-2"></th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{nameOf('SERVICE', r.serviceId)}</td><td className="p-2 text-center">{cities.find(c => c.id === r.cityId)?.nameAr ?? r.cityId}</td><td className="p-2 text-center text-xs">{r.status === 'ACTIVE' ? 'بانتظار الإبلاغ' : r.status === 'NOTIFIED' ? 'تم إبلاغهم' : r.status}</td><td className="p-2 text-center font-bold">{r.count}</td><td className="p-2">{canEdit && r.status === 'ACTIVE' && <button className={small} onClick={() => void mark(r)}>تم إبلاغهم</button>}</td></tr>)}</tbody></table>
    {!rows.length && <p className="p-6 text-center text-sm text-gray-500">لا توجد طلبات اهتمام.</p>}
  </section>;
}
