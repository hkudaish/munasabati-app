import type { MetadataRoute } from 'next';

/** Lets the site be installed on a phone's home screen. The icons are committed static files (scripts/generate-brand-assets.mjs). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'مناسبتـي — خططها. احجزها. اعزمهم. احتفل.', short_name: 'مناسبتـي',
    description: 'المنصة السعودية لتخطيط وحجز المناسبات والأعراس والتخرج والدعوات.',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'ar', dir: 'rtl',
    background_color: '#FAF7F2', theme_color: '#004D3F', categories: ['lifestyle', 'shopping', 'events'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'الخدمات والعروض', url: '/commerce', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'الباقات', url: '/packages', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'طلباتي', url: '/commerce/orders', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
