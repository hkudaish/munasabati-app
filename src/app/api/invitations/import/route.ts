import { prisma } from '@/lib/db';
import { api, body, text, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { newCode, occasionData, guestData } from '@/lib/server/invitations';
export const POST = api(async request => {
  const user = await requireUser(); const d = await body(request);
  if (d.confirmOwnership !== true || !d.occasion || !Array.isArray(d.guests) || d.guests.length > 1000) throw new HttpError(400, 'أكد ملكية البيانات؛ الحد الأقصى 1000 ضيف في الاستيراد');
  const legacyId = text(d.occasion.id, 100, true);
  // Deterministic per-owner ID makes retries safe without assigning another user's old ID.
  const { createHash } = await import('node:crypto');
  const id = 'import-' + createHash('sha256').update(`${user.id}:${legacyId}`).digest('hex');
  const occasion = occasionData(d.occasion);
  const guests = d.guests.filter((g: any) => g.occasionId === legacyId).map((g: any) => ({ ...guestData(g), occasionId: id, qrCode: newCode(), status: ['confirmed','declined','maybe','attended','absent','viewed'].includes(g.status) ? g.status as string : 'invited' }));
  const existing = await prisma.occasion.findFirst({ where: { id, userId: user.id } });
  if (existing) return { occasionId: id, alreadyImported: true };
  await prisma.$transaction(async tx => {
    await tx.occasion.create({ data: { ...occasion, id, userId: user.id, shareCode: newCode() } as any });
    if (guests.length) await tx.guest.createMany({ data: guests });
  });
  return { occasionId: id, guestCount: guests.length };
});
