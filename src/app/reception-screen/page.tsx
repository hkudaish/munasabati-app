'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Users,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Clock,
  Calendar,
  CheckCircle2,
  Armchair,
  QrCode,
  Scan,
  Heart,
  Gift,
  ArrowRight
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { Guest } from '@/lib/types';
import confetti from 'canvas-confetti';

function ReceptionWelcomeScreenContent() {
  const searchParams = useSearchParams();
  const { occasions, guests, activeOccasion, updateGuestStatus, eaniyahGifts } = useApp();

  // Find target occasion or active occasion
  const occasionIdParam = searchParams.get('occasionId');
  const targetOccasion =
    occasions.find((o) => o.id === occasionIdParam) || activeOccasion || occasions[0];

  const occasionGuests = guests.filter((g) => g.occasionId === targetOccasion.id);
  const attendedGuests = occasionGuests.filter((g) => g.status === 'attended');
  const occasionEaniyah = eaniyahGifts.filter((g) => g.occasionId === targetOccasion.id);

  // States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateString, setCurrentDateString] = useState('');
  const [activeWelcomeGuest, setActiveWelcomeGuest] = useState<Guest | null>(null);
  const [recentArrivals, setRecentArrivals] = useState<Guest[]>([]);
  const previousAttendedCountRef = useRef(attendedGuests.length);

  // Synthesize royal welcome chime using HTML5 Web Audio API
  const playWelcomeChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Royal Chord: E5, G#5, B5, E6
      playTone(659.25, 0.0, 1.2, 0.25);
      playTone(830.61, 0.15, 1.4, 0.22);
      playTone(987.77, 0.3, 1.6, 0.2);
      playTone(1318.51, 0.45, 2.0, 0.25);
    } catch {
      // AudioContext unavailable or blocked by autoplay
    }
  };

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateString(
        now.toLocaleDateString('ar-SA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to new attended guests (from other tabs / scan page or simulator)
  useEffect(() => {
    if (attendedGuests.length > previousAttendedCountRef.current) {
      // Latest attended guest
      const latest = attendedGuests[attendedGuests.length - 1];
      triggerWelcome(latest);
    }
    previousAttendedCountRef.current = attendedGuests.length;
  }, [attendedGuests.length]);

  const triggerWelcome = (guest: Guest) => {
    setActiveWelcomeGuest(guest);
    setRecentArrivals((prev) => [guest, ...prev.filter((g) => g.id !== guest.id)].slice(0, 5));
    playWelcomeChime();

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.4 },
        colors: ['#C59B27', '#E5C158', '#004D3F', '#FFFFFF'],
      });
    } catch {
      // fallback
    }

    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      setActiveWelcomeGuest((current) => (current?.id === guest.id ? null : current));
    }, 8000);

    return () => clearTimeout(timer);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Manual simulator test
  const handleSimulateArrival = (guest: Guest) => {
    updateGuestStatus(guest.id, 'attended');
    triggerWelcome(guest);
  };

  const attendancePercentage =
    occasionGuests.length > 0 ? Math.round((attendedGuests.length / occasionGuests.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#00261E] via-[#003B2F] to-[#001813] text-white flex flex-col justify-between p-4 sm:p-8 select-none relative overflow-hidden font-tajawal">
      
      {/* Background Islamic Geometric / Glow Accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-saudi-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-saudi-green-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#c59b27_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none" />

      {/* Floating Control Toolbar (Discreet for TV / iPads) */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 opacity-60 hover:opacity-100 transition">
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition"
          title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition"
          title={soundEnabled ? 'كتم الصوت الترحيبي' : 'تشغيل الصوت الترحيبي'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-saudi-gold-300" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <Link
          href="/scan"
          target="_blank"
          className="p-2 rounded-xl hover:bg-white/10 text-saudi-gold-300 flex items-center gap-1 text-[11px] font-bold px-2.5 transition"
          title="فتح قارئ البوابة في نافذة جديدة"
        >
          <Scan className="w-3.5 h-3.5" />
          <span>فتح الماسح</span>
        </Link>
      </div>

      {/* 1. Top Luxury Header */}
      <header className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-saudi-gold-500/20 pb-6 pt-2">
        <div className="text-center md:text-right space-y-1">
          <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 text-saudi-gold-300 px-3.5 py-1 rounded-full border border-saudi-gold-400/40 text-xs font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>بوابة الاستقبال والترحيب الرقمية • {targetOccasion.occasionTypeNameAr}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-cairo text-white tracking-wide">
            {targetOccasion.title}
          </h1>
          <p className="text-xs sm:text-sm text-saudi-gold-200/90 font-medium">
            {targetOccasion.venueName || `${targetOccasion.cityNameAr} - قاعة الاحتفالات`}
          </p>
        </div>

        {/* Live Clock & Hijri Date */}
        <div className="text-center md:text-left bg-black/30 backdrop-blur-md px-6 py-3 rounded-3xl border border-saudi-gold-500/30 shadow-lg space-y-0.5">
          <div className="text-xl sm:text-2xl font-black font-mono text-saudi-gold-300 tracking-wider">
            {currentTime || '08:30:00 م'}
          </div>
          <div className="text-[11px] text-gray-300 font-medium flex items-center justify-center md:justify-end gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-saudi-gold-400" />
            <span>{currentDateString || targetOccasion.date}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Center Display: Dynamic VIP Welcome or Ambient Showcase */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-6 sm:py-10">
        {activeWelcomeGuest ? (
          /* VIP Announcement Banner (Triggered when guest checks in) */
          <div className="w-full max-w-4xl bg-gradient-to-b from-[#00382D] to-[#001F18] border-2 border-saudi-gold-400 rounded-3xl p-8 sm:p-14 text-center shadow-[0_0_80px_rgba(197,155,39,0.35)] animate-fadeIn space-y-6 relative overflow-hidden">
            
            {/* Top Ornamental Ribbon */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 text-saudi-green-950 px-6 py-2 rounded-full font-black text-xs sm:text-sm shadow-md uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>أهلاً وسهلاً ومرحباً بكم في حفلنا المبارك</span>
              <Sparkles className="w-4 h-4" />
            </div>

            {/* Guest Name Callout */}
            <div className="space-y-2">
              <span className="text-xs sm:text-sm text-saudi-gold-300 font-bold block">
                شرفتمونا بحضوركم الكريم:
              </span>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black font-cairo text-white drop-shadow-md">
                {activeWelcomeGuest.name}
              </h2>
            </div>

            {/* Seating and Companions Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-2">
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-saudi-gold-400/30 flex items-center justify-center gap-3">
                <Armchair className="w-6 h-6 text-saudi-gold-300" />
                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block font-medium">الطاولة المخصصة</span>
                  <strong className="text-base sm:text-lg font-black font-cairo text-saudi-gold-300">
                    {activeWelcomeGuest.tableName || 'طاولة الضيوف الكرام'}
                  </strong>
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-saudi-gold-400/30 flex items-center justify-center gap-3">
                <Users className="w-6 h-6 text-saudi-gold-300" />
                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block font-medium">القسم والمرافقين</span>
                  <strong className="text-base sm:text-lg font-black font-cairo text-white">
                    {activeWelcomeGuest.category === 'women' ? 'قسم النساء' : 'قسم الرجال'}{' '}
                    {activeWelcomeGuest.companionCount > 0
                      ? `(+${activeWelcomeGuest.companionCount} مرافق)`
                      : ''}
                  </strong>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto italic font-tajawal">
              "حياكم الله وبحضوركم تكتمل فرحتنا وسرورنا 🤍"
            </p>
          </div>
        ) : (
          /* Ambient Idle State (Waiting for Guests) */
          <div className="w-full max-w-4xl text-center space-y-8 animate-fadeIn">
            <div className="space-y-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-br from-saudi-gold-400 to-saudi-gold-600 text-saudi-green-950 flex items-center justify-center shadow-[0_0_50px_rgba(197,155,39,0.4)] animate-pulse">
                <Sparkles className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>

              <h2 className="text-3xl sm:text-5xl font-black font-cairo text-white">
                أهلاً وسهلاً بضيوفنا الأعزاء
              </h2>
              <p className="text-sm sm:text-base text-saudi-gold-200/90 max-w-lg mx-auto font-medium leading-relaxed">
                يسعدنا تشريفكم لحضور هذه الليلة المباركة، نرجو إبراز بطاقة الدخول (QR) عند البوابة لتسجيل الحضور والاستدلال على طاولتكم.
              </p>
            </div>

            {/* Quick Simulation Bar for Demonstration */}
            <div className="bg-black/30 backdrop-blur-md p-4 rounded-3xl border border-white/10 max-w-2xl mx-auto space-y-2">
              <div className="flex items-center justify-between text-[11px] text-saudi-gold-300 font-bold px-2">
                <span>💡 تجربة محاكاة وصول ضيف للبوابة فورياً:</span>
                <span className="text-gray-400">انقر لتشغيل الترحيب والصوت</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {occasionGuests.slice(0, 4).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSimulateArrival(g)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-saudi-gold-500 hover:text-saudi-green-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recently Checked-in avatars / cards */}
            {recentArrivals.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
                  وصلوا حديثاً إلى القاعة 🌟
                </span>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {recentArrivals.map((g) => (
                    <div
                      key={g.id}
                      className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2 text-xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <span className="font-bold text-white">{g.name}</span>
                      <span className="text-[10px] text-saudi-gold-300">({g.tableName || 'طاولة عامة'})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Bottom Live Metrics & Congratulatory Blessings Ticker */}
      <footer className="relative z-10 space-y-4 pt-4 border-t border-saudi-gold-500/20">
        
        {/* Hall Attendance Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] sm:text-xs text-gray-400 block font-medium">المدعوين الإجمالي</span>
            <strong className="text-base sm:text-xl font-black font-cairo text-white">
              {occasionGuests.length} ضيف
            </strong>
          </div>

          <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-saudi-gold-500/30">
            <span className="text-[10px] sm:text-xs text-saudi-gold-300 block font-medium">الحاضرين في القاعة</span>
            <strong className="text-base sm:text-xl font-black font-cairo text-saudi-gold-300">
              {attendedGuests.length} حاضر
            </strong>
          </div>

          <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] sm:text-xs text-gray-400 block font-medium">نسبة الامتلاء</span>
            <strong className="text-base sm:text-xl font-black font-cairo text-white">
              {attendancePercentage}%
            </strong>
          </div>

          <div className="bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] sm:text-xs text-gray-400 block font-medium">حصيلة تبريكات العانية</span>
            <strong className="text-base sm:text-xl font-black font-cairo text-saudi-gold-300">
              {occasionEaniyah.length} إهداءات
            </strong>
          </div>
        </div>

        {/* Live Congratulatory Blessings Ticker */}
        {occasionEaniyah.length > 0 && (
          <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-saudi-gold-500/30 flex items-center gap-3 overflow-hidden text-xs">
            <div className="bg-saudi-gold-500 text-saudi-green-950 font-black px-2.5 py-1 rounded-xl text-[10px] shrink-0 flex items-center gap-1 shadow-sm">
              <Gift className="w-3.5 h-3.5" />
              <span>شريط التبريكات</span>
            </div>
            
            <div className="flex-1 whitespace-nowrap overflow-x-auto scrollbar-none flex items-center gap-8 text-gray-200">
              {occasionEaniyah.map((e, idx) => (
                <div key={idx} className="inline-flex items-center gap-2">
                  <span className="text-saudi-gold-300 font-bold">✨ {e.senderName}:</span>
                  <span className="text-gray-300">"{e.blessingMessage}"</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

export default function ReceptionWelcomeScreen() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-saudi-green-950 flex items-center justify-center text-saudi-gold-400 font-bold text-lg">جاري تجهيز شاشة الاستقبال الملكية...</div>}>
      <ReceptionWelcomeScreenContent />
    </Suspense>
  );
}
