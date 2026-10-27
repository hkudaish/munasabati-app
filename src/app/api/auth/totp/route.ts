import QRCode from 'qrcode';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { digest, rateLimit, requireUser, verifyPassword } from '@/lib/server/auth';
import { checkSecondFactor, completeEnrolment, disableTotp, startEnrolment, totpAvailable, totpEnabled } from '@/lib/server/totp';
export const dynamic = 'force-dynamic';
export const GET = api(async () => {
  const user = await requireUser();
  return { available: totpAvailable(), enabled: await totpEnabled(user.id) };
});
// One endpoint, three steps: setup (shows the secret and QR), enable (the first code turns it on and returns recovery codes once), disable (password and a code).
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('totp:' + user.id, 30);
  const d = await body(request, 2000);
  if (d.action === 'setup') {
    if (!totpAvailable()) throw new HttpError(503, 'التحقق بخطوتين غير مهيأ على الخادم بعد');
    if (await totpEnabled(user.id)) throw new HttpError(409, 'التحقق بخطوتين مفعّل بالفعل');
    const secret = await startEnrolment(user.id), uri = `otpauth://totp/${encodeURIComponent('مناسبتي:' + (user.email || user.phone))}?secret=${secret}&issuer=${encodeURIComponent('مناسبتي')}&algorithm=SHA1&digits=6&period=30`;
    return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }
  if (d.action === 'enable') {
    const recoveryCodes = await completeEnrolment(user.id, d.code);
    // A new factor ends every other sign-in of this account, in case the password was already known to someone else.
    const token = (await cookies()).get('munasabati_session')?.value;
    await prisma.authSession.deleteMany({ where: { userId: user.id, ...(token ? { tokenHash: { not: digest(token) } } : {}) } });
    return { enabled: true, recoveryCodes };
  }
  if (d.action === 'disable') {
    const full = await prisma.user.findUnique({ where: { id: user.id } });
    if (!await verifyPassword(d.password, full?.passwordHash || null)) throw new HttpError(401, 'كلمة المرور غير صحيحة');
    if (!await checkSecondFactor(user.id, d.code)) throw new HttpError(401, 'رمز التحقق غير صحيح');
    await disableTotp(user.id); return { enabled: false };
  }
  throw new HttpError(400, 'إجراء غير معروف');
});
