'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
export default function ImportInvitationDataPage() {
  const [legacy, setLegacy] = useState<any>(null); const [confirmed, setConfirmed] = useState(false); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { try { setLegacy(JSON.parse(localStorage.getItem('munasabati_legacy_invitations_backup_v1') || 'null')); } catch { setNotice('تعذر قراءة النسخة القديمة'); } }, []);
  return <div dir="rtl" className="max-w-3xl mx-auto p-6 space-y-5"><h1 className="text-2xl font-bold">نقل الدعوات السابقة إلى قاعدة البيانات</h1>
    <p className="text-sm">اختر مناسباتك من النسخة السابقة في هذا المتصفح. سيتم إنشاء روابط دعوات جديدة؛ الروابط القديمة التجريبية لن تُستخدم للدخول. النسخة القديمة تبقى محفوظة للمراجعة.</p>
    <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />أؤكد أن المناسبات والضيوف المختارين تخص حسابي.</label>
    {notice && <p role="status" className="p-3 border rounded-xl bg-amber-50">{notice}</p>}
    {!legacy?.occasions?.length && <p>لا توجد بيانات دعوات سابقة في هذا المتصفح.</p>}
    {legacy?.occasions?.map((occasion: any) => <div key={occasion.id} className="border rounded-xl p-4 flex justify-between gap-4"><span>{occasion.title}</span><button disabled={!confirmed || busy} className="underline disabled:opacity-40" onClick={async () => {
      setBusy(true); try { const data = await requestJSON('/api/invitations/import', 'POST', { confirmOwnership: true, occasion, guests: legacy.guests || [] }); setNotice(data.alreadyImported ? 'هذه المناسبة منقولة مسبقاً؛ أعد تحميل التطبيق لعرضها.' : 'تم نقل المناسبة والضيوف. أعد تحميل التطبيق لعرضها.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر النقل'); } finally { setBusy(false); }
    }}>نقل إلى حسابي</button></div>)}
    <Link href="/" className="block underline">العودة إلى التطبيق</Link>
  </div>;
}
