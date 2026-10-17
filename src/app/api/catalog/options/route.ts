import { prisma } from '@/lib/db';
import { api } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const GET = api(async () => {
  const [subcategories, artists] = await Promise.all([
    prisma.serviceSubcategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
    prisma.catalogArtist.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
  ]);
  return { subcategories, artists };
});
