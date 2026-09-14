'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  QrCode,
  Share2,
  Copy,
  Check,
  MapPin,
  Calendar,
  Clock,
  Palette,
  MessageSquare,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '@/lib/store';

export default function DigitalInviteGenerator() {
  const { activeOccasion } = useApp();

  const [theme, setTheme] = useState<'emerald' | 'gold' | 'maroon' | 'navy'>('emerald');
  const [openingPhrase, setOpeningPhrase] = useState(
    'بأسمى آيات الفرح والسرور، نتشرف بدعوتكم لمشاركتنا أجمل اللحظات في'
  );
  const [celebrantName, setCelebrantName] = useState(
    activeOccasion?.title || 'حفلنا المبارك'
  );
  const [venueNote, setVenueNote] = useState(
    activeOccasion?.venueName || 'الرياض - قاعة الاحتفالات الكبرى'
  );
  const [copied, setCopied] = useState(false);

  if (!activeOccasion) return null;

  const publicInviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/MUN-DEMO-${activeOccasion.id}`
    : `https://munasabati.sa/invite/MUN-DEMO-${activeOccasion.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = `${openingPhrase}\n✨ *${celebrantName}*\n📅 الموعد: ${activeOccasion.date}\n📍 الموقع: ${venueNote}\n\nنرجو تأكيد حضوركم عبر الرابط المخصص مع رمز الدخول:\n${publicInviteUrl}\n\nحياكم الله وبحضوركم تكتمل فرحتنا! 🤍`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const themeStyles = {
    emerald: {
      bg: 'bg-gradient-to-b from-[#00332A] via-[#004D3F] to-[#001F19]',
      border: 'border-saudi-gold-400/50',
      textAccent: 'text-saudi-gold-300',
      tagBg: 'bg-saudi-gold-500/20 text-saudi-gold-300 border-saudi-gold-400/30',
      cardGlow: 'shadow-[0_0_50px_rgba(0,77,63,0.4)]',
    },
    gold: {
      bg: 'bg-gradient-to-b from-[#2A200B] via-[#453412] to-[#1A1406]',
      border: 'border-saudi-gold-400',
      textAccent: 'text-saudi-gold-300',
      tagBg: 'bg-saudi-gold-500/30 text-saudi-gold-200 border-saudi-gold-400/40',
      cardGlow: 'shadow-[0_0_50px_rgba(197,155,39,0.3)]',
    },
    maroon: {
      bg: 'bg-gradient-to-b from-[#4A0E17] via-[#631420] to-[#2B070D]',
      border: 'border-rose-400/40',
      textAccent: 'text-rose-200',
      tagBg: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
      cardGlow: 'shadow-[0_0_50px_rgba(114,28,36,0.3)]',
    },
    navy: {
      bg: 'bg-gradient-to-b from-[#0A192F] via-[#172A45] to-[#050C1A]',
      border: 'border-blue-400/40',
      textAccent: 'text-blue-200',
      tagBg: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
      cardGlow: 'shadow-[0_0_50px_rgba(26,54,93,0.4)]',
    },
  };

  const currentTheme = themeStyles[theme];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Settings & Customization Panel */}
      <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm space-y-5">
        <div>
          <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
            <Palette className="w-5 h-5 text-saudi-gold-600" />
            <span>تخصيص بطاقة الدعوة الرقمية</span>
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            صمم بطاقة تفاعلية مميزة يمكنك إرسالها لضيوفك عبر الواتساب مع كود QR لتأكيد الحضور (RSVP).
          </p>
        </div>

        {/* Theme Selector */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">اختر الثيم اللوني:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('emerald')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                theme === 'emerald'
                  ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-900'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-saudi-green-800" />
              <span>الزمردي الملكي</span>
            </button>

            <button
              onClick={() => setTheme('gold')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                theme === 'gold'
                  ? 'border-saudi-gold-600 bg-saudi-gold-50 text-saudi-gold-900'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-saudi-gold-500" />
              <span>الذهب الفاخر</span>
            </button>

            <button
              onClick={() => setTheme('maroon')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                theme === 'maroon'
                  ? 'border-rose-700 bg-rose-50 text-rose-900'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-saudi-maroon" />
              <span>العنابي التراثي</span>
            </button>

            <button
              onClick={() => setTheme('navy')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                theme === 'navy'
                  ? 'border-blue-900 bg-blue-50 text-blue-950'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-900" />
              <span>الكحلي الليلي</span>
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">عبارة الترحيب والدعوة</label>
            <input
              type="text"
              value={openingPhrase}
              onChange={(e) => setOpeningPhrase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">عنوان المناسبة / أسماء المحتفى بهم</label>
            <input
              type="text"
              value={celebrantName}
              onChange={(e) => setCelebrantName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">الموقع والقاعة</label>
            <input
              type="text"
              value={venueNote}
              onChange={(e) => setVenueNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <button
            onClick={handleWhatsAppShare}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>مشاركة الدعوة عبر الواتساب للجميع</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ رابط الدعوة بنجاح!' : 'نسخ رابط RSVP المباشر'}</span>
          </button>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="lg:col-span-7 flex justify-center">
        <div
          className={`w-full max-w-md ${currentTheme.bg} ${currentTheme.cardGlow} rounded-3xl p-8 text-white border ${currentTheme.border} relative overflow-hidden text-center space-y-6 animate-fadeIn`}
        >
          {/* Top Decorative Border */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-[1px] w-12 bg-saudi-gold-400/40" />
            <Sparkles className="w-5 h-5 text-saudi-gold-400" />
            <div className="h-[1px] w-12 bg-saudi-gold-400/40" />
          </div>

          {/* Invitation Text */}
          <div className="space-y-2">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${currentTheme.tagBg} inline-block`}>
              دعوة خاصة
            </span>
            <p className="text-xs text-gray-200 leading-relaxed font-tajawal pt-2">
              {openingPhrase}
            </p>
            <h3 className={`text-2xl font-black font-cairo ${currentTheme.textAccent} pt-1`}>
              {celebrantName}
            </h3>
          </div>

          {/* Event Details Grid */}
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10 grid grid-cols-2 gap-3 text-right text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-saudi-gold-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block">التاريخ</span>
                <span className="font-bold text-white">{activeOccasion.date}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-saudi-gold-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block">الوقت</span>
                <span className="font-bold text-white">{activeOccasion.time || '08:00 مساءً'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 col-span-2 pt-1 border-t border-white/10">
              <MapPin className="w-4 h-4 text-saudi-gold-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block">الموقع</span>
                <span className="font-bold text-white line-clamp-1">{venueNote}</span>
              </div>
            </div>
          </div>

          {/* Simulated QR Code for RSVP */}
          <div className="bg-white p-3.5 rounded-2xl inline-block shadow-lg mx-auto">
            <div className="w-32 h-32 bg-saudi-sand-50 border border-gray-200 rounded-xl flex flex-col items-center justify-center p-2">
              <QrCode className="w-20 h-20 text-saudi-green-950" />
              <span className="text-[9px] font-mono font-bold text-gray-600 mt-1">
                SCAN TO RSVP
              </span>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-saudi-sand-300 font-medium">
            يرجى إبراز كود الـ QR عند بوابة الدخول لتسهيل الترحيب بكم
          </p>

          <div className="pt-2 text-[10px] text-gray-400 border-t border-white/10">
            تم تصميم وتنظيم هذه المناسبة عبر منصة مناسبتـي 🇸🇦
          </div>
        </div>
      </div>
    </div>
  );
}
