'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/i18n/Link';
import { requestJSON } from '@/lib/api-client';
import { usePick, useT, useLocale } from '@/components/i18n/LocaleProvider';
import { money } from './Storefront';

const box = 'rounded-2xl border border-saudi-sand-300 bg-white p-4 space-y-3 shadow-card';
const small = 'text-sm underline disabled:opacity-50';

function lineTitle(line: any, data: any, catalog: any, pick: (ar: string, en?: string | null) => string) {
  const fromQuote = data.quote?.lines.find((l: any) => l.cartLineId === line.id || l.cartLineId === line);
  if (fromQuote) return pick(fromQuote.titleAr, fromQuote.titleEn);
  const offer = catalog?.offers.find((o: any) => o.id === line.offerId);
  const service = catalog?.services.find((s: any) => s.id === offer?.serviceId);
  return service ? pick(service.body.titleAr, service.body.titleEn) : offer ? pick(offer.body.nameAr, offer.body.nameEn) : '';
}

/** Above the cart: price changes that need a decision, recent messages, unfinished bookings, and the customer's consent for email. */
export default function CartExtras({ data, catalog, reload, setNotice }: { data: any; catalog: any; reload: () => Promise<void>; setNotice: (s: string) => void }) {
  const t = useT(), pick = usePick(), { locale } = useLocale();
  const [drafts, setDrafts] = useState<any[]>([]), [prefs, setPrefs] = useState<{ inbox: boolean; email: boolean; hasEmail: boolean } | null>(null), [busy, setBusy] = useState(false), [history, setHistory] = useState<Record<string, any>>({});
  useEffect(() => {
    void requestJSON('/api/booking-drafts').then(r => setDrafts(r.drafts.filter((d: any, i: number, all: any[]) => d.status === 'IN_PROGRESS' && d.version > 1 && all.findIndex(x => x.status === 'IN_PROGRESS' && x.version > 1 && x.serviceId === d.serviceId) === i))   /* only drafts the customer actually worked on, one per service (the newest) */).catch(() => {});
    void requestJSON('/api/notifications/preferences').then(setPrefs).catch(() => {});
  }, [data?.cart?.version]);
  const acknowledge = async (lineId: string) => { setBusy(true); try { await requestJSON(`/api/cart/items/${lineId}/acknowledge-price`, 'POST', {}); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : t('تعذر الحفظ')); } finally { setBusy(false); } };
  const showHistory = async (lineId: string) => { try { setHistory({ ...history, [lineId]: history[lineId] ? null : await requestJSON(`/api/cart/items/${lineId}/price-history`) }); } catch { /* the history is optional */ } };
  const setEmail = async (enabled: boolean) => { try { await requestJSON('/api/notifications/preferences', 'PUT', { email: enabled }); setPrefs(p => (p ? { ...p, email: enabled } : p)); } catch (e) { setNotice(e instanceof Error ? e.message : t('تعذر الحفظ')); } };
  const date = (value: string) => new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <>
      {data.priceChanges?.length > 0 && (
        <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <h2 className="font-bold">{t('تغيّر سعر عناصر في سلتك')}</h2>
          {data.priceChanges.map((c: any) => (
            <div key={c.id} className="text-sm space-y-1">
              <p className="font-bold">{lineTitle({ id: c.lineId, ...data.cart.body.lines.find((l: any) => l.id === c.lineId) }, data, catalog, pick)}: {c.direction === 'INCREASE' ? t('ارتفع بمقدار') : t('انخفض بمقدار')} {money(Math.abs(c.differenceHalala))}{c.differencePercent !== null && ` (${Math.abs(c.differencePercent).toFixed(1)}%)`}</p>
              <p>{t('يلزم الاطلاع على السعر الجديد والموافقة عليه قبل إنشاء الطلب.')}</p>
              <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-saudi-green-800 px-3 py-1.5 font-bold text-white disabled:opacity-50" onClick={() => void acknowledge(c.lineId)}>{t('اطلعت على السعر الجديد')}</button><button className={small} onClick={() => void showHistory(c.lineId)}>{t('سجل الأسعار')}</button></div>
              {history[c.lineId] && <ul className="list-disc ps-5">{history[c.lineId].snapshots.map((s: any) => <li key={s.id}>{date(s.createdAt)} — {money(s.totalHalala)}</li>)}</ul>}
            </div>
          ))}
        </section>
      )}
      {data.notifications?.length > 0 && (
        <section className={box} aria-label={t('رسائل عن سلتك')}>
          <h2 className="font-bold">{t('رسائل عن سلتك')}</h2>
          {data.notifications.map((n: any) => <p key={n.id} className="text-sm"><strong>{n.title}</strong> — {n.text} <span className="text-gray-500">({date(n.createdAt)})</span></p>)}
        </section>
      )}
      {drafts.length > 0 && (
        <section className={box} aria-label={t('حجوزات لم تكتمل')}>
          <h2 className="font-bold">{t('حجوزات لم تكتمل')}</h2>
          {drafts.map(d => (
            <p key={d.id} className="text-sm"><Link className="underline font-bold" href={`/commerce/service/${d.serviceId}?draft=${d.id}`}>{pick(d.titleAr ?? '', d.titleEn)}</Link> — {t('آخر تعديل')} {date(d.lastActivityAt)}</p>
          ))}
        </section>
      )}
      {prefs && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={prefs.email} disabled={!prefs.hasEmail} onChange={e => void setEmail(e.target.checked)} />
          <span>{t('أرسل لي تذكيرات السلة وتغيّر الأسعار بالبريد الإلكتروني')}{!prefs.hasEmail && <> ({t('أضف بريداً إلكترونياً إلى حسابك أولاً')})</>}</span>
        </label>
      )}
    </>
  );
}

/** Below the cart: items kept for later, still priced on their own so the customer can see whether they can still be bought. */
export function SavedForLater({ data, catalog, reload, setNotice }: { data: any; catalog: any; reload: () => Promise<void>; setNotice: (s: string) => void }) {
  const t = useT(), pick = usePick(), [busy, setBusy] = useState(false);
  if (!data.saved?.length) return null;
  const move = async (lineId: string) => { setBusy(true); try { await requestJSON(`/api/cart/items/${lineId}/restore`, 'POST', { version: data.cart.version }); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : t('تعذر الحفظ')); } finally { setBusy(false); } };
  const remove = async (lineId: string) => { setBusy(true); try { await requestJSON('/api/commerce/cart', 'PUT', { version: data.cart.version, lines: data.cart.body.lines.filter((l: any) => l.id !== lineId) }); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : t('تعذر الحفظ')); } finally { setBusy(false); } };
  return (
    <section className={box} aria-label={t('محفوظ لوقت لاحق')}>
      <h2 className="font-bold">{t('محفوظ لوقت لاحق')} ({data.saved.length})</h2>
      {data.saved.map(({ line, quote, error }: any) => (
        <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm">
          <div>
            <p className="font-bold">{lineTitle(line, data, catalog, pick)} {line.date && <span className="font-normal text-gray-600">· {line.date} {line.time}</span>}</p>
            {quote ? <p>{money(quote.totals.total)}</p> : <p className="text-amber-800">{error} — {t('بقيت اختياراتك محفوظة ويمكنك تعديلها.')}</p>}
          </div>
          <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-saudi-green-800 px-3 py-1.5 font-bold text-white disabled:opacity-50" onClick={() => void move(line.id)}>{t('إعادة إلى السلة')}</button><button disabled={busy} className="text-red-800 underline" onClick={() => void remove(line.id)}>{t('إزالة')}</button></div>
        </div>
      ))}
    </section>
  );
}
