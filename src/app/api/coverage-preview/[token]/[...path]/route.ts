import { api,HttpError } from '@/lib/server/http';
import { previewContext } from '@/lib/server/geo/context';
import { getVendorsFromDB } from '@/lib/server-db';
import { GET as servicesGET } from '@/app/api/catalog/services/route';
export const dynamic='force-dynamic';
export const GET=api(async(request,{params})=>{
 const d=await previewContext(params.token),path=params.path.join('/');
 if(path==='geo/context')return d;
 if(path==='features')return {features:d.snapshot.services.filter(s=>s.kind==='feature').map(s=>({id:s.id,visible:s.visible,enabled:s.enabled,version:0}))};
 if(path==='auth/session')return {user:d.preview?.visitorType==='guest'?null:{id:'preview-user',name:d.preview?.visitorType==='subscriber'?'مشترك المعاينة':'مستخدم المعاينة',phone:'',role:'client',hasAdminAccess:false,hasSystemAccess:false}};
 if(path==='catalog/vendors')return {vendors:await getVendorsFromDB({strict:true})};
 if(path==='catalog/services'){const r=await servicesGET(request,{});return r.json();}
 if(path==='occasions')return {occasions:[],guests:[]};
 throw new HttpError(403,'هذه البيانات غير متاحة في المعاينة؛ لا تُعرض بيانات حساب المدير');
});
const readOnly=api(async()=>{throw new HttpError(403,'المعاينة للعرض فقط ولا تسمح بطلبات أو حجوزات أو عمليات مالية فعلية');});
export const POST=readOnly;export const PUT=readOnly;export const PATCH=readOnly;export const DELETE=readOnly;
