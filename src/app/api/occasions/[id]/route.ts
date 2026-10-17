import { prisma } from '@/lib/db';
import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { ownOccasion, occasionData, occasionDTO } from '@/lib/server/invitations';
export const PATCH = api(async (request, { params }) => {
  const user = await requireUser(); await ownOccasion(params.id, user.id);
  const occasion = await prisma.occasion.update({ where: { id: params.id, userId: user.id }, data: occasionData(await body(request, 20000), true), include: { city: true } });
  return { occasion: occasionDTO(occasion) };
});
export const DELETE = api(async (_, { params }) => {
  const user = await requireUser(); await ownOccasion(params.id, user.id);
  await prisma.occasion.delete({ where: { id: params.id, userId: user.id } }); return { success: true };
});
