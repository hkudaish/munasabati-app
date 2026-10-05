import type { Metadata } from 'next';
import { Tajawal, Cairo } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import Footer from '@/components/layout/Footer';
import LumaAIDrawer from '@/components/ai/LumaAIDrawer';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${cairo.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1E293B] antialiased selection:bg-saudi-gold-400 selection:text-saudi-green-950">
        <AppProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <LumaAIDrawer />
          <MobileBottomNav />
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
