'use client';
import { useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
export default function SystemSetupPage() {
  const [token,setToken]=useState('');const [email,setEmail]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const [name,setName]=useState('');const [phone,setPhone]=useState('');const [password,setPassword]=useState('');
  useEffect(()=>{
    const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||'';
    setToken(value);
    requestJSON('/api/system-setup','POST',{action:'inspect',token:value}).then(d=>setEmail(d.email)).catch(e=>setNotice(e.message));
  },[]);
  async function activate(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setNotice('');
    try{await requestJSON('/api/system-setup','POST',{action:'activate',token,name,phone,password});window.history.replaceState(null,'','/system-setup');window.location.assign('/system-admin');}
    catch(e){setNotice(e instanceof Error?e.message:'تعذر تفعيل الحساب');}finally{setBusy(false);}
  }
  return <div dir="rtl" className="max-w-lg mx-auto px-4 py-12"><form onSubmit={e=>void activate(e)} className="rounded-3xl border bg-white p-6 space-y-5"><h1 className="text-2xl font-bold">تفعيل حساب مدير النظام</h1><p className="text-sm text-slate-600">رابط خاص لمرة واحدة. اختر بيانات الدخول لحسابك، ثم انتقل إلى لوحة مدير النظام.</p>{notice&&<p role="alert" className="bg-amber-50 border rounded-xl p-3 text-sm">{notice}</p>}{email&&<><p className="rounded-xl bg-slate-50 p-3 text-sm" dir="ltr">{email}</p><label className="block text-sm">الاسم<input required maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="block w-full border rounded-xl p-3 mt-1"/></label><label className="block text-sm">الجوال<input required type="tel" autoComplete="tel" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} className="block w-full border rounded-xl p-3 mt-1"/></label><label className="block text-sm">كلمة مرور جديدة (12 حرفاً على الأقل)<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="block w-full border rounded-xl p-3 mt-1"/></label><button disabled={busy} className="w-full rounded-xl bg-emerald-900 text-white p-3">{busy?'جارٍ تفعيل الحساب…':'تفعيل الحساب والدخول إلى مدير النظام'}</button></>}</form></div>;
}
