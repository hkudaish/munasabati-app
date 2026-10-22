import { NextResponse, type NextRequest } from 'next/server';
import { EN_PREFIX, LOCALE_COOKIE, isTranslatedPath, localeOfPath, stripLocale } from '@/lib/i18n/locale';

/** Serves /en/... from the same routes as the Arabic pages, tells the app which language it is serving (x-locale) and which public
    address was asked for (x-pathname), and keeps English only on pages that have an English interface. */
export function middleware(request: NextRequest) {
  const url = request.nextUrl, path = url.pathname;
  const headers = new Headers(request.headers);
  headers.set('x-pathname', path);
  if (localeOfPath(path) === 'en') {
    const inner = stripLocale(path);
    if (!isTranslatedPath(inner)) { const back = url.clone(); back.pathname = inner; return NextResponse.redirect(back, 307); } // no English version: the Arabic page
    headers.set('x-locale', 'en'); headers.set('x-inner-path', inner);
    const rewritten = url.clone(); rewritten.pathname = inner;
    const response = NextResponse.rewrite(rewritten, { request: { headers } });
    response.cookies.set(LOCALE_COOKIE, 'en', { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  }
  headers.set('x-locale', 'ar'); headers.set('x-inner-path', path);
  // A visitor who chose English once is taken to the English address of translated pages (crawlers carry no cookie, so they always get Arabic).
  if (request.method === 'GET' && request.cookies.get(LOCALE_COOKIE)?.value === 'en' && isTranslatedPath(path)) {
    const english = url.clone(); english.pathname = EN_PREFIX + (path === '/' ? '' : path.replace(/\/+$/, ''));
    return NextResponse.redirect(english, 307);
  }
  return NextResponse.next({ request: { headers } });
}
// Pages only: not the API, framework files, or anything with a file extension (icons, images, robots.txt, sitemap.xml, the manifest).
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
