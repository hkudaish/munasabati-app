'use client';

import React, { useState } from 'react';
import { QrCode, CheckCircle2, AlertCircle, Users, Search, Scan, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import confetti from 'canvas-confetti';

export default function GateScannerPage() {
  const { activeOccasion, guests, updateGuestStatus } = useApp();

  const [inputCode, setInputCode] = useState('');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    guestName?: string;
    tableName?: string;
    companionCount?: number;
    category?: string;
    message: string;
  } | null>(null);

  if (!activeOccasion) return null;

  const occasionGuests = guests.filter((g) => g.occasionId === activeOccasion.id);
  const attendedCount = occasionGuests.filter((g) => g.status === 'attended').length;

  const handleScanCode = (codeToScan: string) => {
    if (!codeToScan.trim()) return;

    const matchedGuest = occasionGuests.find(
      (g) => g.qrCode.toLowerCase() === codeToScan.trim().toLowerCase()
    );

    if (matchedGuest) {
      updateGuestStatus(matchedGuest.id, 'attended');
      setScanResult({
        success: true,
        guestName: matchedGuest.name,
        tableName: matchedGuest.tableName || 'طاولة عامة',
        companionCount: matchedGuest.companionCount,
        category: matchedGuest.category === 'women' ? 'قسم النساء' : 'قسم الرجال',
        message: 'تم التحقق من الرمز وتسجيل الحضور بنجاح! حياك الله 🎉',
      });

      try {
        confetti({
          particleCount: 70,
          spread: 50,
          origin: { y: 0.6 },
        });
      } catch {
        // fallback
      }
    } else {
      setScanResult({
        success: false,
        message: 'عذراً، رمز الاستجابة السريعة (QR) غير مسجل في قائمة مدعوي هذه المناسبة!',
      });
    }

    setInputCode('');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-saudi-green-100 text-saudi-green-900 text-xs font-bold px-3 py-1 rounded-full">
          <Scan className="w-3.5 h-3.5" />
          <span>بوابة الدخول ومسح رمز الـ QR</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
          قارئ بطاقات دخول المناسبة 📱
        </h1>
        <p className="text-xs text-gray-500">
          مسح بطاقات الـ QR لتسجيل حضور الضيوف فوراً وتوجيههم إلى طاولاتهم المخصصة.
        </p>
      </div>

      {/* Live Entrance Counter */}
      <div className="bg-white p-5 rounded-3xl border border-saudi-sand-300 shadow-sm flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-gray-400 block">المناسبة الحالية:</span>
          <h3 className="text-sm font-bold text-saudi-green-900 font-cairo">{activeOccasion.title}</h3>
        </div>

        <div className="text-left bg-saudi-sand-50 px-4 py-2 rounded-2xl border border-saudi-sand-300">
          <span className="text-[10px] text-gray-400 block">إجمالي الحضور بالقاعة</span>
          <span className="text-xl font-black font-cairo text-saudi-green-950">
            {attendedCount} / {occasionGuests.length} ضيوف
          </span>
        </div>
      </div>

      {/* Simulated Scanner Viewfinder */}
      <div className="bg-saudi-green-950 rounded-3xl p-8 text-center text-white space-y-6 relative overflow-hidden shadow-2xl border border-saudi-gold-500/30">
        <div className="relative w-64 h-64 mx-auto border-2 border-dashed border-saudi-gold-400 rounded-3xl flex flex-col items-center justify-center p-4 bg-black/40">
          {/* Animated Scanner Laser Line */}
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-saudi-gold-400 to-transparent animate-pulse" />
          <QrCode className="w-24 h-24 text-saudi-gold-300/80" />
          <span className="text-[11px] text-gray-300 mt-3 font-medium">
            وجّه الكاميرا نحو باركود بطاقة الضيف
          </span>
        </div>

        {/* Manual Code Input & Quick Sample Clickers */}
        <div className="space-y-3 max-w-md mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanCode(inputCode);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="أدخل رمز QR يدوياً (مثال: MUN-GST-101-01)"
              className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-saudi-gold-400 text-center font-mono font-bold"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-xl text-xs shrink-0 transition"
            >
              فحص
            </button>
          </form>

          {/* Quick Demo QR buttons */}
          <div className="space-y-1 text-right">
            <span className="text-[10px] text-saudi-gold-300 font-bold block">
              💡 اضغط لتجربة فحص بطاقات المدعوين التجريبية:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {occasionGuests.slice(0, 3).map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleScanCode(g.qrCode)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-mono transition"
                >
                  {g.name} ({g.qrCode})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scan Result Alert */}
      {scanResult && (
        <div
          className={`p-6 rounded-3xl border shadow-lg animate-fadeIn text-right space-y-3 ${
            scanResult.success
              ? 'bg-green-50 border-green-300 text-green-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-center gap-3">
            {scanResult.success ? (
              <CheckCircle2 className="w-8 h-8 text-green-700 shrink-0" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />
            )}
            <div>
              <h3 className="text-base font-bold font-cairo">
                {scanResult.success ? scanResult.guestName : 'رمز غير صالح'}
              </h3>
              <p className="text-xs leading-relaxed">{scanResult.message}</p>
            </div>
          </div>

          {scanResult.success && (
            <div className="bg-white/80 p-4 rounded-2xl border border-green-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block">الطاولة المخصصة:</span>
                <strong className="text-saudi-green-900 text-sm">{scanResult.tableName}</strong>
              </div>
              <div>
                <span className="text-gray-500 block">القسم والمرافقين:</span>
                <strong className="text-gray-900">
                  {scanResult.category} {scanResult.companionCount ? `(+${scanResult.companionCount} مرافق)` : ''}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
