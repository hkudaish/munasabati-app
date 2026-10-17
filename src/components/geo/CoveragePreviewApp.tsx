'use client';
import { useLayoutEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { GeoContextData } from '@/lib/geo/types';
import GeoProvider from './GeoProvider';
import FeatureProvider from '@/components/system/FeatureProvider';
import { AppProvider } from '@/lib/store';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CoverageNotice from './CoverageNotice';
import Home from '@/app/page';
import Marketplace from '@/app/marketplace/page';
import Packages from '@/app/packages/page';
import Zaffah from '@/app/zaffah/page';
import Calculator from '@/app/calculator/page';
import Inspiration from '@/app/inspiration/page';
import Compare from '@/app/compare/page';
import Service from '@/app/service/[id]/page';
import Vendor from '@/app/vendor/[id]/page';
export default function CoveragePreviewApp({data,path}:{data:GeoContextData;path:string[]}){
 const [ready,setReady]=useState(false);const router=useRouter();const previewId=data.preview!.id;const base='/coverage-preview/'+previewId;
 useLayoutEffect(()=>{const original=window.fetch;window.fetch=(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;const u=new URL(url,window.location.origin);if(u.origin===window.location.origin&&u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/api/coverage-preview/'))return original('/api/coverage-preview/'+previewId+u.pathname.slice(4)+u.search,init);return original(input,init);};setReady(true);return()=>{window.fetch=original;};},[previewId]);
 if(!ready)return <p role="status" className="p-12">جارٍ تجهيز المعاينة الآمنة…</p>;
 const route=path.join('/');const Page=!route?Home:route==='marketplace'?Marketplace:route==='packages'?Packages:route==='zaffah'?Zaffah:route==='calculator'?Calculator:route==='inspiration'?Inspiration:route==='compare'?Compare:route.startsWith('service/')?Service:route.startsWith('vendor/')?Vendor:null;
 const features=data.snapshot.services.filter(s=>s.kind==='feature').map(s=>({id:s.id as any,visible:s.visible,enabled:s.enabled,version:0}));
 return <GeoProvider initial={data}><FeatureProvider initial={features}><AppProvider><div onClickCapture={e=>{const a=(e.target as Element).closest('a');if(!a)return;const href=a.getAttribute('href')||'';if(href.startsWith('/')&&!href.startsWith(base)){e.preventDefault();e.stopPropagation();router.push(base+(href==='/'?'':href));}}} onSubmitCapture={e=>{e.preventDefault();e.stopPropagation();}}>
 <div className="bg-amber-100 border-b border-amber-300 p-3 text-xs text-center font-bold" role="status">معاينة للعرض فقط · لا يتم إنشاء حجوزات أو حفظ تغييرات لحسابك · نوع الزائر: {data.preview?.visitorType==='guest'?'زائر':data.preview?.visitorType==='subscriber'?'مشترك (محاكاة عرض فقط)':'مستخدم'}</div><Navbar/><CoverageNotice/>
 {Page?<Page/>:<div className="p-12 text-center"><p>هذه الصفحة غير متاحة في معاينة الزائر. لا تسمح المعاينة بفتح لوحات الإدارة أو بيانات الحسابات.</p><a href={base} className="underline">العودة للمعاينة</a></div>}<Footer/>
 </div></AppProvider></FeatureProvider></GeoProvider>;
}
