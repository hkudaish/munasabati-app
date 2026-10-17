'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { useGeo } from '@/components/geo/GeoProvider';
import { useCatalogOptions } from './useCatalogOptions';
import { formatSAR } from '@/lib/utils';
export default function CatalogServiceExplorer({ audioOnly = false }: { audioOnly?: boolean }) {
  const { services, vendors } = useApp(); const geo = useGeo(); const options = useCatalogOptions();
  const [artistId, setArtistId] = useState(''), [subcategoryId, setSubcategoryId] = useState(''), [kind, setKind] = useState('all');
  useEffect(() => { const q = new URLSearchParams(window.location.search); setArtistId(q.get('artist') || ''); setSubcategoryId(q.get('subcategory') || ''); }, []);
  const subs = options.subcategories.filter(s => audioOnly ? s.kind === 'audio' : true);
  const artists = options.artists.filter(a => kind === 'all' || a.kind === kind);
  const items = services.filter(s => s.subcategoryId && subs.some(sub => sub.id === s.subcategoryId) && (!subcategoryId || s.subcategoryId === subcategoryId) && (!artistId || s.artistId === artistId)
    && (kind === 'all' || options.artists.some(a => a.id === s.artistId && a.kind === kind))
    && (geo.data?.summary === 'UNKNOWN' || !geo.data?.selection.cityId || geo.data.availability.some(a => a.key === 'item:' + s.id && a.available)));
  const stores = vendors.filter(v => v.libraryUrl && (audioOnly ? v.categoryId === 'zaffah' || items.some(s => s.vendorId === v.id) : true));
  return <section id="supplier-library" className="bg-white text-slate-900 rounded-3xl border border-saudi-sand-300 p-5 sm:p-8 space-y-5" dir="rtl">
    <div><h2 className="text-xl font-black font-cairo">{audioOnly ? 'اختَر زفتك المفضلة من مكتبات الموردين' : 'الخدمات الفرعية والفنانون المتاحون لدى الموردين'}</h2><p className="text-sm text-gray-500 mt-2">استعرض الخيارات والعينات ثم افتح الخدمة لتقديم طلب الحجز. ظهور اسم الفنان في القائمة لا يعني توفره للحفل.</p></div>
    {options.error && <p role="alert" className="text-red-800">{options.error}</p>}
    <div className="grid sm:grid-cols-3 gap-3 text-sm">
      <label>نوع الخدمة<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)}><option value="">كل الخيارات</option>{subs.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}</select></label>
      <label>قائمة الفنانين<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={kind} onChange={e => { setKind(e.target.value); setArtistId(''); }}><option value="all">الفنانون والفنانات</option><option value="male">الفنانون</option><option value="female">الفنانات</option></select></label>
      <label>الفنان / الفنانة<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={artistId} onChange={e => setArtistId(e.target.value)}><option value="">الجميع</option>{artists.map(a => <option key={a.id} value={a.id}>{a.nameAr}</option>)}</select></label>
    </div>
    {options.loading ? <p role="status">جاري تحميل الخيارات…</p> : !items.length ? <p role="status" className="rounded-xl bg-saudi-sand-50 p-5 text-sm">لا توجد خدمة منشورة تطابق اختيارك حالياً. لا يُعد اختيار الاسم حجزاً مؤكداً.</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(service => <article key={service.id} className="border rounded-2xl p-4 space-y-3">
      <h3 className="font-bold">{service.titleAr}</h3>{service.artist && <p className="text-emerald-800 font-bold">{service.artist.nameAr}</p>}<p className="text-sm text-gray-500">{service.vendorName} • {service.cityNameAr}</p><p className="font-bold">{formatSAR(service.price)}{service.priceType === 'starting_at' ? ' (يبدأ من)' : ''}</p>
      {service.previewAudioUrl && <audio controls preload="none" className="w-full" src={service.previewAudioUrl}>متصفحك لا يدعم الصوت.</audio>}
      <Link href={`/service/${service.id}`} className="inline-block rounded-xl bg-emerald-800 text-white px-4 py-2 text-sm font-bold">التفاصيل وطلب الحجز</Link>
    </article>)}</div>}
    {!!stores.length && <div className="border-t pt-4 space-y-3"><h3 className="font-bold">مواقع مكتبات المحلات للاستماع</h3>{stores.map(v => <div key={v.id} className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/vendor/${v.id}`}>{v.businessName}</Link><a className="text-emerald-800 underline" href={v.libraryUrl!} target="_blank" rel="noopener noreferrer">فتح مكتبة المحل ↗</a></div>)}</div>}
  </section>;
}
