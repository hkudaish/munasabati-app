'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
const definitions = {
  whatsapp: { title: 'واتساب — Meta Cloud API', fields: { phoneNumberId: 'معرّف رقم الهاتف', apiVersion: 'إصدار Graph API (مثل v25.0)', templateName: 'اسم القالب المعتمد', language: 'لغة القالب (مثل ar)' }, hint: 'استخدم قالباً معتمداً بثلاثة متغيرات نصية في جسم الرسالة بالترتيب: اسم الضيف، عنوان المناسبة، رابط الدعوة. يجب الحصول على موافقة المستلم على التواصل.' },
  sms: { title: 'الرسائل النصية — Twilio', fields: { accountSid: 'Account SID', from: 'رقم المرسل الدولي أو اسم المرسل المعتمد' }, hint: 'يلزم تفعيل صلاحية الإرسال إلى السعودية واعتماد هوية المرسل لدى مزودك.' },
  email: { title: 'البريد الإلكتروني — Resend', fields: { from: 'بريد المرسل المعتمد' }, hint: 'تحقق من نطاق الإرسال وسجلات DNS في حساب Resend.' },
};
type Channel = keyof typeof definitions;
export default function ChannelSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [secrets, setSecrets] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState(''); const [ready, setReady] = useState(false); const [encryptionReady, setEncryptionReady] = useState(false); const [busy, setBusy] = useState(false);
  async function load() {
    const data = await requestJSON('/api/channel-settings');
    setEncryptionReady(data.encryptionReady); setSettings(Object.fromEntries(data.settings.map((s: any) => [s.channel, s]))); setReady(true);
  }
  useEffect(() => { load().catch(e => setNotice(e.message)); }, []);
  async function save(channel: Channel) {
    setBusy(true); setNotice('');
    try { await requestJSON('/api/channel-settings', 'PUT', { channel, enabled: !!settings[channel]?.enabled, config: settings[channel]?.config || {}, secret: secrets[channel] || '' }); setSecrets(prev => ({ ...prev, [channel]: '' })); await load(); setNotice('تم حفظ إعدادات القناة بأمان. لم يتم إرسال أي رسالة.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); }
  }
  function patch(channel: string, value: any) { setSettings(prev => ({ ...prev, [channel]: { ...prev[channel], ...value } })); }
  return <main dir="rtl" className="max-w-4xl mx-auto p-6 space-y-6">
    <div className="flex gap-4 text-sm"><Link href="/" className="underline">الرئيسية</Link><Link href="/settings/invitations-data" className="underline">نقل الدعوات السابقة</Link></div><h1 className="text-2xl font-bold">إعدادات قنوات إرسال الدعوات</h1>
    <p className="text-sm text-gray-600">هذه الإعدادات خاصة بحسابك. المفاتيح مشفّرة على الخادم ولا تُعرض بعد الحفظ. ترك خانة المفتاح فارغة يحافظ على المفتاح الحالي.</p>
    {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3">{notice}</p>}
    {!ready ? <p>سجّل الدخول لتحميل إعداداتك. <button className="underline" onClick={() => void load().catch(e => setNotice(e.message))}>إعادة المحاولة</button></p> : <>
      {!encryptionReady && <p role="alert" className="p-3 rounded-xl bg-amber-50">يلزم تهيئة CHANNEL_ENCRYPTION_KEY على الخادم قبل حفظ المفاتيح.</p>}
      {(Object.entries(definitions) as [Channel, typeof definitions[Channel]][]).map(([channel, definition]) => <form key={channel} onSubmit={e => { e.preventDefault(); void save(channel); }} className="rounded-2xl border bg-white p-5 space-y-4">
        <h2 className="font-bold">{definition.title}</h2><p className="text-xs text-gray-600">{definition.hint}</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!settings[channel]?.enabled} onChange={e => patch(channel, { enabled: e.target.checked })} />تفعيل هذه القناة</label>
        {Object.entries(definition.fields).map(([field, label]) => <label key={field} className="block text-sm">{label}<input dir="ltr" required autoComplete="off" value={settings[channel]?.config?.[field] || ''} onChange={e => patch(channel, { config: { ...settings[channel]?.config, [field]: e.target.value } })} className="block w-full rounded-xl border p-2 mt-1" /></label>)}
        <label className="block text-sm">{channel === 'sms' ? 'Auth Token' : 'Access Token / API Key'}{settings[channel]?.hasSecret ? ' — مفتاح محفوظ' : ''}<input dir="ltr" type="password" autoComplete="new-password" value={secrets[channel] || ''} onChange={e => setSecrets(prev => ({ ...prev, [channel]: e.target.value }))} className="block w-full rounded-xl border p-2 mt-1" /></label>
        <div className="flex gap-3"><button disabled={busy || !encryptionReady} className="rounded-xl bg-green-900 text-white px-4 py-2 disabled:opacity-50">حفظ الإعدادات</button>
        {settings[channel]?.hasSecret && <button type="button" disabled={busy} className="text-red-700 underline" onClick={async () => { setBusy(true); try { await requestJSON('/api/channel-settings', 'DELETE', { channel }); await load(); setNotice('تم حذف ربط القناة'); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحذف'); } finally { setBusy(false); } }}>حذف الربط</button>}</div>
      </form>)}
    </>}
  </main>;
}
