'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

const INTRO: Record<string, string> = {
  PENDING: 'حسابك بانتظار مراجعة إدارة المنصة. إلى أن يُعتمد لا يمكنك نشر خدمات أو استقبال حجوزات.',
  INFO_REQUIRED: 'تحتاج إدارة المنصة إلى استكمال بيانات حسابك قبل اعتماده.',
  REJECTED: 'لم يُعتمد حساب المورد. تواصل مع إدارة المنصة إن كان لديك استفسار.',
  ON_HOLD: 'علّقت إدارة المنصة مراجعة حسابك مؤقتاً.',
};

/** Tells a vendor where the account review stands; shown until the account is approved. */
export default function VendorApprovalBanner() {
  const t = useT();
  const [a, setA] = useState<any>(null), [note, setNote] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => { requestJSON('/api/vendor/approval').then(setA).catch(() => setA(null)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!a || a.state === 'APPROVED') return null;
  const send = async () => { setBusy(true); try { await requestJSON('/api/vendor/approval', 'POST', { note }); setMsg(t('أُرسل حسابك للمراجعة.')); setNote(''); load(); } catch (e) { setMsg(e instanceof Error ? e.message : t('تعذر الإرسال')); } finally { setBusy(false); } };
  return (
    <section role="status" className="mx-auto my-4 max-w-6xl space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <h2 className="font-bold">{t('حالة اعتماد الحساب')}: {t(a.stateAr)}</h2>
      <p className="leading-7">{t(INTRO[a.state] ?? INTRO.PENDING)}</p>
      {a.note && <p className="rounded-lg bg-white p-2 leading-7">{a.note}</p>}
      {['INFO_REQUIRED', 'PENDING'].includes(a.state) && <div className="flex flex-wrap items-end gap-3"><label className="block min-w-60 flex-1 text-sm font-bold">{t('ملاحظة للإدارة (اختياري)')}<input className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base font-normal" value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label><button className="rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300" disabled={busy} onClick={send}>{t('أرسل للمراجعة')}</button></div>}
      {msg && <p>{msg}</p>}
    </section>
  );
}
