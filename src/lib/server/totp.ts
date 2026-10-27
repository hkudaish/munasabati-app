import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', STEP = 30, DIGITS = 6;
const keyHex = () => process.env.AUTH_ENCRYPTION_KEY || '';
/** Authenticator enrolment needs a server key to protect the stored secrets; without it nobody can enrol, and nobody is asked for a code. */
export const totpAvailable = () => /^[a-fA-F0-9]{64}$/.test(keyHex());
function seal(secret: string, userId: string) {
  if (!totpAvailable()) throw new HttpError(503, 'التحقق بخطوتين غير مهيأ على الخادم بعد');
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', Buffer.from(keyHex(), 'hex'), iv); c.setAAD(Buffer.from('totp:' + userId));
  const data = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return ['v1', iv.toString('hex'), c.getAuthTag().toString('hex'), data.toString('hex')].join(':');
}
function unseal(sealed: string, userId: string) {
  const [v, iv, tag, data] = sealed.split(':'); if (v !== 'v1') throw new HttpError(503, 'تعذر قراءة إعدادات التحقق بخطوتين');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyHex(), 'hex'), Buffer.from(iv, 'hex')); d.setAAD(Buffer.from('totp:' + userId)); d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
}
export function base32(buf: Buffer) { let bits = 0, value = 0, out = ''; for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(value << (5 - bits)) & 31]; return out; }
export function fromBase32(text: string) { let bits = 0, value = 0; const out: number[] = []; for (const ch of text.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
/** RFC 6238 (HMAC-SHA1, 30 s, 6 digits), the profile every authenticator app supports. */
export function totpAt(secretB32: string, step: number) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', fromBase32(secretB32)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 10 ** DIGITS)).padStart(DIGITS, '0');
}
/** The step a code belongs to (this one or a neighbour, for clock drift), or null. */
export function matchStep(secretB32: string, code: string, now = Date.now()) {
  const current = Math.floor(now / 1000 / STEP), given = Buffer.from(code);
  for (const step of [current, current - 1, current + 1]) { const want = Buffer.from(totpAt(secretB32, step)); if (want.length === given.length && timingSafeEqual(want, given)) return step; }
  return null;
}
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');
const normalize = (raw: unknown) => typeof raw === 'string' ? raw.replace(/[\s-]/g, '').toLowerCase() : '';
export function newRecoveryCodes() { return Array.from({ length: 10 }, () => { const h = randomBytes(5).toString('hex'); return h.slice(0, 5) + '-' + h.slice(5); }); }
type Row = { secret: string; enabledAt: Date | null; lastStep: bigint; recoveryHashes: string[] };
export async function totpRow(userId: string): Promise<Row | null> { return (await prisma.$queryRaw<Row[]>`SELECT "secret","enabledAt","lastStep","recoveryHashes" FROM "UserTotp" WHERE "userId"=${userId}`)[0] ?? null; }
export async function totpEnabled(userId: string) { if (!totpAvailable()) return false; return !!(await totpRow(userId))?.enabledAt; }
export async function startEnrolment(userId: string) {
  const secret = base32(randomBytes(20)), sealed = seal(secret, userId);
  await prisma.$executeRaw`INSERT INTO "UserTotp" ("userId","secret") VALUES (${userId},${sealed}) ON CONFLICT ("userId") DO UPDATE SET "secret"=${sealed},"lastStep"=0,"recoveryHashes"='{}' WHERE "UserTotp"."enabledAt" IS NULL`;
  return secret;
}
/** Confirms the first code and turns the factor on; returns the one-time recovery codes. */
export async function completeEnrolment(userId: string, code: unknown) {
  const row = await totpRow(userId); if (!row || row.enabledAt) throw new HttpError(409, 'ابدأ الإعداد من جديد');
  const step = matchStep(unseal(row.secret, userId), normalize(code)); if (step === null) throw new HttpError(400, 'الرمز غير صحيح. تأكد من الوقت على هاتفك وأدخل الرمز الحالي');
  const codes = newRecoveryCodes();
  await prisma.$executeRaw`UPDATE "UserTotp" SET "enabledAt"=now(),"lastStep"=${step},"recoveryHashes"=${codes.map(c => hashCode(c.replace('-', '')))} WHERE "userId"=${userId} AND "enabledAt" IS NULL`;
  return codes;
}
/** An authenticator code (each code works once) or an unused recovery code. */
export async function checkSecondFactor(userId: string, raw: unknown) {
  const code = normalize(raw), row = await totpRow(userId); if (!row?.enabledAt || !code) return false;
  if (/^\d{6}$/.test(code)) {
    const step = matchStep(unseal(row.secret, userId), code); if (step === null) return false;
    return (await prisma.$executeRaw`UPDATE "UserTotp" SET "lastStep"=${step} WHERE "userId"=${userId} AND "lastStep"<${step}`) === 1;
  }
  if (!/^[0-9a-f]{10}$/.test(code)) return false;
  return (await prisma.$executeRaw`UPDATE "UserTotp" SET "recoveryHashes"=array_remove("recoveryHashes",${hashCode(code)}) WHERE "userId"=${userId} AND ${hashCode(code)}=ANY("recoveryHashes")`) === 1;
}
export async function disableTotp(userId: string) { await prisma.$executeRaw`DELETE FROM "UserTotp" WHERE "userId"=${userId}`; }
