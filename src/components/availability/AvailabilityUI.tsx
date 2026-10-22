'use client';
import React, { useEffect, useState } from 'react';
import { requestJSON } from '@/lib/api-client';
import { useApp } from '@/lib/store';
import { CAPACITY_AR, comingSoonLike, REASON_AR, Shown, shown, STATUS_AR, STATUS_EN, STATUS_TONE } from './labels';

const isEnglish = () => typeof document !== 'undefined' && document.documentElement.lang.startsWith('en');
const pick = (m?: { ar: string; en: string }) => (m ? (isEnglish() ? m.en || m.ar : m.ar || m.en) : '');

/** A small status badge. Nothing is shown for a plain, fully available service. */
export function StatusBadge({ decision }: { decision: any }) {
  const d = shown(decision);
  if (!d) return null;
  if (d.status === 'ACTIVE' && d.capacity !== 'LIMITED' && d.capacity !== 'FULL') return null;
  const label = d.status === 'ACTIVE' ? CAPACITY_AR[d.capacity] : (isEnglish() ? STATUS_EN : STATUS_AR)[d.status];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[d.status] ?? STATUS_TONE.ACTIVE}`}>{label}</span>;
}
/** The reason a service cannot be booked, in the customer's words; dates when there are any. */
export function AvailabilityNotice({ decision }: { decision: any }) {
  const d = shown(decision);
  if (!d) return null;
  const text = pick(d.message);
  if (!text && d.canBook && d.status === 'ACTIVE') return null;
  const tone = d.canBook ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-saudi-sand-300 bg-saudi-sand-50 text-gray-900';
  return <p role="status" className={`rounded-xl border p-3 text-sm leading-7 ${tone}`}>
    {text || (isEnglish() ? STATUS_EN : STATUS_AR)[d.status]}
    {d.launch && d.status === 'COMING_SOON' && <span className="block text-xs">{isEnglish() ? 'Planned launch: ' : 'موعد الإطلاق المتوقع: '}{d.launch}</span>}
    {d.resume && d.status === 'TEMPORARILY_SUSPENDED' && <span className="block text-xs">{isEnglish() ? 'Expected back: ' : 'الاستئناف المتوقع: '}{d.resume}</span>}
    {!d.canBook && d.reasons.filter(r => r.startsWith('RESTRICTION_')).map(r => <span key={r} className="block text-xs text-gray-700">• {REASON_AR[r]}</span>)}
  </p>;
}

/** The decision for what the customer is choosing right now (offer, event city, date, time, quantity). The server repeats this check when the booking is made. */
export function useLiveDecision(offerId: string | null | undefined, cityId: string, date: string, time: string, quantity: number) {
  const [decision, setDecision] = useState<any>(null);
  useEffect(() => {
    if (!offerId || !cityId) { setDecision(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ offerId, cityId, quantity: String(Math.max(1, quantity || 1)) });
      if (date) q.set('date', date);
      if (time) q.set('time', time);
      requestJSON('/api/availability/resolve?' + q.toString()).then(d => { if (!cancelled) setDecision(d); }).catch(() => { if (!cancelled) setDecision(null); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [offerId, cityId, date, time, quantity]);
  return decision;
}

/** "Tell me when it is available": for services that are coming soon or not yet offered in the chosen city. */
export function InterestBox({ serviceId, cityId, decision }: { serviceId: string; cityId: string; decision: any }) {
  const { currentUser, openOnboarding } = useApp();
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState('WHATSAPP');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const d = shown(decision);
  useEffect(() => { setState('idle'); setMessage(''); }, [serviceId, cityId]);
  useEffect(() => {
    if (!currentUser) return;
    requestJSON('/api/availability/interest').then(r => { if (r.interests?.some((i: any) => i.serviceId === serviceId && i.cityId === cityId)) { setState('done'); setMessage('سجّلنا اهتمامك وسنخبرك عند توفر الخدمة.'); } }).catch(() => undefined);
  }, [currentUser, serviceId, cityId]);
  if (!comingSoonLike(d) || !cityId) return null;
  const send = async () => {
    if (!currentUser) { openOnboarding('client'); return; }
    setState('sending');
    try { const r = await requestJSON('/api/availability/interest', 'POST', { serviceId, cityId, consent, contactPreference: contact }); setState('done'); setMessage(r.already ? 'اهتمامك مسجّل مسبقاً.' : 'سجّلنا اهتمامك وسنخبرك عند توفر الخدمة.'); }
    catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : 'تعذر التسجيل'); }
  };
  return <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
    <p className="font-bold">هل تريد أن نخبرك عند توفر هذه الخدمة في مدينتك؟</p>
    {state === 'done' ? <p role="status">{message}</p> : <>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />أوافق على التواصل معي بخصوص توفر هذه الخدمة فقط</label>
      <label className="block text-xs">وسيلة التواصل<select className="mr-2 rounded-lg border p-1" value={contact} onChange={e => setContact(e.target.value)}><option value="WHATSAPP">واتساب</option><option value="PHONE">هاتف</option><option value="EMAIL">بريد</option><option value="NONE">داخل التطبيق فقط</option></select></label>
      <button type="button" disabled={!consent || state === 'sending'} onClick={() => void send()} className="rounded-xl bg-saudi-green-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{currentUser ? 'أبلغني عند التوفر' : 'سجّل الدخول لتسجيل اهتمامك'}</button>
      {state === 'error' && <p role="alert" className="text-xs text-red-700">{message}</p>}
    </>}
  </div>;
}
