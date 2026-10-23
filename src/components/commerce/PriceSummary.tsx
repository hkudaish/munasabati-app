'use client';
import { useT } from '@/components/i18n/LocaleProvider';
import { money } from '@/lib/money';

export interface Delta { amount: number; label: string }
interface Pricing {
  mode: 'PACKAGE' | 'NO_PACKAGE'; quoteStatus: 'ESTIMATE' | 'FIRM'; componentSubtotal: number; optionalExtras: number; fees: number; packageDiscount: number; promotionDiscount: number; discountTotal: number; taxes: number; grandTotal: number;
  components: { lineId: string; offerId: string; packageId: string | null; quantity: number; gross: number; discount: number; net: number }[];
  discounts: { source: 'PACKAGE' | 'RULE'; description: string; amount: number }[];
  rejected: { name: string; code: string; reasonAr: string }[];
}

/**
 * The customer's running price, itemised the same way everywhere (the booking dialog, a package being customised, the cart):
 * what each part costs, what was saved and why, tax, the total, and what the last change did to it.
 */
export default function PriceSummary({ pricing, names = {}, delta }: { pricing: Pricing; names?: Record<string, string>; delta?: Delta | null }) {
  const t = useT();
  const savings = pricing.packageDiscount + pricing.promotionDiscount;
  return (
    <section aria-label={t('ملخص السعر')} className="space-y-2 rounded-2xl border border-saudi-green-200 bg-saudi-green-50 p-4 text-sm">
      <h3 className="font-bold">{t('ملخص السعر')}</h3>
      {delta && delta.amount !== 0 && (
        <p role="status" aria-live="polite" className={`rounded-lg px-3 py-1.5 font-bold ${delta.amount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>
          {delta.label}: {delta.amount > 0 ? '+' : '−'}{money(Math.abs(delta.amount))}
        </p>
      )}
      {pricing.components.length > 1 && (
        <ul className="space-y-0.5">
          {pricing.components.map(c => (
            <li key={c.lineId} className="flex justify-between gap-3"><span>{names[c.offerId] ?? ''}{c.quantity > 1 ? ` × ${c.quantity}` : ''}</span><span>{money(c.gross)}</span></li>
          ))}
        </ul>
      )}
      <div className="flex justify-between"><span>{t('الخدمات والمكونات')}</span><span>{money(pricing.componentSubtotal)}</span></div>
      {pricing.optionalExtras > 0 && <div className="flex justify-between"><span>{t('إضافات اختيارية')}</span><span>{money(pricing.optionalExtras)}</span></div>}
      {pricing.fees > 0 && <div className="flex justify-between"><span>{t('رسوم')}</span><span>{money(pricing.fees)}</span></div>}
      {pricing.discounts.map((d, i) => <div key={i} className="flex justify-between text-green-800"><span>{d.source === 'PACKAGE' ? t('خصم الباقة') + ': ' : t('خصم ترويجي') + ': '}{t(d.description)}</span><span>−{money(d.amount)}</span></div>)}
      <div className="flex justify-between"><span>{t('الضريبة')}</span><span>{money(pricing.taxes)}</span></div>
      <div className="flex justify-between border-t border-saudi-green-200 pt-2 text-base font-black"><span>{t('الإجمالي')}{pricing.quoteStatus === 'ESTIMATE' ? ' ' + t('(تقديري)') : ''}</span><span>{money(pricing.grandTotal)}</span></div>
      {savings > 0 && <p className="font-bold text-green-800">{t('وفّرت')} {money(savings)}</p>}
      {pricing.rejected.map((r, i) => <p key={i} className="text-xs text-amber-900">{r.name}: {t(r.reasonAr)}</p>)}
    </section>
  );
}
