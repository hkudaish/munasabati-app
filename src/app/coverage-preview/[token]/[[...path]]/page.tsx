import { previewContext } from '@/lib/server/geo/context';
import CoveragePreviewApp from '@/components/geo/CoveragePreviewApp';
export const dynamic='force-dynamic';
export default async function Page(props:{params:Promise<{token:string;path?:string[]}>}){
 const params=await props.params;
 try{const data=await previewContext(params.token);return <CoveragePreviewApp data={data} path={params.path||[]}/>;}
 catch{return <div className="p-12 text-center"><h1 className="font-bold">المعاينة غير متاحة</h1><p>يلزم حساب مدير نظام مخوّل ومعاينة لم تنته صلاحيتها.</p><a href="/system-admin/geography" className="underline">إدارة التغطية</a></div>;}
}
