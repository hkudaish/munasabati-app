import type { Occasion } from '@/lib/types';

export type PublicInvitation = Pick<Occasion, 'id' | 'title' | 'date' | 'time' | 'venueName' | 'cityNameAr'>;
export const INVITATION_ORIGIN_KEY = 'munasabati_invitation_origin_v1';

function publicDetails(value: unknown): PublicInvitation | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const limits = { id: 100, title: 100, date: 80, time: 80, venueName: 240, cityNameAr: 80 };
  for (const [key, limit] of Object.entries(limits)) {
    if (data[key] === undefined && (key === 'time' || key === 'venueName')) continue;
    if (typeof data[key] !== 'string' || (data[key] as string).length > limit) return null;
  }
  if (!data.id || !data.title) return null;
  return { id: data.id as string, title: data.title as string, date: data.date as string, time: data.time as string | undefined, venueName: data.venueName as string | undefined, cityNameAr: data.cityNameAr as string };
}
export function normalizeInvitationOrigin(origin: string): string {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('أدخل عنوان الموقع فقط، مثل https://example.com أو http://192.168.1.10:3000');
  return url.origin;
}
export function getInvitationOrigin(savedOrigin?: string): string {
  if (typeof window === 'undefined') return '';
  try { return normalizeInvitationOrigin(savedOrigin || process.env.NEXT_PUBLIC_APP_URL || window.location.origin); }
  catch { return window.location.origin; }
}
// A portable snapshot of public event details, never guest phones, balances or an access grant.
// The URL fragment stays in the browser and is not sent to the server by HTTP.
export function createInvitationLink(origin: string, occasion: PublicInvitation, code = `MUN-DEMO-${occasion.id}`): string {
  if (/^[A-Za-z0-9_-]{43}$/.test(code)) return `${normalizeInvitationOrigin(origin)}/invite/${code}`;
  const details = publicDetails(occasion);
  if (!details || !/^[A-Za-z0-9_-]{1,140}$/.test(code)) throw new Error('تفاصيل الدعوة أو رمزها غير صالح');
  const snapshot = { v: 1, c: code, o: [details.id, details.title, details.date, details.time || '', details.venueName || '', details.cityNameAr] };
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${normalizeInvitationOrigin(origin)}/invite/${encodeURIComponent(code)}#inv=${encoded}`;
}
export function readInvitationSnapshot(hash: string, code: string): PublicInvitation | null {
  try {
    const encoded = new URLSearchParams(hash.replace(/^#/, '')).get('inv');
    if (!encoded || encoded.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const snapshot = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0))));
    if (snapshot.v !== 1 || snapshot.c !== code || !Array.isArray(snapshot.o) || snapshot.o.length !== 6) return null;
    const [id, title, date, time, venueName, cityNameAr] = snapshot.o;
    if (code.startsWith('MUN-DEMO-') && code.slice('MUN-DEMO-'.length) !== id) return null;
    return publicDetails({ id, title, date, time, venueName, cityNameAr });
  } catch { return null; }
}
export function codeFromScan(value: string): string {
  const input = value.trim();
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const match = url.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/);
    return match ? match[1] : '';
  } catch { return /^[A-Za-z0-9_-]+$/.test(input) ? input : ''; }
}
