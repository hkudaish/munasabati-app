'use client';
import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, LucideIcon, MapPin, Sparkles, Store, Users } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

export interface StatCard { id: string; labelAr: string; labelEn: string; value: number; icon: string }
const ICONS: Record<string, LucideIcon> = { calendar: CalendarCheck, users: Users, store: Store, sparkles: Sparkles, map: MapPin, check: CheckCircle2 };

/** Counts up to the value once, when the card scrolls into view. With reduced motion (or no IntersectionObserver) the final number is shown at once. */
function useCountUp(target: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target <= 0 || typeof IntersectionObserver === 'undefined' || !ref.current) { setValue(target); return; }
    setValue(0);
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now(), duration = 1100;
      const step = (now: number) => { const t = Math.min(1, (now - start) / duration); setValue(Math.round(target * (1 - Math.pow(1 - t, 3)))); if (t < 1) frame = requestAnimationFrame(step); };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.3 });
    observer.observe(ref.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [target]);
  return { ref, value };
}
function Card({ card, english }: { card: StatCard; english: boolean }) {
  const { ref, value } = useCountUp(card.value);
  const Icon = ICONS[card.icon] ?? Sparkles;
  const label = english ? card.labelEn : card.labelAr;
  const format = new Intl.NumberFormat(english ? 'en-US' : 'ar-SA');
  return (
    <div ref={ref} role="group" aria-label={`${label}: ${format.format(card.value)}`} className="flex items-center gap-4 rounded-2xl border border-saudi-sand-300 bg-white p-5 shadow-sm">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-saudi-gold-100 text-saudi-gold-800"><Icon className="h-6 w-6" aria-hidden={true} /></span>
      <div>
        <p className="font-cairo text-3xl font-black text-saudi-green-950" aria-hidden="true">{format.format(value)}</p>
        <p className="text-sm font-bold text-gray-700">{label}</p>
      </div>
    </div>
  );
}
/** The cards themselves (also used by the administrator's preview). */
export function StatCards({ cards, english = false }: { cards: StatCard[]; english?: boolean }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <Card key={card.id} card={card} english={english} />)}</div>;
}
/** "Our platform in numbers": only real, verified figures. Hidden when switched off or when there is nothing to show. */
export default function PublicStatistics() {
  const [cards, setCards] = useState<StatCard[] | null>(null);
  const [english, setEnglish] = useState(false);
  useEffect(() => {
    setEnglish(document.documentElement.lang.startsWith('en'));
    let cancelled = false;
    requestJSON('/api/public-stats').then(r => { if (!cancelled) setCards(r.enabled ? r.cards : []); }).catch(() => { if (!cancelled) setCards([]); });
    return () => { cancelled = true; };
  }, []);
  if (!cards?.length) return null;
  return (
    <section aria-labelledby="public-stats-title" className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 id="public-stats-title" className="font-cairo text-2xl font-black text-saudi-green-950 sm:text-3xl">{english ? 'Our platform in numbers' : 'منصتنا بالأرقام'}</h2>
        <p className="text-sm text-gray-600">{english ? 'Figures taken from completed orders and live availability, updated automatically.' : 'أرقام مأخوذة من الطلبات المكتملة والتوفر الفعلي، وتتحدث تلقائياً.'}</p>
      </div>
      <StatCards cards={cards} english={english} />
    </section>
  );
}
