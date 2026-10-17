'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
const input = 'w-full rounded-xl border bg-white p-2 text-sm';
export default function CatalogAdminPage() {
  const [data,setData]=useState<any>(null),[editor,setEditor]=useState<any>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>setData(await requestJSON('/api/system-admin/catalog')),[]);
  useEffect(()=>{void load().catch(e=>setNotice(e.message));},[load]);
  const field=(key:string,value:unknown)=>setEditor((previous:any)=>({...previous,[key]:value}));
  return <main dir="rtl" className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-black">التصنيفات الفرعية والفنانون</h1><Link href="/system-admin" className="underline">مدير النظام</Link></div>
    <p className="text-sm text-gray-600">قائمة الأسماء للتصنيف والاختيار. خدمات الحجز يضيفها المورد المعتمد، ولا تنشأ تلقائياً من هذه القائمة.</p>
    {notice&&<p role="status" className="border bg-amber-50 p-4 rounded-xl">{notice}</p>}
    {data&&<><div className="flex gap-3"><button className="bg-emerald-800 text-white rounded-xl p-3" onClick={()=>setEditor({entity:'subcategory',id:'',nameAr:'',categoryId:data.categories[0]?.id,kind:'standard',artistKind:null,isActive:true,sortOrder:0})}>+ تصنيف فرعي</button><button className="border rounded-xl p-3" onClick={()=>setEditor({entity:'artist',id:'',nameAr:'',kind:'male',enabled:true,sortOrder:0})}>+ فنان / فنانة</button></div>
      {editor&&<form className="bg-white border rounded-2xl p-5 space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await requestJSON('/api/system-admin/catalog','POST',editor);setEditor(null);await load();setNotice('تم حفظ الخيارات');window.dispatchEvent(new Event('catalog-updated'));}catch(e){setNotice(e instanceof Error?e.message:'تعذر الحفظ');}finally{setBusy(false);}}}>
        <div className="grid sm:grid-cols-2 gap-3"><label>المعرّف<input className={input} required value={editor.id} disabled={!!editor.existing} onChange={e=>field('id',e.target.value)}/></label><label>الاسم بالعربية<input className={input} required value={editor.nameAr} onChange={e=>field('nameAr',e.target.value)}/></label>
          {editor.entity==='subcategory'?<><label>القسم<select className={input} value={editor.categoryId} onChange={e=>field('categoryId',e.target.value)}>{data.categories.map((c:any)=><option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label><label>نوع الخدمة<select className={input} value={editor.kind} onChange={e=>field('kind',e.target.value)}><option value="standard">خدمة عادية</option><option value="performer">حجز فنان</option><option value="audio">زفات ومكتبة صوتية</option></select></label><label>قائمة الفنانين<select className={input} value={editor.artistKind||''} onChange={e=>field('artistKind',e.target.value||null)}><option value="">بدون</option><option value="male">فنانون</option><option value="female">فنانات</option><option value="any">الجميع</option></select></label></>:<label>القائمة<select className={input} value={editor.kind} onChange={e=>field('kind',e.target.value)}><option value="male">فنانون</option><option value="female">فنانات</option></select></label>}
          <label>ترتيب العرض<input className={input} type="number" min="0" max="10000" value={editor.sortOrder} onChange={e=>field('sortOrder',Number(e.target.value))}/></label>
        </div><label className="flex gap-2"><input type="checkbox" checked={editor.entity==='artist'?editor.enabled:editor.isActive} onChange={e=>field(editor.entity==='artist'?'enabled':'isActive',e.target.checked)}/>مفعّل</label>
        <button disabled={busy} className="bg-emerald-800 text-white px-5 py-2 rounded-xl">حفظ</button><button type="button" onClick={()=>setEditor(null)} className="mr-3 underline">إغلاق</button>
      </form>}
      {[['التصنيفات الفرعية','subcategory',data.subcategories],['الفنانون والفنانات','artist',data.artists]].map(([title,entity,rows]:any)=><section key={entity} className="bg-white rounded-2xl border p-5 space-y-3"><h2 className="font-bold text-lg">{title}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{rows.map((row:any)=><button key={row.id} className="text-right border rounded-xl p-3" onClick={()=>setEditor({...row,entity,existing:true})}><strong>{row.nameAr}</strong><span className="block text-xs text-gray-500">{entity==='subcategory'?data.categories.find((c:any)=>c.id===row.categoryId)?.nameAr:row.kind==='male'?'فنانون':'فنانات'} • {(row.isActive??row.enabled)?'مفعّل':'معطّل'}</span></button>)}</div></section>)}
    </>}
  </main>;
}
