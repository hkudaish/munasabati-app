'use client';
import Link from 'next/link';
import type { CatalogOptions, ServiceSelection } from '@/lib/catalog/types';
export default function ServiceSelectionFields({ categoryId, value, onChange, options }: { categoryId: string; value: ServiceSelection; onChange: (value: ServiceSelection) => void; options: CatalogOptions }) {
  const subcategories = options.subcategories.filter(s => s.categoryId === categoryId);
  if (!subcategories.length) return null;
  const selected = subcategories.filter(s => value.subcategoryIds.includes(s.id));
  const artists = options.artists.filter(a => selected.some(s => s.artistKind === 'any' || s.artistKind === a.kind));
  return <fieldset className="min-w-0 border-t border-saudi-green-100 p-3 space-y-3 text-xs" data-service-options={categoryId}>
    <legend className="sr-only">الخيارات الفرعية</legend>
    {subcategories.map(sub => <label key={sub.id} className="flex items-start gap-2 leading-5"><input type="checkbox" checked={value.subcategoryIds.includes(sub.id)} onChange={e => {
      const ids = e.target.checked ? [...value.subcategoryIds, sub.id] : value.subcategoryIds.filter(id => id !== sub.id);
      const allowed = options.subcategories.filter(s => ids.includes(s.id));
      onChange({ ...value, subcategoryIds: ids, artistIds: value.artistIds.filter(id => options.artists.some(a => a.id === id && allowed.some(s => s.artistKind === 'any' || s.artistKind === a.kind))) });
    }} className="mt-1 rounded"/><span>{sub.nameAr}</span></label>)}
    {!!artists.length && <label className="block space-y-2"><span className="font-bold">اختر الفنان أو الفنانة المفضلة</span><select aria-label="الفنان المفضل" value={value.artistIds[0] || ''} onChange={e => onChange({ ...value, artistIds: e.target.value ? [e.target.value] : [] })} className="w-full min-w-0 max-w-full rounded-lg border p-2 bg-white"><option value="">سأختار لاحقاً</option>{artists.map(a => <option key={a.id} value={a.id}>{a.nameAr}</option>)}</select></label>}
    {selected.some(s => s.kind === 'audio') && <Link href={`/zaffah?returnTo=${encodeURIComponent('/plan?resume=1')}#supplier-library`} className="block text-saudi-green-800 underline font-bold">استمع لمكتبات محلات الزفات</Link>}
    {selected.some(s => s.kind === 'performer') && <p className="text-gray-600 leading-5">الاختيار تفضيل ضمن الخطة؛ الحجز يتطلب عرض خدمة فعلياً وموافقة المورد.</p>}
    {!!value.artistIds.length && <Link href={`/artists?artist=${encodeURIComponent(value.artistIds[0])}&returnTo=${encodeURIComponent('/plan?resume=1')}`} className="block text-saudi-green-800 underline font-bold">عرض خدمات الفنان وطلبات الحجز</Link>}
  </fieldset>;
}
