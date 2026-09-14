'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Plus, CalendarDays, Sparkles, FileText } from 'lucide-react';
import { useApp } from '@/lib/store';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { activeOccasion, setIsAIOpen } = useApp();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-saudi-sand-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5">
      <div className="flex items-center justify-around relative">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition ${
            pathname === '/' ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">الرئيسية</span>
        </Link>

        {/* Marketplace */}
        <Link
          href="/marketplace"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition ${
            pathname.startsWith('/marketplace') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px]">استكشف</span>
        </Link>

        {/* Central Prominent CTA: + مناسبتي */}
        <div className="relative -top-5">
          <Link
            href="/plan"
            className="w-13 h-13 w-12 h-12 rounded-full bg-gradient-to-tr from-saudi-green-900 to-saudi-green-700 text-saudi-gold-300 flex items-center justify-center shadow-lg shadow-saudi-green-900/30 border-2 border-saudi-gold-400 hover:scale-105 active:scale-95 transition"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </Link>
          <span className="block text-center text-[10px] font-black text-saudi-green-900 mt-1">
            + مناسبتي
          </span>
        </div>

        {/* Occasion Workspace */}
        {activeOccasion ? (
          <Link
            href={`/occasion/${activeOccasion.id}`}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition ${
              pathname.startsWith('/occasion') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px]">مناسبتي</span>
          </Link>
        ) : (
          <Link
            href="/rfq"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition ${
              pathname.startsWith('/rfq') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">عروض الأسعار</span>
          </Link>
        )}

        {/* AI Assistant (Luma) */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-saudi-gold-600 hover:text-saudi-gold-700 transition"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold">لُـمى (AI)</span>
        </button>
      </div>
    </div>
  );
}
