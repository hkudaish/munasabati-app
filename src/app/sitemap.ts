import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { siteUrl } from '@/lib/site';
import { isTranslatedPath, localizePath } from '@/lib/i18n/locale';
import { SITEMAP_PAGES } from '@/lib/seo/registry';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshotForListing } from '@/lib/server/availability/loader';
import { serviceContext, serviceRows } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
type Entry = MetadataRoute.Sitemap[number];
/** Every public page in both languages (English only where it exists), plus each service that can currently be seen by the public. */
function pageEntries(path: string, base: Pick<Entry, 'changeFrequency' | 'priority' | 'lastModified'>): Entry[] {
  const url = (p: string) => siteUrl() + (p === '/' ? '' : p);
  if (!isTranslatedPath(path)) return [{ url: url(path) || siteUrl(), ...base }];
  const languages = { 'ar-SA': url(path) || siteUrl(), en: url(localizePath(path, 'en')), 'x-default': url(path) || siteUrl() };
  return [{ url: languages['ar-SA'], ...base, alternates: { languages } }, { url: languages.en, ...base, alternates: { languages } }];
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = SITEMAP_PAGES.flatMap(p => pageEntries(p.path, { changeFrequency: p.changeFrequency, priority: p.priority, lastModified: now }));
  try {
    const [snapshot, services, updated] = await Promise.all([loadSnapshotForListing(), serviceRows(), prisma.$queryRaw<{ id: string; updatedAt: Date; en: boolean }[]>`SELECT "id", "updatedAt", (COALESCE("body"->>'titleEn', '') <> '' AND COALESCE("body"->>'descriptionEn', '') <> '') AS "en" FROM "CommerceService" WHERE "body"->>'published' = 'true' AND "body"->>'approved' = 'true'`]);
    const modified = new Map(updated.map(r => [r.id, r.updatedAt])), english = new Set(updated.filter(r => r.en).map(r => r.id));
    for (const service of services) {
      const visible = service.kind === 'DIGITAL' ? resolve(snapshot, serviceContext(service, null)).isVisible : service.cities.some(city => resolve(snapshot, serviceContext(service, city)).isVisible);
      if (visible && service.ready) {
        const path = '/commerce/service/' + encodeURIComponent(service.id), base = { changeFrequency: 'weekly' as const, priority: 0.7, lastModified: modified.get(service.id) ?? now };
        // the English address is listed only for a service whose English text was written
        entries.push(...(english.has(service.id) ? pageEntries(path, base) : [{ url: siteUrl() + path, ...base }]));
      }
    }
  } catch (error) { console.warn(JSON.stringify({ event: 'sitemap.services_failed', error: error instanceof Error ? error.message : String(error) })); } // the fixed pages still list
  return entries;
}
