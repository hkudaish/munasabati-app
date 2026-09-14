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
} from 'lucide-react';
import { useApp } from '@/lib/store';
import confetti from 'canvas-confetti';

export default function GuestRSVPPage() {
  const params = useParams();
  const { occasions, guests, updateGuestStatus } = useApp();

  const inviteCode = params.code as string;
  const currentOccasion = occasions[0]; // fallback to active demo occasion

  const [guestName, setGuestName] = useState('الدكتورة أمل العتيبي');
  const [phone, setPhone] = useState('+966501239988');
  const [status, setStatus] = useState<'confirmed' | 'declined' | null>(null);
  const [companionCount, setCompanionCount] = useState('0');
  const [congratsMessage, setCongratsMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 sm:py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl border border-saudi-sand-300 shadow-2xl overflow-hidden animate-fadeIn space-y-6">
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
                  <div className="bg-saudi-sand-50 p-4 rounded-2xl border border-saudi-sand-300 inline-block">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
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

          <div className="text-center pt-2 text-[10px] text-gray-400">
            تم إرسال هذه الدعوة عبر منصة مناسبتـي 🇸🇦
          </div>
        </div>
      </div>
    </div>
  );
}
