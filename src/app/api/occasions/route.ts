import { validateSelections } from '@/lib/server/catalog';
import { requireGeo } from '@/lib/server/geo/context';
import { prisma } from '@/lib/db';
import { api, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { newCode, occasionData, occasionDTO, guestDTO } from '@/lib/server/invitations';
export const dynamic = 'force-dynamic';
export const GET = api(async () => {
  const user = await requireUser();
  const occasions = await prisma.occasion.findMany({ where: { userId: user.id }, include: { city: true, guests: true }, orderBy: { createdAt: 'desc' } });
  return { occasions: occasions.map(occasionDTO), guests: occasions.flatMap(o => o.guests.map(guestDTO)) };
});
export const POST = api(async request => {
  const user = await requireUser(); const d = occasionData(await body(request, 20000));
  await requireGeo('feature:planning',d.cityId);
  if (d.serviceSelections) await validateSelections(d.serviceSelections);
  const occasion = await prisma.occasion.create({ data: { ...d, userId: user.id, shareCode: newCode() } as any, include: { city: true } });
  return { occasion: occasionDTO(occasion) };
});
