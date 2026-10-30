import 'server-only';
import { clientIp } from '../auth';
import type { RequestMeta } from './workflow';

/** Where a request came from, kept with a consent so it can be shown later (address, browser, and the site the link was built for). */
export function metaOf(request: Request): RequestMeta {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
  return { ip: clientIp(request), userAgent: request.headers.get('user-agent') || '', origin };
}
