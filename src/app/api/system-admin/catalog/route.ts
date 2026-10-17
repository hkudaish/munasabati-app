import { assertNotPreview } from '@/lib/server/geo/context';
import { prisma } from '@/lib/db';
import { api, body, text, integer, HttpError } from '@/lib/server/http';
import { requireSystemAdmin } from '@/lib/server/auth';
import { systemMutation } from '@/lib/server/system-admin';
export const GET = api(async () => {
  await requireSystemAdmin();
  const [categories, subcategories, artists] = await Promise.all([prisma.serviceCategory.findMany({ orderBy: { sortOrder: 'asc' } }), prisma.serviceSubcategory.findMany({ orderBy: { sortOrder: 'asc' } }), prisma.catalogArtist.findMany({ orderBy: { sortOrder: 'asc' } })]);
  return { categories, subcategories, artists };
});
export const POST = api(async request => {
  await assertNotPreview(request);
  const user = await requireSystemAdmin(); const d = await body(request, 12000);
  const id = text(d.id, 100, true), nameAr = text(d.nameAr, 160, true), sortOrder = integer(d.sortOrder, 10000);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new HttpError(400, 'معرف التصنيف غير صالح');
  await systemMutation(user.id, async tx => {
    if (d.entity === 'artist') {
      if (!['male','female'].includes(d.kind) || typeof d.enabled !== 'boolean') throw new HttpError(400, 'بيانات الفنان غير صالحة');
      const previous = await tx.catalogArtist.findUnique({ where: { id } });
      if (previous && previous.kind !== d.kind && await tx.serviceItem.count({ where: { artistId: id } })) throw new HttpError(409, 'الفنان مرتبط بخدمات؛ لا يمكن نقله إلى قائمة أخرى');
      const data = { nameAr, kind: d.kind, enabled: d.enabled, sortOrder };
      await tx.catalogArtist.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else if (d.entity === 'subcategory') {
      if (!['standard','performer','audio'].includes(d.kind) || ![null,'male','female','any'].includes(d.artistKind) || typeof d.isActive !== 'boolean') throw new HttpError(400, 'بيانات التصنيف الفرعي غير صالحة');
      if (d.kind === 'performer' && !d.artistKind) throw new HttpError(400, 'حدد قائمة الفنانين لهذا النوع من الخدمات');
      const categoryId = text(d.categoryId, 100, true);
      const previous = await tx.serviceSubcategory.findUnique({ where: { id } });
      if (previous && (previous.categoryId !== categoryId || previous.kind !== d.kind || previous.artistKind !== d.artistKind) && await tx.serviceItem.count({ where: { subcategoryId: id } })) throw new HttpError(409, 'لا يمكن نقل تصنيف مرتبط بخدمات إلى قسم آخر');
      const data = { nameAr, categoryId, kind: d.kind, artistKind: d.artistKind, isActive: d.isActive, sortOrder };
      await tx.serviceSubcategory.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else throw new HttpError(400, 'نوع السجل غير صالح');
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'CATALOG_UPDATED', targetId: id, details: { entity: d.entity, nameAr } } });
  });
  return { success: true };
});
