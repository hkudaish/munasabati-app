'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { requestJSON } from '@/lib/api-client';
import { AddServiceModal } from '@/components/vendor/AddServiceModal';
export default function VendorCatalogPage() {
  const { currentUser } = useApp();
  const sequence = useRef(0);
  const cancel = useCallback(() => { sequence.current++; }, []);
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any>(undefined), [images, setImages] = useState(''), [videos, setVideos] = useState(''), [library, setLibrary] = useState('');
  const load = useCallback(async () => { const attempt = ++sequence.current; const d = await requestJSON('/api/vendor/catalog'); if (attempt !== sequence.current) return; setData(d); setImages(d.vendor.portfolio.join('\n')); setVideos(d.vendor.videoUrls.join('\n')); setLibrary(d.vendor.libraryUrl || ''); }, []);
  useEffect(() => { setData(null); setEditor(undefined); setImages(''); setVideos(''); setLibrary(''); setError(''); let stopped = false; void load().catch(e => { if (!stopped) setError(e.message); }); return () => { stopped = true; cancel(); }; }, [load, cancel, currentUser?.id]);
  const split = (v: string) => v.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6" dir="rtl"><div className="flex flex-wrap gap-3 justify-between"><h1 className="text-2xl font-black">خدمات متجري ومعرض الأعمال</h1><Link href="/bookings/settings" className="underline">إعدادات الحجز والتسعير</Link><Link href="/vendor" className="underline">بوابة المورد</Link></div>
    {(error || notice) && <p role="status" className="rounded-xl border bg-amber-50 p-4 text-sm">{error || notice}</p>}
    {!data ? <p>{error ? 'سجّل الدخول بحساب المورد لإدارة متجرك.' : 'جاري تحميل المتجر…'}</p> : <>
      <section className="bg-white rounded-3xl border p-5 space-y-4"><h2 className="font-bold">{data.vendor.businessName} — صور المحل وفيديوهاته ومكتبته</h2><p className="text-sm text-gray-500">أضف روابط الوسائط العامة المستضافة لديك. لا ترفع أعمالاً لا تملك حق نشرها.</p>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setNotice(''); try { await requestJSON('/api/vendor/catalog','POST',{action:'media',images:split(images),videoUrls:split(videos),libraryUrl:library}); setNotice('تم حفظ معرض المحل ورابط المكتبة'); window.dispatchEvent(new Event('catalog-updated')); } catch(e) { setError(e instanceof Error?e.message:'تعذر الحفظ'); } finally { setBusy(false); } }}>
          <label className="block text-sm">روابط الصور (HTTPS، رابط في كل سطر)<textarea rows={3} dir="ltr" className="w-full border rounded-xl p-3" value={images} onChange={e => setImages(e.target.value)}/></label>
          <label className="block text-sm">روابط الفيديو المباشرة MP4 / WebM<textarea rows={2} dir="ltr" className="w-full border rounded-xl p-3" value={videos} onChange={e => setVideos(e.target.value)}/></label>
          <label className="block text-sm">موقع مكتبة المحل للاستماع والاختيار<input type="url" dir="ltr" placeholder="https://" className="w-full border rounded-xl p-3" value={library} onChange={e => setLibrary(e.target.value)}/></label>
          <button disabled={busy} className="bg-emerald-800 text-white rounded-xl px-5 py-2 font-bold">حفظ بيانات المحل</button>
        </form>
      </section>
      <section className="bg-white rounded-3xl border p-5 space-y-4"><div className="flex justify-between gap-3"><h2 className="font-bold">الخدمات والتصنيفات الفرعية</h2><button className="bg-emerald-800 text-white rounded-xl px-4 py-2 text-sm" onClick={() => setEditor(null)}>+ إضافة خدمة</button></div>
        {!data.services.length && <p className="text-sm text-gray-500">أضف أول خدمة لتظهر للعملاء بعد نشرها واعتماد المتجر.</p>}
        {data.services.map((s:any) => <article key={s.id} className="border rounded-xl p-4 flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{s.titleAr}</h3><p className="text-sm text-gray-500">{s.subcategory?.nameAr} {s.artist?.nameAr ? '• '+s.artist.nameAr : ''} • {s.isPublished?'منشورة':'مسودة'}</p></div><div className="flex gap-3 text-sm"><button className="underline" onClick={() => setEditor(s)}>تعديل</button>{s.isPublished && <button disabled={busy} className="text-red-800 underline" onClick={async () => { setBusy(true); try { await requestJSON('/api/vendor/catalog','POST',{action:'unpublish',id:s.id}); await load(); } catch(e) { setError(e instanceof Error?e.message:'تعذر التعديل'); } finally {setBusy(false);} }}>إيقاف النشر</button>}</div></article>)}
      </section>
      <AddServiceModal isOpen={editor !== undefined} initialService={editor} vendor={data.vendor} onClose={() => setEditor(undefined)} onSuccess={() => { void load().catch(e=>setError(e.message)); window.dispatchEvent(new Event('catalog-updated')); }}/>
    </>}
  </main>;
}
