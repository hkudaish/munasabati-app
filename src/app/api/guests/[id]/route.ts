import { prisma } from '@/lib/db';
import { api, body, HttpError, text } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { guestDTO, newCode } from '@/lib/server/invitations';
async function owned(id: string) {
  const user = await requireUser(); const guest = await prisma.guest.findFirst({ where: { id, occasion: { userId: user.id } } });
  if (!guest) throw new HttpError(404, 'الضيف غير موجود'); return guest;
}
export const PATCH = api(async (request, { params }) => {
  const g = await owned(params.id); const d = await body(request, 4096); const update: Record<string, any> = {};
  if (d.status !== undefined) {
    if (!['invited','viewed','confirmed','declined','maybe','attended','absent'].includes(d.status)) throw new HttpError(400, 'الحالة غير صالحة');
    if (d.status === 'attended') {
      const changed = await prisma.guest.updateMany({ where: { id: g.id, status: { not: 'attended' }, revokedAt: null }, data: { status: 'attended' } });
      if (!changed.count) throw new HttpError(409, 'تم الدخول مسبقاً أو الدعوة ملغاة');
      return { guest: guestDTO(await prisma.guest.findUniqueOrThrow({ where: { id: g.id } })) };
    }
    update.status = d.status;
  }
  if (d.tableId !== undefined) { update.tableId = text(d.tableId, 100); update.tableName = text(d.tableName, 100); }
  if (d.revoke === true) update.revokedAt = new Date();
  if (d.rotate === true) { update.qrCode = newCode(); update.revokedAt = null; }
  const guest = await prisma.guest.update({ where: { id: g.id }, data: update }); return { guest: guestDTO(guest) };
});
export const DELETE = api(async (_, { params }) => { const guest = await owned(params.id); await prisma.guest.delete({ where: { id: guest.id } }); return { success: true }; });
