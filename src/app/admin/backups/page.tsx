'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DatabaseBackup, ShieldCheck, RefreshCw, History, Eye, AlertTriangle, CheckCircle2, Lock, Cloud, Clock, X } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

type Backup = { id: string; type: 'full' | 'incremental'; createdAt: string; parent: string | null; rows: number; upserts: number; deletes: number; bytes: number; encrypted: boolean; label: string };
type Totals = { toAdd: number; toRemove: number; toChange: number; unchanged?: number };
type PreviewTable = { table: string; backupRows: number; liveRows: number; toAdd: number; toRemove: number; toChange: number };
type Preview = { head: { id: string; createdAt: string; rows: number }; chainLength: number; totals: Totals; tables: PreviewTable[]; sessionsRevoked: boolean };
type Request = { id: string; backupId: string; backupCreatedAt: string; status: 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED' | 'EXPIRED'; requestedBy: { id: string; name: string }; requestedAt: string; expiresAt: string; approvedBy?: { id: string; name: string }; preview: { totals: Totals }; result?: { rows: number; verified: boolean; safetyBackupId: string | null }; error?: string };
type Overview = {
  viewer: { id: string; isSystemAdmin: boolean };
  config: { storage: 'cloud' | 'local'; storageLabel: string; encrypted: boolean; schedule: 'hourly' | 'off'; nextBackup: { type: string; why: string }; keyMissingInCloud: boolean };
  health: 'ok' | 'stale' | 'bad' | 'none';
  newest: { id: string; createdAt: string; ageMinutes: number } | null;
  backups: Backup[]; requests: Request[];
  history: { id: string; action: string; targetId: string; at: string; by: string }[];
};

const fmt = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const kb = (n: number) => (n < 1024 ? n + ' ب' : (n / 1024).toFixed(1) + ' ك.ب');
const age = (m: number) => (m < 1 ? 'الآن' : m < 60 ? `منذ ${m} دقيقة` : m < 1440 ? `منذ ${Math.floor(m / 60)} ساعة` : `منذ ${Math.floor(m / 1440)} يوم`);
const ACTIONS: Record<string, string> = {
  BACKUP_RUN: 'نسخة احتياطية', BACKUP_VERIFY: 'تحقق من نسخة', BACKUP_PREVIEW: 'معاينة استعادة', BACKUP_RESTORE_REQUESTED: 'طلب استعادة',
  BACKUP_RESTORE_APPROVED: 'موافقة على الاستعادة', BACKUP_RESTORE_DONE: 'استعادة مكتملة', BACKUP_RESTORE_FAILED: 'فشلت الاستعادة',
  BACKUP_RESTORE_MISMATCH: 'استعادة مع اختلافات', BACKUP_RESTORE_CANCELLED: 'إلغاء طلب استعادة',
};
const STATUS: Record<Request['status'], string> = { PENDING: 'بانتظار الموافقة', DONE: 'تمت الاستعادة', FAILED: 'فشلت', CANCELLED: 'أُلغي', EXPIRED: 'انتهت صلاحيته' };
const HEALTH = {
  ok: { label: 'سليمة', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  stale: { label: 'متأخرة', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  bad: { label: 'متوقفة', cls: 'bg-red-100 text-red-900 border-red-300' },
  none: { label: 'لا توجد نسخ', cls: 'bg-slate-100 text-slate-800 border-slate-300' },
} as const;
const button = 'rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-50';
const ghost = 'rounded-xl border border-saudi-sand-300 bg-white hover:bg-saudi-sand-100 px-3 py-1.5 text-sm font-bold disabled:opacity-50';

export default function BackupsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [approving, setApproving] = useState<Request | null>(null);
  const [restored, setRestored] = useState<Request | null>(null);

  const load = useCallback(async () => {
    try { setData(await requestJSON('/api/system-admin/backups')); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل البيانات' }); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);

  const act = async (key: string, payload: Record<string, unknown>, done: (r: any) => string | void) => {
    setBusy(key); setNotice(null);
    try { const r = await requestJSON('/api/system-admin/backups', 'POST', payload); const text = done(r); if (text) setNotice({ kind: 'ok', text }); await load(); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء' }); }
    finally { setBusy(''); }
  };
  // After a restore every session is revoked, so the page must not refresh itself: show the outcome instead.
  const approve = async (request: Request) => {
    setBusy('approve'); setNotice(null);
    try {
      const r = await requestJSON('/api/system-admin/backups', 'POST', { action: 'approve-restore', id: request.id, confirm: confirmText });
      setApproving(null); setRestored(r.request);
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'تعذر تنفيذ الاستعادة' }); setApproving(null); }
    finally { setBusy(''); }
  };
  const pending = useMemo(() => data?.requests.find(r => r.status === 'PENDING'), [data]);
  const isSystem = !!data?.viewer.isSystemAdmin;

  if (restored) return (
    <div role="dialog" aria-modal="true" aria-labelledby="restored-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" dir="rtl">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6">
        <h2 id="restored-title" className="flex items-center gap-2 font-cairo text-xl font-black text-emerald-900"><CheckCircle2 className="h-6 w-6" aria-hidden="true" />{restored.result?.verified ? 'اكتملت الاستعادة' : 'اكتملت الاستعادة مع اختلافات'}</h2>
        <p className="text-sm">{restored.result?.verified ? `أُعيدت بيانات الموقع إلى حالتها في ${fmt(restored.backupCreatedAt)} وتم التحقق من ${restored.result.rows} سجل.` : 'راجع سجل العمليات لمعرفة الاختلافات.'}</p>
        {restored.result?.safetyBackupId && <p className="rounded-xl bg-saudi-sand-100 p-3 text-xs">نسخة الأمان من البيانات السابقة محفوظة: <span className="font-mono" dir="ltr">{restored.result.safetyBackupId}</span></p>}
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">سُجّل خروج جميع المستخدمين، ويلزم تسجيل الدخول من جديد.</p>
        <button className={button} onClick={() => window.location.assign('/')}>العودة إلى الصفحة الرئيسية</button>
      </div>
    </div>);
  if (!data) return <div className="mx-auto max-w-6xl p-6 text-sm text-gray-600" role="status">{notice ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{notice.text}</p> : 'جاري التحميل…'}</div>;
  const health = HEALTH[data.health];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-cairo text-2xl font-black text-saudi-green-950"><DatabaseBackup className="h-7 w-7 text-saudi-green-800" aria-hidden="true" />النسخ الاحتياطي</h1>
          <p className="mt-1 text-sm text-gray-600">نسخ تراكمية مشفّرة لقاعدة البيانات، تؤخذ كل ساعة تلقائياً وتُحفظ على Netlify. الاستعادة تمر بمعاينة وبموافقة مسؤولين اثنين.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} onClick={() => void load()}><RefreshCw className="ms-1 inline h-4 w-4" aria-hidden="true" /> تحديث</button>
          {isSystem && <button className={button} disabled={!!busy} onClick={() => void act('run', { action: 'run', type: 'auto' }, r => `تم أخذ نسخة (${r.result.type === 'full' ? 'كاملة' : 'تراكمية'}): ${r.result.changed} تغيير`)}>{busy === 'run' ? 'جاري النسخ…' : 'خذ نسخة الآن'}</button>}
          {isSystem && <button className={ghost} disabled={!!busy} onClick={() => void act('full', { action: 'run', type: 'full' }, () => 'تم أخذ نسخة كاملة')}>نسخة كاملة</button>}
        </div>
      </header>

      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm font-bold ${notice.kind === 'error' ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>{notice.text}</p>}
      {data.config.keyMissingInCloud && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />مفتاح التشفير (BACKUP_ENCRYPTION_KEY) غير مضبوط في إعدادات Netlify، لذلك لن تؤخذ نسخ جديدة حتى يُضبط.</p>}
      {data.config.storage === 'cloud' && data.config.schedule === 'off' && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />الجدولة التلقائية غير مفعّلة (BACKUP_CRON_TOKEN غير مضبوط). النسخ تؤخذ يدوياً فقط.</p>}
      {data.config.storage === 'local' && <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">وضع التطوير: تُحفظ النسخ في مجلد محلي ({data.config.storageLabel}).</p>}

      <section aria-label="الحالة" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-saudi-sand-300 bg-white p-4 shadow-card"><p className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><ShieldCheck className="h-4 w-4" aria-hidden="true" />حالة النسخ</p><p className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-black ${health.cls}`}>{health.label}</p><p className="mt-2 text-xs text-gray-600">{data.newest ? `آخر نسخة ${age(data.newest.ageMinutes)}` : 'لم تؤخذ نسخة بعد'}</p></div>
        <div className="rounded-2xl border border-saudi-sand-300 bg-white p-4 shadow-card"><p className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><Cloud className="h-4 w-4" aria-hidden="true" />مكان الحفظ</p><p className="mt-2 text-sm font-black">{data.config.storage === 'cloud' ? 'سحابة Netlify' : 'مجلد محلي'}</p><p className="mt-2 text-xs text-gray-600">{data.backups.length} نسخة محفوظة</p></div>
        <div className="rounded-2xl border border-saudi-sand-300 bg-white p-4 shadow-card"><p className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><Lock className="h-4 w-4" aria-hidden="true" />التشفير</p><p className={`mt-2 text-sm font-black ${data.config.encrypted ? 'text-emerald-800' : 'text-red-800'}`}>{data.config.encrypted ? <>مفعّل (<bdi>AES-256</bdi>)</> : 'غير مفعّل'}</p></div>
        <div className="rounded-2xl border border-saudi-sand-300 bg-white p-4 shadow-card"><p className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><Clock className="h-4 w-4" aria-hidden="true" />الجدولة</p><p className="mt-2 text-sm font-black">{data.config.schedule === 'hourly' ? 'كل ساعة' : 'متوقفة'}</p><p className="mt-2 text-xs text-gray-600">التالية: {data.config.nextBackup.type === 'full' ? 'كاملة' : 'تراكمية'}</p></div>
      </section>

      {data.requests.filter(r => r.status === 'PENDING').map(r => (
        <section key={r.id} aria-label="طلب استعادة معلق" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-cairo text-lg font-black text-amber-950"><AlertTriangle className="h-5 w-5" aria-hidden="true" />طلب استعادة بانتظار الموافقة</h2>
          <p className="mt-2 text-sm text-amber-950">طلب <strong>{r.requestedBy.name}</strong> استعادة بيانات الموقع إلى حالتها في <strong>{fmt(r.backupCreatedAt)}</strong>. سيُعاد {r.preview.totals.toAdd} سجل ويُحذف {r.preview.totals.toRemove} ويرجع {r.preview.totals.toChange} إلى قيمه السابقة. تنتهي صلاحية الطلب {fmt(r.expiresAt)}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.requestedBy.id !== data.viewer.id
              ? <button className={button} disabled={!!busy} onClick={() => { setApproving(r); setConfirmText(''); }}>مراجعة والموافقة</button>
              : <p className="text-sm font-bold text-amber-900">لا يمكنك الموافقة على طلبك؛ يلزم مسؤول آخر.</p>}
            <button className={ghost} disabled={!!busy} onClick={() => void act('cancel', { action: 'cancel-restore', id: r.id }, () => 'أُلغي الطلب')}>إلغاء الطلب</button>
          </div>
        </section>
      ))}

      <section aria-label="النسخ المحفوظة">
        <h2 className="mb-2 font-cairo text-lg font-black text-saudi-green-950">النسخ المحفوظة</h2>
        {data.backups.length === 0 ? <p className="rounded-2xl border border-saudi-sand-300 bg-white p-6 text-sm text-gray-600">لا توجد نسخ بعد. {isSystem ? 'اضغط «خذ نسخة الآن».' : ''}</p> : (
          <div className="overflow-x-auto rounded-2xl border border-saudi-sand-300 bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-saudi-sand-100 text-xs text-gray-700"><tr><th className="p-3 text-right">الوقت</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">السجلات</th><th className="p-3 text-right">التغييرات</th><th className="p-3 text-right">الحجم</th><th className="p-3 text-right">الإجراءات</th></tr></thead>
              <tbody>{data.backups.map(b => (
                <tr key={b.id} className="border-t border-saudi-sand-200">
                  <td className="p-3 whitespace-nowrap">{fmt(b.createdAt)}{b.label && <span className="ms-2 text-xs text-gray-500">({b.label === 'auto' ? 'تلقائية' : b.label === 'manual' ? 'يدوية' : b.label})</span>}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.type === 'full' ? 'bg-saudi-green-100 text-saudi-green-900' : 'bg-saudi-sand-200 text-slate-800'}`}>{b.type === 'full' ? 'كاملة' : 'تراكمية'}</span>{b.encrypted && <Lock className="ms-2 inline h-3.5 w-3.5 text-gray-500" aria-label="مشفرة" />}</td>
                  <td className="p-3">{b.rows}</td>
                  <td className="p-3 whitespace-nowrap">{b.type === 'full' ? '—' : `+${b.upserts} / −${b.deletes}`}</td>
                  <td className="p-3 whitespace-nowrap">{kb(b.bytes)}</td>
                  <td className="p-3">{isSystem ? <div className="flex flex-wrap gap-2">
                    <button className={ghost} disabled={!!busy} onClick={() => void act('v' + b.id, { action: 'verify', id: b.id }, r => r.result.ok ? `النسخة سليمة (${r.result.chainLength} حلقة)` : `النسخة تالفة: ${r.result.problems[0]}`)}><CheckCircle2 className="ms-1 inline h-4 w-4" aria-hidden="true" />تحقق</button>
                    <button className={ghost} disabled={!!busy} onClick={() => void act('p' + b.id, { action: 'preview', id: b.id }, r => { setPreview(r.preview); setConfirmText(''); })}><Eye className="ms-1 inline h-4 w-4" aria-hidden="true" />معاينة الاستعادة</button>
                  </div> : <span className="text-xs text-gray-500">للمشرف العام فقط</span>}</td>
                </tr>))}</tbody>
            </table>
          </div>)}
      </section>

      <section aria-label="السجل">
        <h2 className="mb-2 flex items-center gap-2 font-cairo text-lg font-black text-saudi-green-950"><History className="h-5 w-5" aria-hidden="true" />آخر العمليات</h2>
        <ul className="divide-y divide-saudi-sand-200 rounded-2xl border border-saudi-sand-300 bg-white text-sm shadow-card">
          {data.history.length === 0 && <li className="p-4 text-gray-600">لا توجد عمليات بعد.</li>}
          {data.history.map(h => <li key={h.id} className="flex flex-wrap justify-between gap-2 p-3"><span><strong>{ACTIONS[h.action] || h.action}</strong> — {h.by}</span><span className="text-xs text-gray-600">{fmt(h.at)}</span></li>)}
        </ul>
        <p className="mt-2 text-xs text-gray-600">لاستعادة نسخة من جهازك المحلي استخدم سطر الأوامر؛ راجع <Link className="underline" href="/system-admin">لوحة مدير النظام</Link> وملف docs/BACKUP.md.</p>
      </section>

      {preview && (
        <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-auto rounded-2xl bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="preview-title" className="font-cairo text-lg font-black">معاينة الاستعادة إلى {fmt(preview.head.createdAt)}</h2>
              <button aria-label="إغلاق" className="rounded-lg p-1.5 hover:bg-gray-100" onClick={() => setPreview(null)}><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <p className="rounded-xl bg-saudi-sand-100 p-3 text-sm">هذه معاينة فقط: لم يتغير أي شيء. هذا ما سيحدث لو تمت الاستعادة الآن:</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-900">{preview.totals.toAdd}</p><p className="text-xs">سجل يعود</p></div>
              <div className="rounded-xl bg-red-50 p-3"><p className="text-2xl font-black text-red-900">{preview.totals.toRemove}</p><p className="text-xs">سجل يُحذف</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-900">{preview.totals.toChange}</p><p className="text-xs">يرجع لقيمه السابقة</p></div>
            </div>
            {preview.tables.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-saudi-sand-300"><table className="w-full text-xs"><thead className="bg-saudi-sand-100"><tr><th className="p-2 text-right">الجدول</th><th className="p-2">يعود</th><th className="p-2">يُحذف</th><th className="p-2">يتغير</th></tr></thead>
                <tbody>{preview.tables.map(t => <tr key={t.table} className="border-t border-saudi-sand-200"><td className="p-2 font-mono" dir="ltr">{t.table}</td><td className="p-2 text-center">{t.toAdd}</td><td className="p-2 text-center">{t.toRemove}</td><td className="p-2 text-center">{t.toChange}</td></tr>)}</tbody></table></div>
            ) : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">لا فرق بين هذه النسخة والبيانات الحالية.</p>}
            <ul className="list-disc space-y-1 pe-5 text-sm text-gray-700">
              <li>تؤخذ نسخة أمان من البيانات الحالية قبل أي استبدال.</li>
              <li>سيُسجَّل خروج جميع المستخدمين بعد الاستعادة، ويلزم تسجيل الدخول من جديد.</li>
              <li>لا يتم التنفيذ إلا بعد موافقة مسؤول آخر غيرك خلال 30 دقيقة.</li>
            </ul>
            {isSystem && !pending && (
              <div className="space-y-2 border-t border-saudi-sand-200 pt-3">
                <label className="block text-sm font-bold">اكتب <span className="font-mono">RESTORE</span> لتقديم طلب الاستعادة
                  <input className="mt-1 w-full rounded-xl border border-saudi-sand-300 p-2 font-mono" dir="ltr" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" /></label>
                <button className={button} disabled={!!busy || confirmText !== 'RESTORE'} onClick={() => void act('request', { action: 'request-restore', id: preview.head.id, confirm: confirmText }, () => { setPreview(null); return 'تم تقديم الطلب؛ بانتظار موافقة مسؤول آخر'; })}>{busy === 'request' ? 'جاري الإرسال…' : 'تقديم طلب الاستعادة'}</button>
              </div>)}
            {pending && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">يوجد طلب استعادة معلق؛ أنهِه أو ألغِه أولاً.</p>}
          </div>
        </div>)}

      {approving && (
        <div role="dialog" aria-modal="true" aria-labelledby="approve-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5">
            <h2 id="approve-title" className="font-cairo text-lg font-black text-red-900">الموافقة على استبدال بيانات الموقع</h2>
            <p className="text-sm">ستُستبدل البيانات الحالية بحالتها في <strong>{fmt(approving.backupCreatedAt)}</strong>: يعود {approving.preview.totals.toAdd} سجل، ويُحذف {approving.preview.totals.toRemove}، ويرجع {approving.preview.totals.toChange}. تؤخذ نسخة أمان أولاً، ثم يُسجَّل خروج الجميع بما فيك.</p>
            <label className="block text-sm font-bold">اكتب <span className="font-mono">RESTORE</span> للموافقة
              <input className="mt-1 w-full rounded-xl border border-saudi-sand-300 p-2 font-mono" dir="ltr" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" autoFocus /></label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50" disabled={!!busy || confirmText !== 'RESTORE'} onClick={() => void approve(approving)}>{busy === 'approve' ? 'جاري الاستعادة…' : 'موافقة واستعادة'}</button>
              <button className={ghost} onClick={() => setApproving(null)}>رجوع</button>
            </div>
          </div>
        </div>)}
    </div>
  );
}
