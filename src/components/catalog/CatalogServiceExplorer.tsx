'use client';
import { requestJSON } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { useGeo } from '@/components/geo/GeoProvider';
import { useCatalogOptions } from './useCatalogOptions';
import { formatSAR } from '@/lib/utils';
export default function CatalogServiceExplorer({ audioOnly = false }: { audioOnly?: boolean }) {
  const { services, vendors } = useApp(); const geo = useGeo(); const options = useCatalogOptions();
  const [commerce,setCommerce]=useState<any>(null),[catalogError,setCatalogError]=useState('');
  useEffect(()=>{let live=true;void requestJSON('/api/commerce/catalog').then(d=>{if(live)setCommerce(d);}).catch(e=>{if(live)setCatalogError(e.message);});return()=>{live=false;};},[]);
  const [artistId, setArtistId] = useState(''), [subcategoryId, setSubcategoryId] = useState(''), [kind, setKind] = useState('all');
  useEffect(() => { const q = new URLSearchParams(window.location.search); setArtistId(q.get('artist') || ''); setSubcategoryId(q.get('subcategory') || ''); }, []);
  const subs = options.subcategories.filter(s => audioOnly ? s.kind === 'audio' : true);
  const artists = options.artists.filter(a => kind === 'all' || a.kind === kind);
  const unified=commerce?commerce.services.map((s:any)=>{const old=services.find(v=>v.id===s.id),offers=commerce.offers.filter((o:any)=>o.serviceId===s.id);return {...old,id:s.id,subcategoryId:s.body.subcategoryId,artistId:s.body.artistId,titleAr:s.body.titleAr,descriptionAr:s.body.descriptionAr,previewAudioUrl:s.body.previewAudioUrl,artist:options.artists.find(a=>a.id===s.body.artistId),vendorId:s.vendorId,vendorName:vendors.find(v=>v.id===s.vendorId)?.businessName??'خدمة تديرها المنصة',cityNameAr:s.body.cities.map((id:string)=>commerce.cities.find((c:any)=>c.id===id)?.nameAr).filter(Boolean).join('، '),price:(offers[0]?.body.policy.baseAmount??0)/100,priceType:offers[0]?.body.policy.pricingMode==='STARTING_AT'?'starting_at':'fixed',offerCount:offers.length,isLegacy:!!old,cities:s.body.cities};}):services;
  const matching = unified.filter((s:any) => s.subcategoryId && subs.some(sub => sub.id === s.subcategoryId) && (!subcategoryId || s.subcategoryId === subcategoryId) && (!artistId || s.artistId === artistId)
    && (kind === 'all' || options.artists.some(a => a.id === s.artistId && a.kind === kind)));
  const inCity = (s:any) => geo.data?.summary === 'UNKNOWN' || !geo.data?.selection.cityId || (commerce?s.cities.includes(geo.data.selection.cityId):geo.data.availability.some(a => a.key === 'item:' + s.id && a.available));
  const items = matching.filter(inCity);
  // why the list is empty decides what the customer is told and offered
  const elsewhere = matching.filter((s:any) => !inCity(s));
  const elsewhereCities = Array.from(new Set(elsewhere.flatMap((s:any) => s.cities as string[]))).map(id => commerce?.cities.find((c:any) => c.id === id)?.nameAr ?? id);
  const withServices = Array.from(new Set(unified.filter((s:any) => s.artistId && inCity(s) && subs.some(sub => sub.id === s.subcategoryId)).map((s:any) => s.artistId as string))).map(id => options.artists.find(a => a.id === id)).filter(Boolean) as typeof options.artists;
  const chosenArtist = options.artists.find(a => a.id === artistId);
  const stores = vendors.filter(v => v.libraryUrl && (audioOnly ? v.categoryId === 'zaffah' || items.some((s:any) => s.vendorId === v.id) : true));
  return <section id="supplier-library" className="bg-white text-slate-900 rounded-3xl border border-saudi-sand-300 p-5 sm:p-8 space-y-5" dir="rtl">
    <div><h2 className="text-xl font-black font-cairo">{audioOnly ? 'اختَر زفتك المفضلة من مكتبات الموردين' : 'الخدمات الفرعية والفنانون المتاحون لدى الموردين'}</h2><p className="text-sm text-gray-600 mt-2">استعرض الخيارات والعينات ثم افتح الخدمة لتقديم طلب الحجز. ظهور اسم الفنان في القائمة لا يعني توفره للحفل.</p></div>
    {catalogError&&<p role="alert" className="text-red-800">{catalogError}</p>}
    {options.error && <p role="alert" className="text-red-800">{options.error}</p>}
    <div className="grid sm:grid-cols-3 gap-3 text-sm">
      <label>نوع الخدمة<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)}><option value="">كل الخيارات</option>{subs.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}</select></label>
      <label>قائمة الفنانين<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={kind} onChange={e => { setKind(e.target.value); setArtistId(''); }}><option value="all">الفنانون والفنانات</option><option value="male">الفنانون</option><option value="female">الفنانات</option></select></label>
      <label>الفنان / الفنانة<select className="block w-full rounded-xl border bg-white p-2 mt-1" value={artistId} onChange={e => setArtistId(e.target.value)}><option value="">الجميع</option>{artists.map(a => <option key={a.id} value={a.id}>{a.nameAr}</option>)}</select></label>
    </div>
    {options.loading ? <p role="status">جاري تحميل الخيارات…</p> : !items.length ? <div role="status" className="rounded-xl bg-saudi-sand-50 p-5 text-sm space-y-3">
      {elsewhere.length ? <p>لا توجد خدمة منشورة {chosenArtist ? `للفنان ${chosenArtist.nameAr} ` : ''}في مدينتك الحالية، لكنها متاحة في: <strong>{elsewhereCities.join('، ')}</strong>.</p>
        : chosenArtist ? <p>لم ينشر أي مقدم خدمة عروضاً للفنان {chosenArtist.nameAr} حتى الآن. اختيارك يبقى تفضيلاً ضمن خطتك، ولا يُعد حجزاً مؤكداً.</p>
        : <p>لا توجد خدمة منشورة تطابق اختيارك حالياً. لا يُعد اختيار الاسم حجزاً مؤكداً.</p>}
      <div className="flex flex-wrap gap-3">
        {elsewhere.length > 0 && <button type="button" onClick={() => geo.openPicker()} className="rounded-xl border border-saudi-green-800 px-3 py-1.5 font-bold text-saudi-green-900">تغيير المدينة</button>}
        {(artistId || subcategoryId) && <button type="button" onClick={() => { setArtistId(''); setSubcategoryId(''); }} className="rounded-xl border border-saudi-sand-300 px-3 py-1.5 font-bold">عرض كل الخيارات المتاحة</button>}
      </div>
      {!!withServices.length && <div className="space-y-2"><p className="font-bold">فنانون لديهم خدمات متاحة الآن:</p><div className="flex flex-wrap gap-2">{withServices.map(a => <button key={a.id} type="button" onClick={() => setArtistId(a.id)} className="rounded-full border border-saudi-green-800 bg-white px-3 py-1 text-saudi-green-900 hover:bg-saudi-green-50">{a.nameAr}</button>)}</div></div>}
    </div> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map((service:any) => <article key={service.id} className="border rounded-2xl p-4 space-y-3">
      <h3 className="font-bold">{service.titleAr}</h3>{service.artist && <p className="text-saudi-green-800 font-bold">{service.artist.nameAr}</p>}<p className="text-sm text-gray-600">{service.vendorName} • {service.cityNameAr}</p><p className="font-bold">{commerce?(service.offerCount?`${service.offerCount} خيارات شراء — استعرض الأسعار والمدد`:'لم ينشر مقدم الخدمة عرض شراء معتمداً بعد'):formatSAR(service.price)}</p>
      {service.previewAudioUrl && <audio controls preload="none" className="w-full" src={service.previewAudioUrl}>متصفحك لا يدعم الصوت.</audio>}
      <Link href={commerce&&!service.isLegacy?`/commerce/service/${service.id}`:`/service/${service.id}`} className="inline-block rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 text-sm font-bold">التفاصيل وطلب الحجز</Link>
    </article>)}</div>}
    {!!stores.length && <div className="border-t pt-4 space-y-3"><h3 className="font-bold">مواقع مكتبات المحلات للاستماع</h3>{stores.map(v => <div key={v.id} className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/vendor/${v.id}`}>{v.businessName}</Link><a className="text-saudi-green-800 underline" href={v.libraryUrl!} target="_blank" rel="noopener noreferrer">فتح مكتبة المحل ↗</a></div>)}</div>}
  </section>;
}
