import JsonLd from './JsonLd';
import { prisma } from '@/lib/db';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshotForListing } from '@/lib/server/availability/loader';
import { serviceContext, serviceRows } from '@/lib/server/availability/matrix';
import { getLocale } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/locale';
import { siteUrl } from '@/lib/site';

/** An ItemList of the services the public can currently see, for the store pages. */
export default async function ServicesJsonLd() {
  const locale = getLocale();
  try {
    const [snapshot, services, titles] = await Promise.all([loadSnapshotForListing(), serviceRows(), prisma.$queryRaw<{ id: string; en: string | null }[]>`SELECT "id", "body"->>'titleEn' AS en FROM "CommerceService"`]);
    const english = new Map(titles.map(t => [t.id, t.en]));
    const visible = services.filter(s => s.ready && (s.kind === 'DIGITAL' ? resolve(snapshot, serviceContext(s, null)).isVisible : s.cities.some(c => resolve(snapshot, serviceContext(s, c)).isVisible))).slice(0, 50);
    if (!visible.length) return null;
    return <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: visible.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: (locale === 'en' && english.get(s.id)) || s.title, url: siteUrl() + localizePath('/commerce/service/' + encodeURIComponent(s.id), locale) })) }} />;
  } catch { return null; }
}
