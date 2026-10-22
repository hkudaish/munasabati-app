'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from '@/components/i18n/Link';
import { requestJSON } from '@/lib/api-client';
import { useT, usePick } from '@/components/i18n/LocaleProvider';

const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm focus:border-saudi-green-800';
const primary = 'rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-50';
const ghost = 'rounded-xl border px-3 py-1.5 text-xs font-bold hover:bg-saudi-sand-100 disabled:opacity-50';
const CRITERIA: [string, string][] = [['qualityRating', 'جودة العمل'], ['communicationRating', 'التواصل'], ['timelinessRating', 'الالتزام بالموعد'], ['valueRating', 'القيمة مقابل السعر']];

export function Stars({ value }: { value: number }) {
  const t = useT();
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return <span role="img" aria-label={t('{n} من 5', { n: n })} className="text-saudi-gold-600">{'★'.repeat(n)}<span className="text-gray-300">{'★'.repeat(5 - n)}</span></span>;
}
function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useT();
  return <fieldset className="flex flex-wrap items-center gap-2"><legend className="sr-only">{label}</legend><span className="w-36 text-sm">{label}</span>
    {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={t('{label}: {n} من 5', { label: label, n: n })} aria-pressed={value === n} onClick={() => onChange(n)} className={`text-2xl leading-none ${n <= value ? 'text-saudi-gold-600' : 'text-gray-300'}`}>★</button>)}</fieldset>;
}
const Badge = ({ tone, children }: { tone: 'wait' | 'ok' | 'bad'; children: React.ReactNode }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone === 'ok' ? 'bg-green-100 text-green-800' : tone === 'wait' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{children}</span>;

/* ---------------------------------------------------------------------------------------------------------------- */
/** Customer: rate completed services and follow the status of the reviews already sent. */
export function MyReviews() {
  const t = useT(); const pick = usePick();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await requestJSON('/api/reviews/mine')); } catch { setData(null); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data || (!data.reviewable.length && !data.reviews.length)) return null;
  const send = async () => {
    setBusy(true); setNotice('');
    try {
      const body: any = { itemId: form.itemId, rating: form.rating, commentAr: form.commentAr };
      if (form.detail) CRITERIA.forEach(([k]) => { body[k] = form[k]; });
      await requestJSON('/api/reviews', 'POST', body);
      setForm(null); await load(); setNotice(t('شكراً لك! وصل تقييمك وسيظهر للجميع بعد اعتماد الإدارة.'));
    } catch (error) { setNotice(error instanceof Error ? error.message : t('تعذر إرسال التقييم')); } finally { setBusy(false); }
  };
  return <section aria-label={t('تقييماتي')} className="bg-white border border-saudi-sand-300 shadow-card rounded-2xl p-5 space-y-4">
    <h2 className="font-bold">{t('تقييم الخدمات')}</h2>
    {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
    {!data.enabled && <p className="text-sm text-gray-600">{t('استقبال التقييمات الجديدة متوقف مؤقتاً.')}</p>}
    {data.reviewable.length > 0 && <div className="space-y-2"><p className="text-sm font-bold">{t('خدمات مكتملة بانتظار تقييمك')}</p>
      {data.reviewable.map((item: any) => <div key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><div><p className="text-sm font-bold">{pick(item.titleAr, item.titleEn)}</p><p className="font-mono text-xs text-gray-500" dir="ltr">{item.orderNumber}</p></div>
        <button className={primary} disabled={!data.enabled} onClick={() => setForm({ itemId: item.itemId, titleAr: item.titleAr, rating: 5, commentAr: '', detail: false, qualityRating: 5, communicationRating: 5, timelinessRating: 5, valueRating: 5 })}>{t('قيّم هذه الخدمة')}</button></div>)}</div>}
    {data.reviews.length > 0 && <div className="space-y-2"><p className="text-sm font-bold">{t('تقييماتي')}</p>
      {data.reviews.map((r: any) => <article key={r.id} className="space-y-2 rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} />{r.status === 'approved' ? <Badge tone="ok">{t('منشور')}</Badge> : r.status === 'pending' ? <Badge tone="wait">{t('بانتظار اعتماد الإدارة')}</Badge> : <Badge tone="bad">{t('غير منشور')}</Badge>}</div>
        <p className="text-sm">{r.commentAr}</p>{r.status === 'hidden' && r.moderationNoteAr && <p className="text-xs text-red-700">{t('سبب عدم النشر:')} {r.moderationNoteAr}</p>}
        {r.replyAr && <p className="rounded-lg bg-saudi-green-50 p-2 text-xs"><strong>{t('رد المورد:')}</strong> {r.replyAr}</p>}</article>)}</div>}
    {form && <div role="dialog" aria-modal="true" aria-label={t('تقييم الخدمة')} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl bg-white p-5" onSubmit={e => { e.preventDefault(); void send(); }}>
      <h3 className="font-bold">{t('تقييم:')} {pick(form.titleAr, form.titleEn)}</h3>
      <StarInput label={t('التقييم العام')} value={form.rating} onChange={v => setForm({ ...form, rating: v })} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.detail} onChange={e => setForm({ ...form, detail: e.target.checked })} />{t('أريد تقييم جوانب محددة')}</label>
      {form.detail && CRITERIA.map(([k, label]) => <StarInput key={k} label={label} value={form[k]} onChange={v => setForm({ ...form, [k]: v })} />)}
      <label className="block text-sm">{t('تجربتك مع الخدمة')}<textarea required minLength={10} maxLength={2000} rows={4} className={field} placeholder={t('اكتب ما أعجبك أو ما كان يمكن أن يكون أفضل (10 أحرف على الأقل)')} value={form.commentAr} onChange={e => setForm({ ...form, commentAr: e.target.value })} /></label>
      <p className="text-xs text-gray-600">{t('يظهر تقييمك باسمك الأول وأول حرف من اسم العائلة، وبعد مراجعة الإدارة.')}</p>
      <div className="flex gap-3"><button className={primary} disabled={busy}>{t('إرسال التقييم')}</button><button type="button" className="underline" onClick={() => setForm(null)}>{t('إغلاق')}</button></div>
      {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}
    </form></div>}
  </section>;
}

/* ---------------------------------------------------------------------------------------------------------------- */
/** Vendor: approved reviews of the vendor's own services, with replies that wait for administrator approval. */
export function VendorReviews() {
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await requestJSON('/api/reviews/vendor')); } catch { setData(null); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return null;
  const reply = async (id: string) => {
    setBusy(true); setNotice('');
    try { await requestJSON('/api/reviews/vendor', 'POST', { reviewId: id, replyAr: drafts[id] ?? '' }); setDrafts(d => ({ ...d, [id]: '' })); await load(); setNotice('أُرسل ردك للإدارة، وسيظهر للعملاء بعد اعتماده.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر إرسال الرد'); } finally { setBusy(false); }
  };
  return <section aria-label="تقييمات عملائي" className="bg-white border border-saudi-sand-300 shadow-card rounded-2xl p-5 space-y-4">
    <h2 className="font-bold">تقييمات عملائي ({data.reviews.length})</h2>
    <p className="text-xs text-gray-600">تظهر هنا التقييمات المعتمدة لخدماتك. ردودك تُراجَع من الإدارة قبل نشرها للعملاء.</p>
    {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3 text-sm">{notice}</p>}
    {!data.enabled && <p className="text-sm text-gray-600">الردود متوقفة مؤقتاً بقرار الإدارة.</p>}
    {!data.reviews.length && <p className="text-sm text-gray-500">لا توجد تقييمات معتمدة بعد.</p>}
    {data.reviews.map((r: any) => <article key={r.id} className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">{r.reviewerName}{r.serviceTitleAr ? ` — ${r.serviceTitleAr}` : ''}</span><Stars value={r.rating} /></div>
      <p className="text-sm">{r.commentAr}</p>
      {r.replyStatus === 'APPROVED' ? <p className="rounded-lg bg-saudi-green-50 p-2 text-xs"><strong>ردك المنشور:</strong> {r.replyAr}</p> : <div className="space-y-2">
        {r.replyStatus === 'PENDING' && <p className="rounded-lg bg-amber-50 p-2 text-xs"><Badge tone="wait">بانتظار اعتماد الإدارة</Badge> {r.replyDraftAr}</p>}
        {r.replyStatus === 'REJECTED' && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">لم تعتمد الإدارة ردك: {r.replyNoteAr}. عدّله وأعد الإرسال.</p>}
        <label className="block text-xs">{r.replyStatus === 'NONE' ? 'ردك على العميل' : 'تعديل الرد'}<textarea maxLength={1000} rows={2} className={field} disabled={!data.enabled} value={drafts[r.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))} /></label>
        <button className={primary} disabled={busy || !data.enabled || !(drafts[r.id] ?? '').trim()} onClick={() => void reply(r.id)}>إرسال الرد للمراجعة</button></div>}
    </article>)}
  </section>;
}

/* ---------------------------------------------------------------------------------------------------------------- */
/** Administrator: the moderation queue. */
const FILTERS: [string, string, string][] = [['pending', 'تقييمات بانتظار الاعتماد', 'pending'], ['replies', 'ردود بانتظار الاعتماد', 'replies'], ['approved', 'المنشورة', 'approved'], ['hidden', 'المخفية', 'hidden'], ['all', 'الكل', '']];
export function ReviewModeration() {
  const [filter, setFilter] = useState('pending');
  const [data, setData] = useState<any>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await requestJSON(`/api/reviews/moderation?filter=${filter}`)); } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر التحميل'); } }, [filter]);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: string, action: string, extra: Record<string, string> = {}) => {
    setBusy(true); setNotice('');
    try { await requestJSON('/api/reviews/moderation', 'PATCH', { id, action, ...extra }); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء'); } finally { setBusy(false); }
  };
  const withNote = (id: string, action: string) => { const noteAr = (notes[id] ?? '').trim(); if (!noteAr) { setNotice('اكتب سبب الإجراء أولاً في خانة السبب.'); return; } void act(id, action, { noteAr }); };
  const count = (key: string) => (key === 'all' || !data ? '' : ` (${data.counts[key]})`);
  return <section aria-label="إدارة التقييمات" className="space-y-5 rounded-3xl border border-saudi-sand-300 bg-white p-6 shadow-sm">
    <div className="space-y-1"><h4 className="font-cairo text-base font-bold text-gray-900">إدارة واعتماد تقييمات وتجارب العملاء</h4>
      <p className="text-xs text-gray-600">لا يظهر أي تقييم أو رد مورد للعامة قبل اعتماده هنا. يمكنك التمييز بالواجهة الرئيسية والرد المباشر.</p>
      {data && <p className={`text-xs font-bold ${data.enabled ? 'text-green-800' : 'text-red-700'}`}>استقبال التقييمات الجديدة والردود: {data.enabled ? 'مفعّل' : 'متوقف'} — يغيّره مدير النظام من <Link className="underline" href="/system-admin">إعدادات الميزات</Link> (تقييمات وتعليقات العملاء).</p>}</div>
    <div role="tablist" aria-label="حالات التقييمات" className="flex flex-wrap gap-2">{FILTERS.map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${filter === id ? 'bg-saudi-green-900 text-white' : 'bg-saudi-sand-100 text-gray-700'}`}>{label}{count(id === 'all' ? 'all' : id)}</button>)}</div>
    {notice && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{notice}</p>}
    {data && !data.reviews.length && <p className="py-6 text-center text-sm text-gray-500">لا توجد عناصر في هذه القائمة.</p>}
    {data?.reviews.map((r: any) => <article key={r.id} className="space-y-3 rounded-2xl border border-saudi-sand-300 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold">{r.reviewerName}<span className="font-normal text-gray-500"> — {r.date}</span></p><p className="text-xs text-saudi-green-800">{r.vendorName ?? 'منصة مناسبتـي'}{r.serviceTitleAr ? ` · ${r.serviceTitleAr}` : ''}</p></div>
        <div className="flex items-center gap-2"><Stars value={r.rating} />{r.featured && <Badge tone="ok">مميز بالواجهة</Badge>}<Badge tone={r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'wait' : 'bad'}>{r.status === 'approved' ? 'منشور' : r.status === 'pending' ? 'بانتظار الاعتماد' : 'مخفي'}</Badge></div></div>
      <p className="rounded-xl bg-saudi-sand-50 p-3 text-sm">{r.commentAr}</p>
      {r.status === 'hidden' && r.moderationNoteAr && <p className="text-xs text-red-700">سبب الإخفاء: {r.moderationNoteAr}</p>}
      {r.replyStatus === 'APPROVED' && <p className="rounded-xl border border-saudi-green-200 bg-saudi-green-50 p-3 text-xs"><strong>الرد المنشور:</strong> {r.replyAr}</p>}
      {r.replyStatus === 'PENDING' && <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs"><p><strong>رد المورد بانتظار اعتمادك:</strong> {r.replyDraftAr}</p><div className="flex gap-2"><button className={ghost} disabled={busy} onClick={() => void act(r.id, 'APPROVE_REPLY')}>اعتماد الرد ونشره</button><button className={ghost} disabled={busy} onClick={() => withNote(r.id, 'REJECT_REPLY')}>رفض الرد (اكتب السبب)</button></div></div>}
      <div className="flex flex-wrap items-center gap-2">
        {r.status !== 'approved' && <button className={ghost} disabled={busy} onClick={() => void act(r.id, 'APPROVE')}>{r.status === 'hidden' ? 'استعادة ونشر' : 'اعتماد ونشر'}</button>}
        {r.status === 'approved' && <button className={ghost} disabled={busy} onClick={() => void act(r.id, r.featured ? 'UNFEATURE' : 'FEATURE')}>{r.featured ? 'إلغاء التمييز' : 'تمييز بالواجهة ⭐'}</button>}
        {r.status !== 'hidden' && <button className={ghost} disabled={busy} onClick={() => withNote(r.id, 'HIDE')}>إخفاء (اكتب السبب)</button>}
        {r.replyStatus === 'APPROVED' && <button className={ghost} disabled={busy} onClick={() => withNote(r.id, 'REMOVE_REPLY')}>إزالة الرد (اكتب السبب)</button>}
        <button className={`${ghost} text-red-700`} disabled={busy} onClick={() => withNote(r.id, 'DELETE')}>حذف نهائي (اكتب السبب)</button>
        <input aria-label={`سبب الإجراء على تقييم ${r.reviewerName}`} className={`${field} max-w-xs`} maxLength={500} placeholder="سبب الإخفاء أو الرفض أو الحذف" value={notes[r.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} /></div>
      {r.status === 'approved' && r.replyStatus !== 'APPROVED' && <div className="flex gap-2"><input aria-label={`رد الإدارة على ${r.reviewerName}`} className={field} maxLength={1000} placeholder="رد رسمي من الإدارة (يظهر فوراً)" value={replies[r.id] ?? ''} onChange={e => setReplies(x => ({ ...x, [r.id]: e.target.value }))} /><button className={primary} disabled={busy || !(replies[r.id] ?? '').trim()} onClick={() => void act(r.id, 'ADMIN_REPLY', { replyAr: replies[r.id] })}>نشر الرد</button></div>}
    </article>)}
  </section>;
}
