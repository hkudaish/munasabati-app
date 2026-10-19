import type { Metadata, Viewport } from 'next';
import { Tajawal, Cairo } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';
import FeatureProvider, { FeatureContent } from '@/components/system/FeatureProvider';
import { featureStatesForLayout } from '@/lib/server/features';
import { defaultFeatures } from '@/lib/system/feature-catalog';
import GeoProvider from '@/components/geo/GeoProvider';
import CoverageNotice from '@/components/geo/CoverageNotice';
import SiteChrome from '@/components/geo/SiteChrome';
import { geoContext } from '@/lib/server/geo/context';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import Footer from '@/components/layout/Footer';
import LumaAIDrawer from '@/components/ai/LumaAIDrawer';
import UserOnboardingModal from '@/components/common/UserOnboardingModal';
import Toaster from '@/components/common/Toaster';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مناسبتـي | منصة التخطيط الذكي وحجز المناسبات والاحتفالات السعودية',
  description: 'خططها. احجزها. اعزمهم. احتفل. المنصة السعودية الأولى لتنظيم وحجز كافة خدمات وباقات المناسبات والأعراس والتخرج بالذكاء الاصطناعي.',
  keywords: ['مناسبتي', 'تخطيط مناسبات', 'كوشة بالرياض', 'ضيافة سعودية', 'قهوجيين', 'حفلات تخرج', 'زواج', 'ملكة', 'عروض أسعار'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#004D3F',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Independent database reads: run them together so the layout waits for the slower one, not both.
  const [location, features] = await Promise.all([
    geoContext({ layout: true }).catch(() => null),
    featureStatesForLayout().catch(() => defaultFeatures().map(f => ({ ...f, enabled: false, visible: false }))),
  ]);
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${cairo.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1E293B] antialiased selection:bg-saudi-gold-400 selection:text-saudi-green-950">
        <GeoProvider initial={location}><FeatureProvider initial={features}><AppProvider>
          <SiteChrome><Navbar /><CoverageNotice /></SiteChrome>
          <main className="flex-1">
            {children}
          </main>
          <SiteChrome><FeatureContent id="luma"><LumaAIDrawer /></FeatureContent></SiteChrome>
          <UserOnboardingModal />
          <Toaster />
          <SiteChrome><MobileBottomNav /><Footer /></SiteChrome>
        </AppProvider></FeatureProvider></GeoProvider>
      </body>
    </html>
  );
}
