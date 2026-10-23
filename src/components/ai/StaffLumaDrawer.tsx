'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, Send, Star, ShieldCheck, Clock, MapPin, Award } from 'lucide-react';
import { useApp } from '@/lib/store';
import { requestJSON } from '@/lib/api-client';
import RichText from './RichText';

interface Vendor { id: string; businessName: string; categoryAr: string; cityAr: string; serviceAreas: string[]; verified: boolean; featured: boolean; responseTimeMinutes: number; rating: number | null; reviews: number; completed: number; services: number; rated: boolean }
interface Message { id: string; sender: 'luma' | 'user'; text: string; vendors?: Vendor[]; method?: string }

/** The same words people use for a service, mapped to the category they mean (the category names alone are too long to type). */
const SYNONYMS: [RegExp, string][] = [[/مصور|تصوير|فوتوغراف|كاميرا/, 'photo'], [/ضيافة|قهو|بوفيه|صباب|طعام|أكل/, 'hospit'], [/كوش|ورد|ديكور|تنسيق/, 'decor|kosha|bloom'], [/قاع|فندق|منتجع|استراح/, 'hall'], [/فنان|فنانة|عروض|ترفيه|دي جي|dj/i, 'entertain'], [/زفة|زفات/, 'zaff'], [/كيك|حلوى|حلويات|شوكولا/, 'cake|sweet'], [/دعو|بطاقات/, 'invit'], [/صوت|إضاءة|شاشات/, 'sound'], [/توزيعات|هدايا/, 'gift|giveaway']];

export default function StaffLumaDrawer() {
  const { isAIOpen, setIsAIOpen, adminConfig, serviceCategories, cities } = useApp();
  const [categoryId, setCategoryId] = useState(''), [cityId, setCityId] = useState(''), [input, setInput] = useState(''), [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', sender: 'luma', text: `أهلاً بك. أنا **${adminConfig.aiAssistantNameAr}**، مستشارة الإدارة والتنسيق.\n\nاسألني عن الموردين المتميزين في خدمة معينة أو منطقة معينة، وسأرتبهم بحسب تقييمات العملاء المعتمدة وعدد الحجوزات المكتملة. مثال: «أفضل المصورين في جدة».` }]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  if (!isAIOpen) return null;

  const findCategory = (query: string) => {
    const direct = serviceCategories.find(c => query.includes(c.nameAr) || query.includes(c.id));
    if (direct) return direct.id;
    for (const [pattern, key] of SYNONYMS) if (pattern.test(query)) { const hit = serviceCategories.find(c => new RegExp(key, 'i').test(c.id + ' ' + c.nameEn)); if (hit) return hit.id; }
    return '';
  };
  const findCity = (query: string) => cities.find(c => query.includes(c.nameAr.split(' ')[0]) || (c.nameEn && query.toLowerCase().includes(c.nameEn.toLowerCase())))?.id ?? '';

  const ask = async (category: string, city: string, question: string) => {
    setBusy(true);
    setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'user', text: question }]);
    try {
      const q = new URLSearchParams(); if (category) q.set('categoryId', category); if (city) q.set('cityId', city);
      const r = await requestJSON('/api/admin/vendor-insights?' + q.toString());
      const where = [r.categoryAr, r.cityAr].filter(Boolean).join(' — ') || 'كل الخدمات والمناطق';
      const text = r.vendors.length
        ? `هؤلاء أبرز الموردين (${where}): **${r.vendors.length}** من أصل ${r.total}.\nالترتيب بحسب ${r.method}.`
        : `لا يوجد موردون نشطون يطابقون (${where}) حالياً. جرّب مدينة أو خدمة أخرى.`;
      setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'luma', text, vendors: r.vendors, method: r.method }]);
    } catch (e) { setMessages(m => [...m, { id: crypto.randomUUID(), sender: 'luma', text: e instanceof Error ? e.message : 'تعذر جلب البيانات' }]); }
    finally { setBusy(false); }
  };
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault(); const question = input.trim();
    if (!question) { void ask(categoryId, cityId, 'عرض الموردين بحسب الفلاتر'); return; }
    const category = findCategory(question) || categoryId, city = findCity(question) || cityId;
    if (category !== categoryId) setCategoryId(category); if (city !== cityId) setCityId(city);
    setInput(''); void ask(category, city, question);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="luma-staff-title" className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-saudi-gold-400 to-saudi-gold-600 text-saudi-green-950 flex items-center justify-center shadow-lg"><Sparkles className="w-6 h-6" /></div>
            <div>
              <h3 id="luma-staff-title" className="text-lg font-bold font-cairo">المساعد الذكي: {adminConfig.aiAssistantNameAr} <span className="bg-saudi-gold-500/20 text-saudi-gold-300 text-caption2 font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400/40">مستشارة الإدارة</span></h3>
              <p className="text-xs text-gray-300">أبرز الموردين لكل خدمة ومنطقة • الأفضل تقييماً • أداء الحجوزات</p>
            </div>
          </div>
          <button onClick={() => setIsAIOpen(false)} aria-label="إغلاق" className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10"><X className="w-6 h-6" /></button>
        </div>

        <div className="bg-saudi-green-950/95 px-4 py-3 grid grid-cols-2 gap-2 border-b border-saudi-gold-500/20 text-xs">
          <select aria-label="الخدمة" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="rounded-lg bg-white/10 text-white p-2"><option value="" className="text-black">كل الخدمات</option>{serviceCategories.map(c => <option key={c.id} value={c.id} className="text-black">{c.nameAr}</option>)}</select>
          <select aria-label="المدينة" value={cityId} onChange={e => setCityId(e.target.value)} className="rounded-lg bg-white/10 text-white p-2"><option value="" className="text-black">كل المناطق</option>{cities.map(c => <option key={c.id} value={c.id} className="text-black">{c.nameAr}</option>)}</select>
          <button disabled={busy} onClick={() => void ask(categoryId, cityId, 'الأفضل تقييماً بحسب الفلاتر')} className="col-span-2 rounded-lg bg-saudi-gold-500 py-2 font-bold text-saudi-green-950 disabled:opacity-60">عرض الأفضل تقييماً</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-saudi-sand-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[92%] rounded-2xl p-4 text-sm leading-7 ${msg.sender === 'user' ? 'bg-saudi-green-800 text-white' : 'bg-white border border-saudi-sand-300'}`}>
                <p className="whitespace-pre-line font-tajawal"><RichText text={msg.text} /></p>
                {msg.vendors?.map((v, i) => (
                  <article key={v.id} className="mt-3 rounded-xl border border-saudi-sand-300 bg-saudi-sand-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/vendor/${v.id}`} onClick={() => setIsAIOpen(false)} className="font-bold text-saudi-green-900 underline">{i + 1}. {v.businessName}</Link>
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

        <form onSubmit={submit} className="border-t border-saudi-sand-300 bg-white p-3 flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="مثال: أفضل المصورين في جدة" aria-label="سؤالك" className="flex-1 rounded-xl border border-saudi-sand-300 p-3 text-sm" />
          <button disabled={busy} className="rounded-xl bg-saudi-green-800 px-4 text-white disabled:opacity-60" aria-label="إرسال"><Send className="h-5 w-5" /></button>
        </form>
      </div>
    </div>
  );
}
