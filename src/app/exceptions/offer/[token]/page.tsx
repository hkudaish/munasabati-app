'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJSON } from '@/lib/api-client';
import { useApp } from '@/lib/store';
import { useT } from '@/components/i18n/LocaleProvider';

// The link in a message. It identifies the request only: the customer signs in, and the offer is then shown and decided on the request's own page.
export default function OfferLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useT(), router = useRouter(), { openOnboarding } = useApp();
  const [state, setState] = useState<{ requestId: string; expired: boolean; signedIn: boolean } | null>(null), [error, setError] = useState('');
  useEffect(() => { requestJSON('/api/exceptions/offer/' + encodeURIComponent(token)).then(r => { setState(r); if (r.signedIn) router.replace('/exceptions/' + r.requestId); }).catch(e => setError(e instanceof Error ? e.message : t('الرابط غير صالح'))); }, [token, router, t]);
  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-8">
      <h1 className="font-cairo text-2xl font-black text-saudi-green-950">{t('عرض السعر النهائي لطلبك')}</h1>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {state && !state.signedIn && <>
        <p className="leading-8">{state.expired ? t('انتهت صلاحية هذا العرض. سجّل الدخول لمتابعة طلبك.') : t('سجّل الدخول بحسابك لمراجعة العرض واعتماده. لا يُقبل العرض بمجرد فتح هذا الرابط.')}</p>
        <button className="rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900" onClick={() => openOnboarding('client', { gate: true, returnTo: '/exceptions/' + state.requestId })}>{t('تسجيل الدخول')}</button>
      </>}
      {!state && !error && <p>{t('جارٍ التحميل…')}</p>}
    </div>
  );
}
