'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';
import { PRIORITY_LABELS } from '@/lib/exceptions/machine';
import { card, danger, field, primary, secondary } from './common';

const ROLES: Record<string, string> = { COORDINATOR: 'منسق حجوزات', BOOKING_SUPERVISOR: 'مشرف حجوزات', SUPPORT: 'موظف دعم (قراءة فقط)' };
const GROUPS: [string, string][] = [['providerResponseHours', 'مهلة استجابة مقدم الخدمة (ساعات)'], ['coordinatorResponseHours', 'مهلة استجابة المنسق (ساعات)'], ['customerResponseHours', 'مهلة استجابة العميل (ساعات)']];

/** Escalation windows, approval thresholds and who works the exception queue. For administrators. */
export default function ExceptionSettings() {
  const t = useT();
  const [cfg, setCfg] = useState<any>(null), [staff, setStaff] = useState<any[]>([]), [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [who, setWho] = useState(''), [role, setRole] = useState('COORDINATOR');
  const load = useCallback(async () => { try { setCfg((await requestJSON('/api/exceptions/config')).config); setStaff((await requestJSON('/api/exceptions/staff')).staff); } catch (e) { setError(e instanceof Error ? e.message : t('تعذر التحميل')); } }, [t]);
  useEffect(() => { void load(); }, [load]);
  if (!cfg) return error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p> : <p>{t('جارٍ التحميل…')}</p>;
  const num = (v: string) => Number(v);
  const save = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(''); setMsg(''); try { setCfg((await requestJSON('/api/exceptions/config', 'POST', cfg)).config); setMsg(t('تم حفظ الإعدادات.')); } catch (err) { setError(err instanceof Error ? err.message : t('تعذر الحفظ')); } finally { setBusy(false); } };
  const grant = async (action: 'grant' | 'revoke', identifier: string, r: string) => { setBusy(true); setError(''); setMsg(''); try { await requestJSON('/api/exceptions/staff', 'POST', { identifier, role: r, action }); setWho(''); await load(); setMsg(action === 'grant' ? t('تمت إضافة الصلاحية.') : t('تم سحب الصلاحية.')); } catch (err) { setError(err instanceof Error ? err.message : t('تعذر التنفيذ')); } finally { setBusy(false); } };
  return (
    <div className="space-y-5">
      {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">{msg}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      <form onSubmit={save} className={card + ' space-y-4'}>
        <h2 className="font-bold">{t('مدد الاستجابة والتصعيد')}</h2>
        {GROUPS.map(([key, label]) => <fieldset key={key} className="space-y-2"><legend className="text-sm font-bold">{t(label)}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([1, 2, 3, 4] as const).map(p => <label key={p} className="block text-xs">{t(PRIORITY_LABELS[p])}<input type="number" min={0.5} step={0.5} className={field + ' mt-1'} value={cfg[key][p]} onChange={e => setCfg({ ...cfg, [key]: { ...cfg[key], [p]: num(e.target.value) } })} /></label>)}</div></fieldset>)}
        <div className="grid gap-3 sm:grid-cols-3">
          {([['offerValidityHours', 'صلاحية العرض (ساعات)'], ['paymentWindowHours', 'مهلة الدفع بعد الاعتماد (ساعات)'], ['unreviewedEscalationHours', 'تصعيد الطلب غير المراجع بعد (ساعات)'], ['escalationStepHours', 'مدة كل مستوى تصعيد (ساعات)'], ['expiredOfferCancelDays', 'إلغاء العرض المنتهي بعد (أيام)']] as const).map(([k, l]) => <label key={k} className="block text-sm">{t(l)}<input type="number" min={1} className={field + ' mt-1'} value={cfg[k]} onChange={e => setCfg({ ...cfg, [k]: num(e.target.value) })} /></label>)}
          <label className="block text-sm">{t('حد اعتماد المشرف للعرض (ر.س، 0 لإيقافه)')}<input type="number" min={0} step={1} className={field + ' mt-1'} value={cfg.supervisorApprovalAboveAmount / 100} onChange={e => setCfg({ ...cfg, supervisorApprovalAboveAmount: Math.round(num(e.target.value) * 100) })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.requirePlatformApprovalForVendorServices} onChange={e => setCfg({ ...cfg, requirePlatformApprovalForVendorServices: e.target.checked })} />{t('تتطلب خدمات الموردين موافقة إدارة المنصة بعد موافقة المورد')}</label>
        <button className={primary} disabled={busy}>{t('حفظ الإعدادات')}</button>
      </form>
      <section className={card + ' space-y-3'}>
        <h2 className="font-bold">{t('فريق المتابعة')}</h2>
        <p className="text-sm text-gray-700">{t('المنسق يرى ويعمل على الطلبات المسندة إليه فقط، والمشرف يرى كل الطلبات ويعتمد العروض الكبيرة، وموظف الدعم يقرأ فقط. المسؤولون يملكون كل ذلك.')}</p>
        <ul className="space-y-2 text-sm">{staff.map(s => <li key={s.userId + s.role} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-saudi-sand-100 p-2"><span><strong>{s.name}</strong> — {t(ROLES[s.role])} <span dir="ltr" className="text-gray-600">{s.phone}</span></span><button className={danger + ' !px-3 !py-1.5'} disabled={busy} onClick={() => grant('revoke', s.userId, s.role)}>{t('سحب')}</button></li>)}{!staff.length && <li className="text-gray-600">{t('لا يوجد موظفون بهذه الأدوار بعد.')}</li>}</ul>
        <div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm sm:col-span-1">{t('جوال أو بريد المستخدم')}<input dir="ltr" className={field + ' mt-1'} value={who} onChange={e => setWho(e.target.value)} /></label><label className="block text-sm">{t('الدور')}<select className={field + ' mt-1'} value={role} onChange={e => setRole(e.target.value)}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></label><div className="flex items-end"><button className={secondary} disabled={busy || !who.trim()} onClick={() => grant('grant', who.trim(), role)}>{t('إضافة')}</button></div></div>
      </section>
    </div>
  );
}
