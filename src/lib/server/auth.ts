import 'server-only';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
const scrypt = promisify(scryptCallback);
const COOKIE = 'munasabati_session';
export async function hashPassword(password: string) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'استخدم كلمة مرور من 12 إلى 128 حرفاً');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string | null) {
  // Run the same expensive operation for unknown/legacy accounts.
  const [, salt, expected] = (hash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const actual = await scrypt(typeof password === 'string' && password.length <= 128 ? password : '', salt, 64) as Buffer;
  const target = Buffer.from(expected, 'hex');
  return !!hash && actual.length === target.length && timingSafeEqual(actual, target);
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 7 * 86400000);
  await prisma.authSession.create({ data: { tokenHash: digest(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
}
export async function sessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { vendorProfile: true } } } });
  return session && session.user.isActive && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() { const user = await sessionUser(); if (!user) throw new HttpError(401, 'يرجى تسجيل الدخول'); return user; }
export async function logout() { const token = (await cookies()).get(COOKIE)?.value; if (token) await prisma.authSession.deleteMany({ where: { tokenHash: digest(token) } }); (await cookies()).delete(COOKIE); }
export function profile(user: any) {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email, cityId: user.cityId, createdAt: user.createdAt, avatar: user.avatar, role: ['ADMIN','SUPER_ADMIN'].includes(user.role) ? 'admin' : user.role === 'VENDOR' ? 'vendor' : 'client', hasSystemAccess: user.role === 'SUPER_ADMIN', hasAdminAccess: ['ADMIN','SUPER_ADMIN'].includes(user.role), vendorId: user.vendorProfile?.id, businessName: user.vendorProfile?.businessName };
}
/** The visitor's address as the host reports it: Netlify's own header cannot be set by the client, the forwarded list is the fallback. */
export function clientIp(request: Request) { return request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'; }
export async function rateLimit(key: string, limit = 20, windowMs = 900000) {
  const hashed = digest(key); const now = new Date();
  await prisma.authAttempt.deleteMany({ where: { key: hashed, expiresAt: { lte: now } } });
  const attempt = await prisma.authAttempt.upsert({ where: { key: hashed }, create: { key: hashed, expiresAt: new Date(Date.now() + windowMs) }, update: { count: { increment: 1 } } });
  if (attempt.count > limit) throw new HttpError(429, 'طلبات كثيرة؛ حاول بعد قليل');
}

export async function requireSystemAdmin() { const user = await requireUser(); if (user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'هذه الصلاحية مخصصة لمدير النظام'); return user; }
export async function requireAdmin() { const user = await requireUser(); if (!['ADMIN','SUPER_ADMIN'].includes(user.role)) throw new HttpError(403, 'هذه الصلاحية مخصصة للإدارة'); return user; }
