'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

const card = 'rounded-2xl border border-saudi-sand-300 bg-white p-5 space-y-4';
const field = 'w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';
const primary = 'rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600';

/** Two-step sign-in with an authenticator app: set up, confirm with the first code, keep the recovery codes, or turn it off. */
export default function SecuritySettingsPage() {
  const t = useT();
  const [status, setStatus] = useState<{ available: boolean; enabled: boolean } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => { try { setStatus(await requestJSON('/api/auth/totp')); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [t]);
  useEffect(() => { void load(); }, [load]);
  const act = async (payload: Record<string, unknown>, done: (r: any) => void) => {
    setBusy(true); setError('');
    try { done(await requestJSON('/api/auth/totp', 'POST', payload)); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر تنفيذ الطلب')); } finally { setBusy(false); }
  };
  if (!status) return <div className="mx-auto max-w-xl p-4 sm:p-8">{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p> : <p>{t('جارٍ التحميل…')}</p>}</div>;
  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-8">
      <header className="space-y-1">
        <h1 className="font-cairo text-2xl font-black text-saudi-green-950">{t('الأمان وتسجيل الدخول')}</h1>
        <p className="text-gray-600">{t('أضف خطوة ثانية عند تسجيل الدخول برمز يتغير كل 30 ثانية من تطبيق مصادقة على هاتفك.')}</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {!status.available && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3">{t('التحقق بخطوتين غير مهيأ على الخادم بعد. تواصل مع مدير النظام.')}</p>}

      {codes && (
        <section className={card} aria-labelledby="rc">
          <h2 id="rc" className="font-bold">{t('رموز الاسترداد')}</h2>
          <p className="text-gray-700">{t('احفظ هذه الرموز في مكان آمن. كل رمز يعمل مرة واحدة إذا فقدت هاتفك، ولن تُعرض مرة أخرى.')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-base" dir="ltr">{codes.map(c => <li key={c} className="rounded-lg bg-saudi-sand-100 px-3 py-2 text-center">{c}</li>)}</ul>
          <button className={primary} onClick={() => { setCodes(null); void load(); }}>{t('حفظت الرموز')}</button>
        </section>
      )}

      {!codes && !status.enabled && status.available && (
        <section className={card}>
          {!setup ? (
            <>
              <h2 className="font-bold">{t('التحقق بخطوتين غير مفعّل')}</h2>
              <button className={primary} disabled={busy} onClick={() => act({ action: 'setup' }, r => { setSetup(r); setCode(''); })}>{t('تفعيل التحقق بخطوتين')}</button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void act({ action: 'enable', code }, r => { setSetup(null); setCode(''); setCodes(r.recoveryCodes); }); }}>
              <ol className="list-decimal space-y-3 ps-5">
                <li>{t('امسح الرمز بتطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator.')}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setup.qr} alt={t('رمز QR لإعداد تطبيق المصادقة')} width={220} height={220} className="mt-2 rounded-lg border border-saudi-sand-300" />
                  <p className="mt-2 text-sm text-gray-600">{t('أو أدخل المفتاح يدوياً:')} <bdi dir="ltr" className="font-mono select-all">{setup.secret}</bdi></p>
                </li>
                <li><label htmlFor="enable-code" className="font-bold">{t('أدخل الرمز المكوّن من 6 أرقام')}</label>
                  <input id="enable-code" className={field + ' mt-1 tracking-widest'} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" /></li>
              </ol>
              <button type="submit" className={primary} disabled={busy || code.length < 6}>{t('تأكيد وتفعيل')}</button>
            </form>
          )}
        </section>
      )}

      {!codes && status.enabled && (
        <section className={card}>
          <h2 className="font-bold text-saudi-green-900">{t('التحقق بخطوتين مفعّل')}</h2>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act({ action: 'disable', password, code }, () => { setPassword(''); setCode(''); void load(); }); }}>
            <p className="text-gray-700">{t('لإيقافه، أدخل كلمة المرور ورمزاً حالياً من التطبيق أو أحد رموز الاسترداد.')}</p>
            <div><label htmlFor="off-password" className="font-bold">{t('كلمة المرور')}</label><input id="off-password" type="password" autoComplete="current-password" className={field + ' mt-1'} required value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div><label htmlFor="off-code" className="font-bold">{t('رمز التحقق')}</label><input id="off-code" className={field + ' mt-1 tracking-widest'} autoComplete="one-time-code" required maxLength={16} value={code} onChange={e => setCode(e.target.value)} /></div>
            <button type="submit" className="rounded-xl border border-red-300 px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={busy}>{t('إيقاف التحقق بخطوتين')}</button>
          </form>
        </section>
      )}
    </div>
  );
}
