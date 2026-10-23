'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';

const sar = (halala: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format((halala ?? 0) / 100);
const when = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const card = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 shadow-card';
const field = 'w-full rounded-xl border border-saudi-sand-300 bg-white p-2 text-sm';

export default function BookingInsights() {
  const [city, setCity] = useState(''), [service, setService] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [stats, setStats] = useState<any>(null), [abandoned, setAbandoned] = useState<any>(null), [changes, setChanges] = useState<any>(null), [jobs, setJobs] = useState<any>(null), [settings, setSettings] = useState<any>(null);
  const [luma, setLuma] = useState<any>(null);
  const [stages, setStages] = useState(''), [finalHours, setFinalHours] = useState(''), [window, setWindowMinutes] = useState('15'), [notice, setNotice] = useState('');

  const query = useCallback(() => { const q = new URLSearchParams(); if (city) q.set('cityId', city); if (service) q.set('serviceId', service); if (from) q.set('from', from); if (to) q.set('to', new Date(to + 'T23:59:59').toISOString()); return q.toString() ? '?' + q.toString() : ''; }, [city, service, from, to]);
  const load = useCallback(async () => {
    try {
      const [a, b, c, d, e, l] = await Promise.all([requestJSON('/api/admin/booking-analytics' + query()), requestJSON('/api/admin/abandoned-carts' + query()), requestJSON('/api/admin/price-change-events' + query()), requestJSON('/api/admin/notification-jobs'), requestJSON('/api/admin/notification-settings'), requestJSON('/api/admin/luma-insights')]);
      setLuma(l); setStats(a); setAbandoned(b); setChanges(c); setJobs(d); setSettings(e);
      setStages(e.settings.reminders.stagesHours.join(',')); setFinalHours(e.settings.reminders.finalHours ?? ''); setWindowMinutes(String(e.settings.price.groupWindowMinutes));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر التحميل'); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (patch: any) => {
    try {
      const next = { ...settings.settings, ...patch };
      setSettings(await requestJSON('/api/admin/notification-settings', 'PATCH', { settings: next, version: settings.version }));
      setNotice('تم حفظ الإعدادات'); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر الحفظ'); }
  };
  const saveTimings = () => saveSettings({
    reminders: { ...settings.settings.reminders, stagesHours: stages.split(',').map(x => Number(x.trim())).filter(Boolean), finalHours: finalHours === '' ? null : Number(finalHours) },
    price: { ...settings.settings.price, groupWindowMinutes: Number(window) },
  });

  if (!stats) return <div dir="rtl" className="p-8">{notice || 'جارٍ التحميل…'}</div>;
  const reminders = stats.reminders;
  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header><h1 className="font-cairo text-2xl font-black text-saudi-green-950">مؤشرات الحجز والسلال والإشعارات</h1><p className="text-sm text-gray-600">{stats.note === 'Draft and cart values are intentions, not sales: they are never included in revenue.' ? 'قيم المسودات والسلال نيّات شراء وليست مبيعات؛ لا تدخل أبداً في الإيرادات.' : stats.note}</p></header>
      {notice && <p role="status" className="rounded-xl border bg-amber-50 p-3">{notice}</p>}

      <section className={card + ' grid gap-3 sm:grid-cols-5'}>
        <label className="text-sm">المدينة (المعرّف)<input className={field} value={city} onChange={e => setCity(e.target.value)} placeholder="riyadh" /></label>
        <label className="text-sm">الخدمة (المعرّف)<input className={field} value={service} onChange={e => setService(e.target.value)} /></label>
        <label className="text-sm">من<input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-sm">إلى<input type="date" className={field} value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="self-end rounded-xl bg-saudi-green-800 px-4 py-2 font-bold text-white" onClick={() => void load()}>تطبيق</button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><p className="text-sm text-gray-600">مسودات قيد التعبئة</p><p className="text-2xl font-black">{stats.drafts.IN_PROGRESS ?? 0}</p><p className="text-xs text-gray-500">في السلة: {stats.drafts.IN_CART ?? 0} · مشتراة: {stats.drafts.PURCHASED ?? 0}</p></div>
        <div className={card}><p className="text-sm text-gray-600">سلال نشطة</p><p className="text-2xl font-black">{stats.carts.pending}</p><p className="text-xs text-gray-500">القيمة المعلقة: {sar(stats.carts.pendingValueHalala)}</p></div>
        <div className={card}><p className="text-sm text-gray-600">سلال متروكة (بعد {stats.carts.abandonAfterHours} ساعة)</p><p className="text-2xl font-black">{stats.carts.abandoned}</p><p className="text-xs text-gray-500">القيمة: {sar(stats.carts.abandonedValueHalala)} · مستردة: {stats.carts.recovered}</p></div>
        <div className={card}><p className="text-sm text-gray-600">تحويل إلى طلب</p><p className="text-2xl font-black">{stats.checkout.conversion === null ? '—' : Math.round(stats.checkout.conversion * 100) + '%'}</p><p className="text-xs text-gray-500">طلبات: {stats.checkout.ordersCreated} · سلال بدأت: {stats.checkout.cartsStarted} · حجوزات مؤكدة: {stats.checkout.confirmedBookings}</p></div>
        <div className={card}><p className="text-sm text-gray-600">ارتفاعات الأسعار</p><p className="text-2xl font-black">{stats.priceChanges.increases.count}</p><p className="text-xs text-gray-500">المجموع: {sar(stats.priceChanges.increases.totalHalala)}</p></div>
        <div className={card}><p className="text-sm text-gray-600">انخفاضات الأسعار</p><p className="text-2xl font-black">{stats.priceChanges.decreases.count}</p><p className="text-xs text-gray-500">المجموع: {sar(Math.abs(stats.priceChanges.decreases.totalHalala))}</p></div>
        <div className={card}><p className="text-sm text-gray-600">التذكيرات</p><p className="text-2xl font-black">{reminders.sent}</p><p className="text-xs text-gray-500">تخطّي: {reminders.skipped} · بانتظار: {reminders.pending} · فشلت نهائياً: {reminders.dead}</p></div>
        <div className={card}><p className="text-sm text-gray-600">رسائل فاشلة نهائياً</p><p className="text-2xl font-black">{stats.checkout.deadLetters}</p><p className="text-xs text-gray-500">أحداث أو إشعارات استُنفدت محاولاتها</p></div>
      </section>

      <section className={card + ' space-y-3'}>
        <h2 className="font-bold">إعدادات الإشعارات</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">ساعات التذكير (مرتبة تصاعدياً، مثال 24,72)<input className={field} value={stages} onChange={e => setStages(e.target.value)} /></label>
          <label className="text-sm">تذكير أخير بعد (ساعات، اختياري)<input className={field} value={finalHours} onChange={e => setFinalHours(e.target.value)} /></label>
          <label className="text-sm">نافذة تجميع تغيّر الأسعار (دقائق)<input className={field} value={window} onChange={e => setWindowMinutes(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label><input type="checkbox" checked={settings.settings.enabled} onChange={e => void saveSettings({ enabled: e.target.checked })} /> الإشعارات مفعّلة</label>
          <label><input type="checkbox" checked={settings.settings.reminders.enabled} onChange={e => void saveSettings({ reminders: { ...settings.settings.reminders, enabled: e.target.checked } })} /> تذكير السلال المتروكة</label>
          <label><input type="checkbox" checked={settings.settings.price.enabled} onChange={e => void saveSettings({ price: { ...settings.settings.price, enabled: e.target.checked } })} /> إشعارات تغيّر الأسعار</label>
          <label><input type="checkbox" checked={settings.settings.price.notifyDecreases} onChange={e => void saveSettings({ price: { ...settings.settings.price, notifyDecreases: e.target.checked } })} /> إشعار الانخفاض</label>
          <label><input type="checkbox" checked={settings.settings.ops.enabled} onChange={e => void saveSettings({ ops: { enabled: e.target.checked } })} /> تنبيهات العمل للإدارة والموردين</label>
          <label><input type="checkbox" checked={settings.settings.channels.email} onChange={e => void saveSettings({ channels: { ...settings.settings.channels, email: e.target.checked } })} /> البريد (لمن وافق)</label>
        </div>
        <button className="rounded-xl bg-saudi-green-800 px-4 py-2 font-bold text-white" onClick={() => void saveTimings()}>حفظ التوقيتات</button>
      </section>

      <section className={card + ' space-y-2'}>
        <h2 className="font-bold">أسئلة لُـمى (آخر 30 يوماً)</h2>
        <p className="text-xs text-gray-600">تتعلم لُـمى من الاستخدام: الأسئلة الناجحة الأكثر تكراراً تظهر أولاً في اقتراحاتها، وما لا تستطيع الإجابة عنه يظهر هنا لتقرروا إضافته. أسئلة العملاء تُحفظ كحقائق مجردة (الخدمة والمدينة والنتيجة) بلا نص حر.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div><h3 className="mb-1 text-sm font-bold">الأكثر طلباً</h3>{luma?.top.length ? <ul className="space-y-1 text-sm">{luma.top.slice(0, 10).map((t: any, i: number) => <li key={i} className="flex justify-between gap-2 border-b py-1"><span>{t.audience === 'staff' ? 'إدارة' : 'عميل'} · {t.intent}{t.categoryId ? ` · ${t.categoryId}` : ''}{t.cityId ? ` · ${t.cityId}` : ''}</span><span>{t.asked} ({t.answered} بنتيجة)</span></li>)}</ul> : <p className="text-sm text-gray-500">لا بيانات بعد.</p>}</div>
          <div><h3 className="mb-1 text-sm font-bold">أسئلة لم تستطع الإجابة عنها</h3>{luma?.unanswered.length ? <ul className="space-y-1 text-sm">{luma.unanswered.map((u: any, i: number) => <li key={i} className="flex justify-between gap-2 border-b py-1"><span>«{u.text}»</span><span>{u.n}</span></li>)}</ul> : <p className="text-sm text-gray-500">لا أسئلة بلا إجابة.</p>}{luma?.noResults.length > 0 && <p className="mt-2 text-xs text-amber-800">بحثات بلا نتائج: {luma.noResults.slice(0, 5).map((n: any) => `${n.categoryId ?? '—'}/${n.cityId ?? '—'} (${n.n})`).join('، ')}</p>}</div>
        </div>
      </section>

      <section className={card + ' space-y-2'}>
        <h2 className="font-bold">السلال المتروكة ({abandoned.carts.length})</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-2">العميل</th><th>آخر نشاط</th><th>عناصر</th><th>القيمة</th><th>تذكيرات أُرسلت</th></tr></thead><tbody>
          {abandoned.carts.map((c: any) => <tr key={c.userId} className="border-t"><td className="p-2">{c.name ?? c.userId}</td><td>{when(c.lastActivityAt)}</td><td>{c.items}</td><td>{sar(c.valueHalala)}</td><td>{c.remindersSent}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className={card + ' space-y-2'}>
        <h2 className="font-bold">تغيّرات الأسعار</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-2">الوقت</th><th>الاتجاه</th><th>من</th><th>إلى</th><th>الفرق</th><th>أُقرّ</th></tr></thead><tbody>
          {changes.events.map((e: any) => <tr key={e.id} className="border-t"><td className="p-2">{when(e.detectedAt)}</td><td>{e.direction === 'INCREASE' ? 'ارتفاع' : 'انخفاض'}</td><td>{sar(e.previousHalala)}</td><td>{sar(e.newHalala)}</td><td>{sar(e.differenceHalala)} {e.differencePercent !== null && `(${e.differencePercent}%)`}</td><td>{e.acknowledgedAt ? 'نعم' : e.direction === 'INCREASE' ? 'بانتظار العميل' : '—'}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className={card + ' space-y-2'}>
        <h2 className="font-bold">آخر مهام الإشعار</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-start"><th className="p-2">الوقت</th><th>القالب</th><th>القناة</th><th>الحالة</th><th>محاولات</th><th>السبب</th></tr></thead><tbody>
          {jobs.jobs.map((j: any) => <tr key={j.id} className="border-t"><td className="p-2">{when(j.createdAt)}</td><td>{j.template}</td><td>{j.channel}</td><td>{j.status}</td><td>{j.attempts}</td><td>{j.lastError ?? ''}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}
