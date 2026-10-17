'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { requestJSON } from '@/lib/api-client';
import { useCatalogOptions } from '@/components/catalog/useCatalogOptions';
const inputClass = 'w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm';
const lines = (value: string) => value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
export const AddServiceModal = ({ isOpen, onClose, onSuccess, initialService, vendor }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void; vendorId?: string; initialService?: any; vendor?: any }) => {
  const { serviceCategories, cities, currentUser } = useApp(); const options = useCatalogOptions();
  const [form, setForm] = useState<any>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setForm({ titleAr: '', descriptionAr: '', categoryId: vendor?.categoryId || serviceCategories[0]?.id || '', cityId: vendor?.cityId || currentUser?.cityId || 'riyadh', subcategoryId: '', artistId: '', price: 0, priceType: 'FIXED', executionDurationHours: 4,
      images: '', videoUrls: '', featuresAr: '', previewAudioUrl: '', rightsConfirmed: false, isPublished: vendor?.status === 'ACTIVE',
      ...initialService, imagesText: (initialService?.images || []).join('\n'), videosText: (initialService?.videoUrls || []).join('\n'), featuresText: (initialService?.featuresAr || []).join('\n') });
    // Opening an editor creates a snapshot; background catalog refreshes must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialService]);
  if (!isOpen) return null;
  const set = (key: string, value: unknown) => setForm((previous: any) => ({ ...previous, [key]: value }));
  const sub = options.subcategories.find(s => s.id === form.subcategoryId);
  const artists = options.artists.filter(a => sub?.artistKind === 'any' || sub?.artistKind === a.kind);
  return <div role="dialog" aria-modal="true" aria-labelledby="service-editor-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 flex items-start justify-center" dir="rtl"><form className="w-full max-w-2xl bg-white my-6 p-6 rounded-3xl space-y-4" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await requestJSON('/api/vendor/catalog', 'POST', { ...form, images: lines(form.imagesText), videoUrls: lines(form.videosText), featuresAr: lines(form.featuresText), price: Number(form.price), executionDurationHours: Number(form.executionDurationHours) }); onSuccess?.(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ الخدمة'); } finally { setBusy(false); }
  }}>
    <div className="flex justify-between gap-4"><h2 id="service-editor-title" className="font-black text-lg">{initialService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</h2><button type="button" aria-label="إغلاق" onClick={onClose}><X/></button></div>
    <p className="text-sm text-gray-500">تُحفظ الخدمة في متجرك. طلب العميل ينتظر مراجعة التوفر، ولا يؤكد الحجز أو الدفع تلقائياً.</p>
    {(error || options.error) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800 text-sm">{error || options.error}</p>}
    <label className="block text-sm">اسم الخدمة<input required maxLength={200} className={inputClass} value={form.titleAr || ''} onChange={e => set('titleAr', e.target.value)} /></label>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">القسم<select className={inputClass} value={form.categoryId} onChange={e => { set('categoryId', e.target.value); set('subcategoryId', ''); set('artistId', ''); }} required>{serviceCategories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label>
      <label className="text-sm">التصنيف الفرعي<select className={inputClass} value={form.subcategoryId || ''} onChange={e => { set('subcategoryId', e.target.value); set('artistId', ''); }}><option value="">خدمة عامة ضمن القسم</option>{options.subcategories.filter(s => s.categoryId === form.categoryId).map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}</select></label>
      {sub?.artistKind && <label className="text-sm">الفنان / الفنانة<select className={inputClass} value={form.artistId || ''} onChange={e => set('artistId', e.target.value)} required={sub.kind === 'performer'}><option value="">اختر الاسم</option>{artists.map(a => <option key={a.id} value={a.id}>{a.nameAr}</option>)}</select></label>}
      <label className="text-sm">مدينة التنفيذ<select className={inputClass} value={form.cityId} onChange={e => set('cityId', e.target.value)}>{cities.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label>
      <label className="text-sm">السعر قبل الضريبة (ريال)<input type="number" min="0" max="100000000" step="1" required className={inputClass} value={form.price ?? 0} onChange={e => set('price', e.target.value)} /></label>
      <label className="text-sm">طريقة التسعير<select className={inputClass} value={form.priceType} onChange={e => set('priceType', e.target.value)}><option value="FIXED">سعر ثابت</option><option value="PER_PERSON">لكل شخص</option><option value="STARTING_AT">يبدأ من — يتطلب باقة بسعر محدد للحجز</option></select></label>
      <label className="text-sm">مدة التنفيذ بالساعات<input type="number" min="1" max="168" required className={inputClass} value={form.executionDurationHours || 4} onChange={e => set('executionDurationHours', e.target.value)} /></label>
    </div>
    <label className="block text-sm">التفاصيل<textarea required rows={3} className={inputClass} value={form.descriptionAr || ''} onChange={e => set('descriptionAr', e.target.value)} /></label>
    <label className="block text-sm">المميزات — ميزة في كل سطر<textarea rows={2} className={inputClass} value={form.featuresText || ''} onChange={e => set('featuresText', e.target.value)} /></label>
    <label className="block text-sm">روابط صور الخدمة — رابط HTTPS في كل سطر<textarea dir="ltr" rows={2} className={inputClass} value={form.imagesText || ''} onChange={e => set('imagesText', e.target.value)} /></label>
    <label className="block text-sm">روابط فيديو مباشرة (MP4 / WebM)<textarea dir="ltr" rows={2} className={inputClass} value={form.videosText || ''} onChange={e => set('videosText', e.target.value)} /></label>
    {sub?.kind === 'audio' && <label className="block text-sm">رابط عينة صوتية مرخصة<input type="url" dir="ltr" placeholder="https://" className={inputClass} value={form.previewAudioUrl || ''} onChange={e => set('previewAudioUrl', e.target.value)} /></label>}
    <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={!!form.rightsConfirmed} onChange={e => set('rightsConfirmed', e.target.checked)} className="mt-1"/>أؤكد امتلاكي صلاحية تقديم خدمة الفنان وحقوق نشر الوسائط والعينات المضافة.</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!form.isPublished} onChange={e => set('isPublished', e.target.checked)} />نشر الخدمة في السوق بعد اعتماد المتجر</label>
    <div className="flex gap-3"><button disabled={busy || options.loading} className="rounded-xl bg-emerald-800 text-white font-bold px-6 py-3 disabled:opacity-50">{busy ? 'جاري الحفظ…' : 'حفظ الخدمة'}</button><button type="button" onClick={onClose} className="border rounded-xl px-5">إلغاء</button></div>
  </form></div>;
};
