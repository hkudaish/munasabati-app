import type { Metadata } from 'next';
import Storefront from '@/components/commerce/Storefront';
import JsonLd from '@/components/seo/JsonLd';
import { getLocale } from '@/lib/i18n/server';
import { buildMetadata } from '@/lib/seo/metadata';
import { serviceJsonLd, serviceSeo } from '@/lib/server/seo/service';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
/** The page's own title, description, image, canonical and language alternates, taken from the real service. A service the public cannot see is not indexed. */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params, locale = await getLocale();
  const seo = await serviceSeo(params.id, locale).catch(() => null);
  const path = '/commerce/service/' + encodeURIComponent(params.id);
  if (!seo) return buildMetadata({ path, locale, index: false });
  return buildMetadata({ path, locale, title: `${seo.title} | ${seo.provider}`, description: seo.description || undefined, image: seo.image, index: seo.published && (locale === 'ar' || seo.hasEnglish), bilingual: seo.hasEnglish }); // an English address with Arabic-only text is not offered to search engines
}
export default async function Page(props: Props) {
  const params = await props.params, locale = await getLocale();
  const seo = await serviceSeo(params.id, locale).catch(() => null);
  return <div className="max-w-6xl mx-auto p-4 sm:p-8">{seo?.published && <JsonLd data={serviceJsonLd(params.id, locale, seo)} />}<Storefront serviceId={params.id} /></div>;
}
