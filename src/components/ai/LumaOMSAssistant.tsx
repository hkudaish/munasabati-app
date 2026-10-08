'use client';

import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, ShieldCheck, HelpCircle } from 'lucide-react';
import type { OMSMasterOrder, OMSSuborder } from '@/lib/oms/types';
import { queryLumaCustomerAssistant } from '@/lib/oms/luma-assistant';

interface LumaOMSAssistantProps {
  suborder: OMSSuborder;
  masterOrder: OMSMasterOrder;
  onClose?: () => void;
}

export function LumaOMSAssistant({ suborder, masterOrder, onClose }: LumaOMSAssistantProps) {
  const initialResponse = queryLumaCustomerAssistant(suborder, masterOrder);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: `${initialResponse.summaryAr} ${initialResponse.explanationAr || ''}`,
    },
  ]);
  const [input, setInput] = useState<string>('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);

    setTimeout(() => {
      let aiReply = 'أنا هنا لمساعدتك في تتبع الطلب وضمان تنفيذ الخدمة في الوقت المحدد وفق اتفاقية مستوى الخدمة.';
      if (userText.includes('تأخير') || userText.includes('متأخر')) {
        aiReply = 'إذا لاحظت أي تأخير من المورد، تم رفع درجة المتابعة تلقائياً لفريق العمليات لإلزام المورد بالتسليم أو توفير مورد بديل فوراً.';
      } else if (userText.includes('تعديل') || userText.includes('تغيير')) {
        aiReply = 'يمكنك طلب تعديل على المخرجات بعد رفع المورد للملفات من خلال زر "طلب تعديلات إضافية" في شاشة الطلب.';
      }
      setMessages((prev) => [...prev, { sender: 'ai', text: aiReply }]);
    }, 600);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-right" dir="rtl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">المساعد الذكي لُـمى (Luma Order Assistant)</h3>
            <p className="text-[10px] text-slate-400">مساعدك الشخصي لتتبع الطلب وحماية حقوقك</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto p-1">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] text-xs p-3 rounded-2xl leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 border border-slate-800 text-slate-200'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {initialResponse.suggestedActionsAr.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {initialResponse.suggestedActionsAr.map((act, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(act);
              }}
              className="text-[10px] bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full transition"
            >
              • {act}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="اسأل لُـمى عن حالة الطلب أو التسليم..."
          className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500"
        />
        <button
          onClick={handleSend}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold p-2.5 rounded-xl transition shadow-md shadow-amber-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
