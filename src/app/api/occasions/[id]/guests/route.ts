import { prisma } from '@/lib/db';
import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { ownOccasion, guestData, guestDTO, newCode } from '@/lib/server/invitations';
export const POST = api(async (request, { params }) => {
  const user = await requireUser(); await ownOccasion(params.id, user.id);
  const guest = await prisma.guest.create({ data: { ...guestData(await body(request, 10000)), occasionId: params.id, qrCode: newCode(), status: 'invited' } });
  return { guest: guestDTO(guest) };
});
