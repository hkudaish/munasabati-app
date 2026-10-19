'use client';
import Link from 'next/link';
import type { ServiceSelection } from '@/lib/catalog/types';
import { useApp } from '@/lib/store';
import { useCatalogOptions } from './useCatalogOptions';
export default function RequestedServices({ selections }: { selections?: ServiceSelection[] }) {
  const options=useCatalogOptions(); const { serviceCategories }=useApp();
  if (!selections?.length) return null;
  return <section className="bg-white border rounded-3xl p-5 space-y-4"><h2 className="font-bold text-lg">الخدمات والاختيارات المطلوبة</h2><p className="text-sm text-gray-600">هذه تفضيلات محفوظة ضمن الخطة. افتح خدمة المورد لإرسال طلب حجز مستقل.</p><div className="grid sm:grid-cols-2 gap-3">{selections.map(row=><article key={row.categoryId} className="border rounded-xl p-4 space-y-2"><h3 className="font-bold">{serviceCategories.find(c=>c.id===row.categoryId)?.nameAr||'خدمة مختارة'}</h3>{row.subcategoryIds.map(id=><p key={id} className="text-sm">{options.subcategories.find(s=>s.id===id)?.nameAr||'تصنيف سابق غير متاح حالياً'}</p>)}{row.artistIds.map(id=><div key={id}><span className="text-saudi-green-800 font-bold">{options.artists.find(a=>a.id===id)?.nameAr||'فنان مختار سابقاً'}</span><Link href={`/artists?artist=${encodeURIComponent(id)}&subcategory=${encodeURIComponent(row.subcategoryIds[0]||'')}`} className="block underline text-sm mt-1">عرض الخدمات وطلب الحجز</Link></div>)}{!row.artistIds.length&&<Link href={`/artists?subcategory=${encodeURIComponent(row.subcategoryIds[0]||'')}`} className="underline text-saudi-green-800 text-sm">استعراض الخدمات والموردين</Link>}</article>)}</div></section>;
}
