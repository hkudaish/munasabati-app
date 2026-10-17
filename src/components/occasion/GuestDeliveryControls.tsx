'use client';
import { useRef, useState } from 'react';
import { Guest } from '@/lib/types';
import { requestJSON } from '@/lib/api-client';
export default function GuestDeliveryControls({ guest }: { guest: Guest }) {
  const [channel, setChannel] = useState('whatsapp'); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  async function send() {
    if (busy) return; setBusy(true); setNotice('جارٍ الإرسال…');
    requestKey.current ||= crypto.randomUUID();
    try {
      const result = await requestJSON(`/api/guests/${guest.id}/send`, 'POST', { channel, requestKey: requestKey.current });
      const status = result.delivery.status;
      setNotice(status === 'ACCEPTED' ? 'قبل المزود الرسالة؛ وصولها غير مؤكد بعد.' : status === 'PENDING' ? 'الطلب قيد المعالجة؛ راجع السجل قبل إعادة الإرسال.' : status === 'UNKNOWN' ? 'حالة الإرسال غير معروفة؛ راجع المزود قبل إعادة المحاولة.' : 'رفض المزود الإرسال.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الإرسال'); }
    finally { setBusy(false); }
  }
  return <details className="text-[11px] min-w-32"><summary className="cursor-pointer underline">إرسال عبر القنوات</summary><div className="space-y-2 p-2 bg-white border rounded-lg">
    <select aria-label="قناة الإرسال" disabled={busy} value={channel} onChange={e => { setChannel(e.target.value); requestKey.current = null; }} className="border p-1 rounded"><option value="whatsapp">واتساب</option><option value="sms">رسالة نصية</option><option value="email" disabled={!guest.email}>بريد إلكتروني</option></select>
    <button disabled={busy || !!guest.revokedAt} onClick={() => void send()} className="block rounded bg-green-900 text-white p-2">إرسال الدعوة</button>
    <button disabled={busy} className="underline" onClick={async () => { try { const d = await requestJSON(`/api/guests/${guest.id}/send`); setNotice(d.deliveries.map((r: any) => `${r.channel}: ${{ ACCEPTED: 'مقبولة لدى المزود', PENDING: 'قيد المعالجة', UNKNOWN: 'غير معروفة', FAILED: 'فشل' }[r.status as string]} (${new Date(r.createdAt).toLocaleString('ar-SA-u-nu-latn')})`).join('؛ ') || 'لا توجد محاولات إرسال'); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر قراءة السجل'); } }}>سجل الإرسال</button>
    {notice && <p role="status">{notice}</p>}
    <button disabled={busy} className="block underline" onClick={async () => { setBusy(true); try { await requestJSON(`/api/guests/${guest.id}`, 'PATCH', { rotate: true }); window.location.reload(); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر تجديد الرابط'); } finally { setBusy(false); } }}>تجديد رابط الدعوة وإبطال القديم</button>
    <button disabled={busy || !!guest.revokedAt} className="block underline text-red-700" onClick={async () => { setBusy(true); try { await requestJSON(`/api/guests/${guest.id}`, 'PATCH', { revoke: true }); setNotice('تم إلغاء صلاحية رابط الدعوة.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر إلغاء الدعوة'); } finally { setBusy(false); } }}>إلغاء صلاحية الدعوة</button>
    <button disabled={busy} className="underline text-gray-500" onClick={() => { requestKey.current = null; setNotice('أصبح بالإمكان إنشاء طلب إرسال جديد.'); }}>بدء طلب إرسال جديد</button>
  </div></details>;
}
