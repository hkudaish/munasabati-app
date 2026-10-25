'use client';

import { FeatureContent } from '@/components/system/FeatureProvider';
import React from 'react';
import Link from '@/components/system/FeatureLink';
import { useInnerPathname } from '@/components/i18n/LocaleProvider';
import { Home, ShoppingBag, Layers, CalendarDays, Sparkles, FileText, Store, ShieldCheck } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useT } from '@/components/i18n/LocaleProvider';

export default function MobileBottomNav() {
  const t = useT();
  const pathname = useInnerPathname();
  const { activeOccasion, setIsAIOpen, cart, currentRole, currentUser } = useApp();

  // If Vendor is active
  if (currentRole === 'vendor') {
    return (
      <div role="navigation" aria-label={t('التنقل الرئيسي')} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-saudi-sand-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around relative">
          <Link
            href="/vendor"
            className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
              pathname === '/vendor' ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
            aria-current={pathname === '/vendor' ? 'page' : undefined}
          >
            <Store className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('لوحة المورد')}</span>
          </Link>

          <Link
            href="/marketplace"
            className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
              pathname.startsWith('/marketplace') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('السوق')}</span>
          </Link>

          <Link
            href="/vendor/catalog"
            aria-current={pathname.startsWith('/vendor/catalog') ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
              pathname.startsWith('/vendor/catalog') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('الخدمات')}</span>
          </Link>

          <Link
            href="/vendor/orders"
            aria-current={pathname.startsWith('/vendor/orders') ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
              pathname.startsWith('/vendor/orders') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('الطلبات')}</span>
          </Link>

          <FeatureContent id="luma"><button
            onClick={() => setIsAIOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg text-saudi-gold-600 hover:text-saudi-gold-700 transition"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-caption2 font-bold max-w-full truncate">{t('لُـمى (AI)')}</span>
          </button></FeatureContent>
        </div>
      </div>
    );
  }

  // If Admin is active
  if (currentRole === 'admin') {
    return (
      <div role="navigation" aria-label={t('التنقل الرئيسي')} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-saudi-sand-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around relative">
          <Link
            href={currentUser?.hasSystemAccess ? '/system-admin' : '/admin'}
            className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
              pathname === '/admin' ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-saudi-green-800" />
            <span className="text-caption2 max-w-full truncate">{currentUser?.hasSystemAccess ? t('مدير النظام') : t('لوحة الإدارة')}</span>
          </Link>

          <Link
            href="/"
            className="flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg text-gray-500 hover:text-saudi-green-800 transition"
          >
            <Home className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('الرئيسية')}</span>
          </Link>

          <Link
            href="/vendor"
            className="flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg text-gray-500 hover:text-saudi-green-800 transition"
          >
            <Store className="w-5 h-5" />
            <span className="text-caption2 max-w-full truncate">{t('الموردين')}</span>
          </Link>

          <FeatureContent id="luma"><button
            onClick={() => setIsAIOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg text-saudi-gold-600 hover:text-saudi-gold-700 transition"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-caption2 font-bold max-w-full truncate">{t('لُـمى (AI)')}</span>
          </button></FeatureContent>
        </div>
      </div>
    );
  }

  // Default: Customer Bottom Nav
  return (
    <div role="navigation" aria-label={t('التنقل الرئيسي')} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-saudi-sand-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around relative">
        {/* Home */}
        <Link
          href="/"
          aria-current={pathname === '/' ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
            pathname === '/' ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-caption2 max-w-full truncate">{t('الرئيسية')}</span>
        </Link>

        {/* Explore: a fixed destination; the cart lives in the header */}
        <Link
          href="/marketplace"
          aria-current={pathname.startsWith('/marketplace') ? 'page' : undefined}
          className={`relative flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
            pathname.startsWith('/marketplace')
              ? 'text-saudi-green-800 font-bold'
              : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cart.length > 0 && (
            <span aria-label={t('في السلة {p1}', { p1: cart.reduce((s, i) => s + i.quantity, 0) })} className="absolute top-0 right-2 bg-saudi-green-800 text-white text-caption2 font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
          <span className="text-caption2 max-w-full truncate">{t('استكشف')}</span>
        </Link>

        {/* My occasion: opens the active occasion, or starts planning */}
        <Link
          href={activeOccasion ? `/occasion/${activeOccasion.id}` : '/plan'}
          aria-current={pathname.startsWith('/occasion') || pathname.startsWith('/plan') ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
            pathname.startsWith('/occasion') || pathname.startsWith('/plan') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-caption2 max-w-full truncate">{t('مناسبتي')}</span>
        </Link>

        {/* Quotes */}
        <Link
          href="/rfq"
          aria-current={pathname.startsWith('/rfq') ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg transition ${
            pathname.startsWith('/rfq') ? 'text-saudi-green-800 font-bold' : 'text-gray-500 hover:text-saudi-green-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-caption2 max-w-full truncate">{t('عروض الأسعار')}</span>
        </Link>

        {/* AI Assistant (Luma) */}
        <FeatureContent id="luma"><button
          onClick={() => setIsAIOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-1 flex-1 min-w-0 rounded-lg text-saudi-gold-600 hover:text-saudi-gold-700 transition"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-caption2 font-bold max-w-full truncate">{t('لُـمى (AI)')}</span>
        </button></FeatureContent>
      </div>
    </div>
  );
}
