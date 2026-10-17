import { prisma } from '@/lib/db';
import { api, body, text, HttpError } from '@/lib/server/http';
import { createSession, profile, rateLimit, verifyPassword } from '@/lib/server/auth';
export const POST = api(async request => {
  const data = await body(request, 4096); const identifier = text(data.identifier, 254, true).toLowerCase();
  await rateLimit(`login:${identifier}`, 10);
  const user = await prisma.user.findFirst({ where: { OR: [{ phone: identifier }, { email: identifier }] }, include: { vendorProfile: true } });
  if (!await verifyPassword(data.password, user?.passwordHash || null) || !user || !user.isActive) throw new HttpError(401, 'بيانات الدخول غير صحيحة؛ الحسابات القديمة تحتاج تهيئة كلمة مرور من مسؤول النظام');
  await createSession(user.id);
  return { success: true, user: profile(user) };
});
