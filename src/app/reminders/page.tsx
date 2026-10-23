'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, BellRing } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

interface Item { id: string; kind: string; severity: 'critical' | 'warning' | 'info'; titleAr: string; detailAr: string; dueAt: string | null; url: string; vendorName?: string | null }
const GROUPS: { key: Item['severity']; title: string; tone: string }[] = [
  { key: 'critical', title: 'عاجل — يحتاج تصرفاً الآن', tone: 'border-red-300 bg-red-50' },
  { key: 'warning', title: 'تحذيرات', tone: 'border-amber-300 bg-amber-50' },
  { key: 'info', title: 'للعلم والمتابعة', tone: 'border-saudi-sand-300 bg-white' },
];
const when = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(iso));

export default function RemindersPage() {
  const [data, setData] = useState<{ reminders: Item[]; counts: { critical: number; warning: number; info: number; total: number }; recent: { id: string; title: string; text: string; url: string; createdAt: string }[] } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => requestJSON('/api/reminders').then(setData).catch(e => setError(e instanceof Error ? e.message : 'تعذر التحميل')), []);
  useEffect(() => { void load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  if (error) return <div dir="rtl" className="mx-auto max-w-3xl p-8"><p role="alert" className="rounded-xl border bg-amber-50 p-4">{error === 'غير مخول' ? 'هذه الصفحة للإدارة والمنسقين والموردين.' : error}</p></div>;
  if (!data) return <div dir="rtl" className="p-8">جارٍ التحميل…</div>;
  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 font-cairo text-2xl font-black text-saudi-green-950"><BellRing className="h-6 w-6" aria-hidden="true" />تنبيهات العمل</h1><p className="text-sm text-gray-600">الخدمات المستحقة والمشكلات والملاحظات التي تحتاج متابعتك، محسوبة من البيانات الحالية وتختفي بمجرد معالجتها.</p></div><button onClick={() => void load()} className="text-sm underline">تحديث</button></header>
      {data.counts.total === 0 && <p className="rounded-2xl border border-saudi-green-200 bg-saudi-green-50 p-6 text-center font-bold">لا توجد تنبيهات الآن. كل شيء تحت السيطرة.</p>}
      {GROUPS.map(g => { const list = data.reminders.filter(r => r.severity === g.key); return list.length ? (
        <section key={g.key} aria-label={g.title} className="space-y-2"><h2 className="font-bold">{g.title} ({list.length})</h2>
          {list.map(r => (
            <Link key={r.id} href={r.url} className={`block rounded-xl border p-4 ${g.tone}`}>
              <span className="flex items-center gap-1.5 font-bold">{r.severity === 'info' ? <Info className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}{r.titleAr}</span>
              <span className="mt-1 block whitespace-pre-line text-sm text-gray-700">{r.detailAr}</span>
              <span className="mt-1 block text-xs text-gray-500">{r.vendorName && `${r.vendorName} · `}{r.dueAt && `الموعد: ${when(r.dueAt)}`}</span>
            </Link>))}
        </section>) : null; })}
      {data.recent.length > 0 && <section aria-label="آخر الرسائل" className="space-y-2"><h2 className="font-bold">آخر ما أُرسل إليك</h2>{data.recent.map(n => <Link key={n.id} href={n.url || '/reminders'} className="block rounded-xl border border-saudi-sand-300 bg-white p-3 text-sm"><strong>{n.title}</strong><span className="block whitespace-pre-line text-gray-600">{n.text}</span><span className="text-xs text-gray-500">{when(n.createdAt)}</span></Link>)}</section>}
    </div>
  );
}
