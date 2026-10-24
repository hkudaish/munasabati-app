import 'server-only';
import { headers } from 'next/headers';
import { isLocale, Locale } from './locale';
import { EN } from './dictionary';
import { format } from './format';

/** The language of the request, set by the middleware. */
export async function getLocale(): Promise<Locale> { const value = (await headers()).get('x-locale'); return isLocale(value) ? value : 'ar'; }
/** The public address that was asked for (with /en when English), and the same page without the language prefix. */
export async function getPaths() { const h = await headers(); return { pathname: h.get('x-pathname') ?? '/', innerPath: h.get('x-inner-path') ?? h.get('x-pathname') ?? '/' }; }
/** Translator for server components: the Arabic text is the key. */
export async function getT() {
  const locale = await getLocale();
  return (source: string, vars?: Record<string, string | number>) => format(locale === 'en' ? EN[source] ?? source : source, vars);
}
