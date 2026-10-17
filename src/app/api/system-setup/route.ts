import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { createSession, digest, hashPassword, profile, rateLimit } from '@/lib/server/auth';
import { contact } from '@/lib/server/system-admin';
export const POST = api(async request => {
  const d = await body(request,4096);
  if (typeof d.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(d.token)) throw new HttpError(410, 'رابط التفعيل غير صالح أو منتهي');
  const tokenHash = digest(d.token);
  const invitation = await prisma.systemSetupToken.findFirst({ where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } } });
  if (!invitation) throw new HttpError(410, 'رابط التفعيل غير صالح أو منتهي أو مستخدم مسبقاً');
  if (d.action === 'inspect') return { email: invitation.email };
  if (d.action !== 'activate') throw new HttpError(400, 'طلب غير صالح');
  await rateLimit(`system-setup:${tokenHash}`,10);
  const passwordHash = await hashPassword(d.password); const data = contact({ ...d, email: invitation.email });
  const user = await prisma.$transaction(async tx => {
    const claimed = await tx.systemSetupToken.updateMany({ where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (!claimed.count) throw new HttpError(410, 'الرابط مستخدم مسبقاً أو منتهي');
    // Creating a new account prevents a setup link from resetting an existing user's password.
    const created = await tx.user.create({ data: { ...data, passwordHash, role: 'SUPER_ADMIN', isActive: true } });
    await tx.systemAuditLog.create({ data: { actorId: 'LOCAL_OPERATOR_INVITATION', action: 'SYSTEM_ADMIN_PROVISIONED', targetId: created.id } });
    return created;
  });
  await createSession(user.id);
  return { success: true, user: profile(user) };
});
