'use client';
import { createContext,useContext,useEffect,useRef,useState } from 'react';
import { useInnerPathname } from '@/components/i18n/LocaleProvider';
import { GeoContextData } from '@/lib/geo/types';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';
interface GeoValue { data:GeoContextData|null; loading:boolean; error:string; chooseCity:(id:string)=>Promise<void>; locate:()=>Promise<void>; refresh:()=>Promise<void>; openPicker:()=>void }
const Context=createContext<GeoValue>({data:null,loading:true,error:'',chooseCity:async()=>{},locate:async()=>{},refresh:async()=>{},openPicker:()=>{}});
export const useGeo=()=>useContext(Context);
export default function GeoProvider({initial,children}:{initial:GeoContextData|null;children:React.ReactNode}){
 const t=useT();const [data,setData]=useState(initial),[loading,setLoading]=useState(!initial),[error,setError]=useState('');const sequence=useRef(0);const pathname=useInnerPathname();
 const previewShell=pathname.startsWith('/coverage-preview/');
 async function refresh(){const n=++sequence.current;try{const d=await requestJSON('/api/geo/context');if(n===sequence.current){setData(d);setError('');}}catch(e){if(n===sequence.current)setError(e instanceof Error?e.message:t('تعذر تحميل التغطية'));}finally{if(n===sequence.current)setLoading(false);}}
 useEffect(()=>{if(initial?.preview||previewShell)return;void refresh();const timer=setInterval(()=>void refresh(),15000);const onFocus=()=>void refresh();window.addEventListener('focus',onFocus);window.addEventListener('coverage-updated',onFocus);return()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('coverage-updated',onFocus);};/* initial is a server snapshot; later refreshes are authoritative. */
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[previewShell,initial?.preview?.id]);
 useEffect(()=>{if(data?.snapshot.policy.analyticsEnabled&&!data.preview&&!previewShell)void requestJSON('/api/geo/events','POST',{}).catch(()=>{});},[data?.selection.cityId,data?.snapshot.policy.analyticsEnabled,data?.preview,previewShell]);
 async function chooseCity(cityId:string){if(data?.preview)return;setLoading(true);setError('');++sequence.current;try{setData(await requestJSON('/api/geo/location','POST',{source:'MANUAL',cityId}));window.dispatchEvent(new Event('city-updated'));}catch(e){setError(e instanceof Error?e.message:t('تعذر حفظ المدينة'));throw e;}finally{setLoading(false);}}
 async function locate(){if(data?.preview)return;if(!navigator.geolocation)throw Error(t('تحديد الموقع غير مدعوم؛ اختر مدينتك يدوياً'));
  setLoading(true);setError('');++sequence.current;
  try{const p=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:10000,maximumAge:300000}));setData(await requestJSON('/api/geo/location','POST',{source:'GPS',consent:true,replaceManual:true,latitude:p.coords.latitude,longitude:p.coords.longitude}));}
  catch(e){const message=(e as any)?.code===1?t('لم تشارك موقعك؛ يمكنك اختيار المدينة يدوياً'):e instanceof Error?e.message:t('تعذر تحديد الموقع؛ اختر المدينة يدوياً');setError(message);throw Error(message);}finally{setLoading(false);}
 }
 const value={data,loading,error,refresh,chooseCity,locate,openPicker:()=>window.dispatchEvent(new Event('open-city-picker'))};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
