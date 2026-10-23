'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, Send, Star, ShieldCheck, Clock, MapPin, Award, AlertTriangle, Info, BellRing } from 'lucide-react';
import { useApp } from '@/lib/store';
import { requestJSON } from '@/lib/api-client';
import RichText from './RichText';

interface Vendor { id: string; businessName: string; categoryAr: string; cityAr: string; serviceAreas: string[]; verified: boolean; responseTimeMinutes: number; rating: number | null; reviews: number; completed: number; services: number; rated: boolean }
interface Card { id: string; severity: 'critical' | 'warning' | 'info'; titleAr: string; detailAr: string; url: string }
interface Suggestion { label: string; intent: string; params: Record<string, string>; learned?: boolean }
interface Message { id: string; sender: 'luma' | 'user'; text: string; vendors?: Vendor[]; items?: Card[]; rows?: { label: string; value: string }[]; unknown?: boolean }

const TONE = { critical: 'border-red-300 bg-red-50', warning: 'border-amber-300 bg-amber-50', info: 'border-saudi-sand-300 bg-saudi-sand-50' };
function Cards({ items, close }: { items: Card[]; close: () => void }) {
  return <>{items.map(c => (
    <Link key={c.id} href={c.url} onClick={close} className={`mt-2 block rounded-xl border p-3 ${TONE[c.severity]}`}>
      <span className="flex items-center gap-1.5 font-bold">{c.severity === 'info' ? <Info className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}{c.titleAr}</span>
      <span className="mt-1 block whitespace-pre-line text-xs text-gray-700">{c.detailAr}</span>
    </Link>
  ))}</>;
}

/** The administrators' assistant. It answers only questions it can answer exactly from the platform's own data, and always shows which ones those are. */
export default function StaffLumaDrawer() {
  const { isAIOpen, setIsAIOpen, adminConfig, serviceCategories, cities } = useApp();
  const [categoryId, setCategoryId] = useState(''), [cityId, setCityId] = useState(''), [input, setInput] = useState(''), [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // the briefing when the assistant is opened: what needs attention now, and the questions it can answer
  useEffect(() => {
    if (!isAIOpen) return;
    let alive = true;
    void Promise.all([requestJSON('/api/reminders').catch(() => null), requestJSON('/api/luma/staff').catch(() => null)]).then(([r, s]) => {
      if (!alive) return;
      if (s) setSuggestions(s.suggestions);
      const name = adminConfig.aiAssistantNameAr;
      const urgent = r ? r.reminders.filter((x: any) => x.severity === 'critical') : [];
      const text = !r ? `أهلاً بك. أنا **${name}**، مستشارة الإدارة والتنسيق. اختر سؤالاً من الأسفل.`
        : urgent.length ? `أهلاً بك. أنا **${name}**. لديك **${urgent.length}** تنبيهاً عاجلاً من أصل ${r.counts.total}، وهذه أهمها:`
          : r.counts.total ? `أهلاً بك. أنا **${name}**. لا توجد تنبيهات عاجلة الآن، ولديك ${r.counts.total} عناصر للمتابعة.` : `أهلاً بك. أنا **${name}**. لا توجد أي تنبيهات الآن؛ كل شيء تحت السيطرة.`;
      setMessages([{ id: 'briefing', sender: 'luma', text, items: urgent.slice(0, 5).map((x: any) => ({ id: x.id, severity: x.severity, titleAr: x.titleAr, detailAr: x.detailAr, url: x.url })) }]);
    });
    return () => { alive = false; };
  }, [isAIOpen, adminConfig.aiAssistantNameAr]);
  if (!isAIOpen) return null;

  const ask = async (payload: { text?: string; intent?: string; params?: Record<string, string> }, shown: string) => {
    setBusy(true); setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'user', text: shown }]);
    try {
      const r = await requestJSON('/api/luma/staff', 'POST', payload);
      if (r.suggestions) setSuggestions(r.suggestions);
      setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'luma', text: r.answerAr, vendors: r.vendors, items: r.items, rows: r.rows, unknown: r.unknown }]);
    } catch (e) { setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'luma', text: e instanceof Error ? e.message : 'تعذر جلب البيانات' }]); }
    finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); const q = input.trim(); if (!q) return; setInput(''); void ask({ text: q }, q); };
  const close = () => setIsAIOpen(false);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="luma-staff-title" className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-saudi-gold-400 to-saudi-gold-600 text-saudi-green-950 flex items-center justify-center shadow-lg"><Sparkles className="w-6 h-6" /></div>
            <div>
              <h3 id="luma-staff-title" className="text-lg font-bold font-cairo">المساعد الذكي: {adminConfig.aiAssistantNameAr} <span className="bg-saudi-gold-500/20 text-saudi-gold-300 text-caption2 font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400/40">مستشارة الإدارة</span></h3>
              <p className="text-xs text-gray-300">أبرز الموردين • المواعيد المستحقة • المشكلات والملاحظات</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/reminders" onClick={close} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-saudi-gold-300 hover:bg-white/10"><BellRing className="h-4 w-4" aria-hidden="true" />كل التنبيهات</Link>
            <button onClick={close} aria-label="إغلاق" className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10"><X className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="bg-saudi-green-950/95 px-4 py-3 grid grid-cols-2 gap-2 border-b border-saudi-gold-500/20 text-xs">
          <select aria-label="الخدمة" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="rounded-lg bg-white/10 text-white p-2"><option value="" className="text-black">كل الخدمات</option>{serviceCategories.map(c => <option key={c.id} value={c.id} className="text-black">{c.nameAr}</option>)}</select>
          <select aria-label="المدينة" value={cityId} onChange={e => setCityId(e.target.value)} className="rounded-lg bg-white/10 text-white p-2"><option value="" className="text-black">كل المناطق</option>{cities.map(c => <option key={c.id} value={c.id} className="text-black">{c.nameAr}</option>)}</select>
          <button disabled={busy} onClick={() => void ask({ intent: 'VENDORS_TOP', params: { ...(categoryId ? { categoryId } : {}), ...(cityId ? { cityId } : {}) } }, 'الأفضل تقييماً بحسب الفلاتر')} className="col-span-2 rounded-lg bg-saudi-gold-500 py-2 font-bold text-saudi-green-950 disabled:opacity-60">عرض الأفضل تقييماً</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-saudi-sand-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[92%] rounded-2xl p-4 text-sm leading-7 ${msg.sender === 'user' ? 'bg-saudi-green-800 text-white' : 'bg-white border border-saudi-sand-300'}`}>
                <p className="whitespace-pre-line font-tajawal"><RichText text={msg.text} /></p>
                {msg.items && <Cards items={msg.items} close={close} />}
                {msg.rows?.map(r => <p key={r.label} className="mt-1 flex justify-between gap-3 rounded-lg bg-saudi-sand-50 px-3 py-1.5 text-xs"><strong>{r.label}</strong><span>{r.value}</span></p>)}
                {msg.vendors?.map((v, i) => (
                  <article key={v.id} className="mt-3 rounded-xl border border-saudi-sand-300 bg-saudi-sand-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/vendor/${v.id}`} onClick={close} className="font-bold text-saudi-green-900 underline">{i + 1}. {v.businessName}</Link>
                      <span className="flex items-center gap-1 text-xs font-bold">{v.rated ? <><Star className="h-3.5 w-3.5 fill-saudi-gold-500 text-saudi-gold-500" aria-hidden="true" />{v.rating} <span className="font-normal text-gray-600">({v.reviews} تقييماً معتمداً)</span></> : <span className="font-normal text-gray-600">لا تقييمات معتمدة بعد</span>}</span>
                    </div>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-700">
                      <span>{v.categoryAr}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{v.cityAr}{v.serviceAreas.length > 0 && ` + ${v.serviceAreas.length} مناطق خدمة`}</span>
                      <span className="inline-flex items-center gap-1"><Award className="h-3 w-3" aria-hidden="true" />{v.completed} حجزاً مكتملاً</span><span>{v.services} خدمات منشورة</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />استجابة ~{v.responseTimeMinutes} دقيقة</span>
                      {v.verified && <span className="inline-flex items-center gap-1 text-saudi-green-800"><ShieldCheck className="h-3 w-3" aria-hidden="true" />موثق</span>}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
          {busy && <p role="status" className="text-xs text-gray-500">جارٍ البحث…</p>}
          <div ref={end} />
        </div>

        {/* the questions she can answer exactly: always shown, built from the platform's own data and from what colleagues asked successfully */}
        <div className="border-t border-saudi-sand-300 bg-white px-3 pt-3">
          <p className="mb-1.5 text-caption2 font-bold text-gray-500">أسئلة أجيب عنها بدقة:</p>
          <div className="flex gap-2 overflow-x-auto pb-2" role="list" aria-label="أسئلة مقترحة">
            {suggestions.map(s => <button key={s.label} role="listitem" disabled={busy} onClick={() => void ask({ intent: s.intent, params: s.params }, s.label)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs disabled:opacity-60 ${s.learned ? 'border-saudi-gold-400 bg-saudi-gold-50 text-saudi-green-950' : 'border-saudi-green-800 bg-white text-saudi-green-900 hover:bg-saudi-green-50'}`}>{s.learned && '★ '}{s.label}</button>)}
          </div>
          <form onSubmit={submit} className="flex gap-2 pb-3">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="أو اكتب سؤالك، مثال: أفضل المصورين في جدة" aria-label="سؤالك" className="flex-1 rounded-xl border border-saudi-sand-300 p-3 text-sm" />
            <button disabled={busy} className="rounded-xl bg-saudi-green-800 px-4 text-white disabled:opacity-60" aria-label="إرسال"><Send className="h-5 w-5" /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
