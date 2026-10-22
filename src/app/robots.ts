import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { siteUrl } from '@/lib/site';
import { PRIVATE_PREFIXES } from '@/lib/seo/registry';

export const dynamic = 'force-dynamic';
/** Only the real site is crawlable. Preview deploys, branch deploys and any other host (localhost, a test server) are closed to crawlers. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const host = headers().get('host') ?? '';
  if (host && host !== new URL(base).host) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', ...PRIVATE_PREFIXES.flatMap(p => [p, '/en' + p])] }],
    sitemap: `${base}/sitemap.xml`, host: base,
  };
}
