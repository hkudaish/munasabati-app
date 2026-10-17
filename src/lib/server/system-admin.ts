import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { HttpError, text } from './http';
export const userSelect = { id: true, name: true, phone: true, email: true, role: true, isActive: true, cityId: true, createdAt: true, updatedAt: true, vendorProfile: { select: { id: true, businessName: true, status: true } } } satisfies Prisma.UserSelect;
export function role(value: unknown) {
  if (!['CLIENT','VENDOR','ADMIN','SUPER_ADMIN'].includes(value as string)) throw new HttpError(400, 'الدور غير صالح');
  return value as 'CLIENT'|'VENDOR'|'ADMIN'|'SUPER_ADMIN';
}
export function contact(d: Record<string, any>) {
  const phone = text(d.phone, 20, true); const email = text(d.email, 254).toLowerCase() || null;
  if (!/^\+?\d{9,15}$/.test(phone) || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'رقم الجوال أو البريد غير صالح');
  return { name: text(d.name, 120, true), phone, email };
}
export async function systemMutation<T>(actorId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    // Recheck inside the serializable transaction: revoked system sessions cannot mutate.
    const actor = await tx.user.findFirst({ where: { id: actorId, role: 'SUPER_ADMIN', isActive: true } });
    if (!actor) throw new HttpError(403, 'صلاحية مدير النظام غير متاحة');
    return action(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout:60000, maxWait:5000 });
}
