'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  QrCode,
  Users,
  Send,
  Heart,
  Gift,
  Share2,
  Smartphone,
  Lock,
  MessageSquare
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import confetti from 'canvas-confetti';
import DigitalEaniyahModal from '@/components/occasion/DigitalEaniyahModal';

export default function GuestRSVPPage() {
  const params = useParams();
  const { occasions, guests, updateGuestStatus, eaniyahGifts } = useApp();

  const inviteCode = (params.code as string) || 'MUN-RSVP-DEMO';
  const currentOccasion = occasions[0]; // fallback to active demo occasion

  const [guestName, setGuestName] = useState('الدكتورة أمل العتيبي');
  const [phone, setPhone] = useState('+966501239988');
  const [status, setStatus] = useState<'confirmed' | 'declined' | null>(null);
  const [companionCount, setCompanionCount] = useState('0');
  const [congratsMessage, setCongratsMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEaniyahOpen, setIsEaniyahOpen] = useState(false);

  const occasionEaniyah = eaniyahGifts.filter((g) => g.occasionId === currentOccasion.id);
  const totalEaniyah = occasionEaniyah.reduce((acc, g) => acc + g.amount, 0);

  const handleRSVP = (choice: 'confirmed' | 'declined') => {
    setStatus(choice);
    setIsSubmitted(true);

    if (choice === 'confirmed') {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // fallback
      }
    }
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(currentOccasion.title);
    const details = encodeURIComponent(`حضور مناسبة: ${currentOccasion.title}\nالموقع: ${currentOccasion.venueName || currentOccasion.cityNameAr}`);
    const location = encodeURIComponent(currentOccasion.venueName || currentOccasion.cityNameAr);
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(googleCalUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 sm:py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-5 animate-fadeIn">
        
        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-saudi-sand-300 shadow-2xl overflow-hidden space-y-6">
          
          {/* Top Header Card */}
          <div className="bg-gradient-to-b from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 text-white p-8 text-center space-y-4 relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-saudi-gold-500 text-saudi-green-950 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-saudi-gold-300 uppercase tracking-widest block">
                دعوة خاصة لحضور
              </span>
              <h1 className="text-xl sm:text-2xl font-black font-cairo text-white">
                {currentOccasion.title}
              </h1>
            </div>

            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs text-right space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-saudi-gold-400 shrink-0" />
                <span>التاريخ: <strong>{currentOccasion.date}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-saudi-gold-400 shrink-0" />
                <span>الوقت: <strong>{currentOccasion.time || '08:00 مساءً'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-saudi-gold-400 shrink-0" />
                <span>الموقع: <strong>{currentOccasion.venueName || `${currentOccasion.cityNameAr} - قاعة الاحتفالات`}</strong></span>
              </div>
            </div>

            <button
              onClick={handleAddToCalendar}
              className="text-[11px] font-bold text-saudi-gold-300 hover:text-white underline inline-flex items-center gap-1 transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>إضافة المناسبة إلى تقويم الجوال (Google / Apple)</span>
            </button>
          </div>

          {/* RSVP Form / Confirmation State */}
          <div className="p-6 pt-0 space-y-5">
            {isSubmitted ? (
              <div className="text-center space-y-4 py-4 animate-fadeIn">
                {status === 'confirmed' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold font-cairo text-saudi-green-950">
                        تم تأكيد حضورك بنجاح! 🤍
                      </h3>
                      <p className="text-xs text-gray-500">
                        يسعدنا حضورك وتشريفك. يرجى إبراز كود الـ QR عند بوابة الدخول:
                      </p>
                    </div>

                    {/* QR Pass Box */}
                    <div className="bg-saudi-sand-50 p-4 rounded-2xl border border-saudi-sand-300 inline-block shadow-inner">
                      <QrCode className="w-32 h-32 mx-auto text-saudi-green-950" />
                      <span className="text-[10px] font-mono text-gray-600 block mt-2 font-bold">
                        {inviteCode || 'MUN-RSVP-PASS'}
                      </span>
                      <span className="text-[10px] font-bold text-saudi-green-800 block mt-1">
                        الضيف: {guestName}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                      <XCircle className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold font-cairo text-gray-900">
                        شكراً لإبلاغنا بالاعتذار
                      </h3>
                      <p className="text-xs text-gray-500">
                        نلتقي بكم في مناسبات وأفراح قادمة بإذن الله 🤍
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-base font-bold font-cairo text-gray-900">
                    هل ستشرفنا بالحضور؟ ✨
                  </h3>
                  <p className="text-xs text-gray-500">
                    يرجى تأكيد حضورك لتسهيل تنظيم المقاعد والضيافة.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكريم</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-saudi-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">عدد المرافقين</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={companionCount}
                        onChange={(e) => setCompanionCount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">كلمة تهنئة لأصحاب الحفل (اختياري)</label>
                    <input
                      type="text"
                      value={congratsMessage}
                      onChange={(e) => setCongratsMessage(e.target.value)}
                      placeholder="ألف مبروك وبالتوفيق والبركة..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleRSVP('confirmed')}
                    className="py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-saudi-gold-300" />
                    <span>تأكيد الحضور (يشرفني)</span>
                  </button>

                  <button
                    onClick={() => handleRSVP('declined')}
                    className="py-3 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <XCircle className="w-4 h-4 text-gray-400" />
                    <span>أعتذر عن الحضور</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature 1: Digital Eaniyah Viral Hook Card */}
        <div className="bg-gradient-to-r from-amber-50 via-saudi-sand-50 to-amber-100/60 rounded-3xl p-5 border border-saudi-gold-400/40 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center shadow-md">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black font-cairo text-saudi-green-950">
                  العانية والرفد الرقمي (Digital Eaniyah) 🎁
                </h4>
                <p className="text-[10px] text-gray-600">شارك فرحتك بهدية مالية مباركة تصل فوراً</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-saudi-green-900 bg-white px-2 py-0.5 rounded-full border border-saudi-gold-300 shadow-sm">
              Apple Pay / مدى
            </span>
          </div>

          <p className="text-xs text-gray-700 leading-relaxed">
            وفّر عناء الكاش؛ قدّم عانيتك أو تبريكاتك المالية مصحوبة ببطاقة إهداء مخصصة ومشاعر صادقة تخلد في ألبوم المناسبة.
          </p>

          <button
            onClick={() => setIsEaniyahOpen(true)}
            className="w-full py-3 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
          >
            <Smartphone className="w-4 h-4" />
            <span>إهداء عانية الآن بضغطة زر 🤍</span>
          </button>
        </div>

        {/* Recent Well-Wishers & Blessings Feed */}
        {occasionEaniyah.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-saudi-sand-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-bold font-cairo text-saudi-green-950 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-saudi-gold-600" />
                <span>سجل التهاني والتبريكات المباشر</span>
              </span>
              <span className="text-[10px] font-bold text-saudi-gold-600">
                {occasionEaniyah.length} مباركين
              </span>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {occasionEaniyah.slice(0, 3).map((g) => (
                <div key={g.id} className="p-3 bg-saudi-sand-50 rounded-2xl border border-saudi-sand-200 text-right space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <strong className="text-saudi-green-950 font-bold">{g.senderName}</strong>
                    <span className="text-saudi-gold-600 font-bold">
                      {g.isPrivateAmount ? 'عانية شرف' : formatSAR(g.amount)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 italic">"{g.blessingMessage}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-gray-400">
          منصة مناسبتـي 🇸🇦 • المنصة السعودية لإدارة وتنظيم المناسبات
        </div>

        {/* Eaniyah Modal */}
        <DigitalEaniyahModal
          isOpen={isEaniyahOpen}
          onClose={() => setIsEaniyahOpen(false)}
          occasionId={currentOccasion.id}
          occasionTitle={currentOccasion.title}
          recipientDefaultTitle="أصحاب الحفل الكرام"
          initialSenderName={guestName}
          initialSenderPhone={phone}
        />
      </div>
    </div>
  );
}
