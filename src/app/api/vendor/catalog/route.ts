import { registerLegacyService } from '@/lib/server/commerce-v2/catalog';
import { prisma } from '@/lib/db';
import { api, body, HttpError, text } from '@/lib/server/http';
import { ownVendor, mediaUrl, mediaUrls, serviceData } from '@/lib/server/catalog';
import { assertNotPreview } from '@/lib/server/geo/context';
import { requireFeature } from '@/lib/server/features';
import { rateLimit } from '@/lib/server/auth';
export const GET = api(async () => {
  const { vendor } = await ownVendor();
  return { vendor, services: await prisma.serviceItem.findMany({ where: { vendorId: vendor.id }, include: { subcategory: true, artist: true }, orderBy: { createdAt: 'desc' } }) };
});
export const POST = api(async request => {
  await assertNotPreview(request); await requireFeature('vendor_portal');
  const { user, vendor } = await ownVendor(); await rateLimit(`vendor-catalog:${user.id}`, 100);
  const input = await body(request, 40000);
  if (input.action === 'media') {
    const data = { portfolio: mediaUrls(input.images), videoUrls: mediaUrls(input.videoUrls), libraryUrl: mediaUrl(input.libraryUrl) };
    await prisma.$transaction(async tx => {
      await tx.vendor.update({ where: { id: vendor.id }, data });
      await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'VENDOR_MEDIA_UPDATED', targetId: vendor.id } });
    });
    return { success: true };
  }
  const id = text(input.id, 100);
  if (input.action === 'unpublish') {
    await prisma.$transaction(async tx => {
      const result = await tx.serviceItem.updateMany({ where: { id, vendorId: vendor.id }, data: { isPublished: false } });
      if (!result.count) throw new HttpError(404, 'الخدمة غير موجودة');
      await tx.$executeRaw`UPDATE "CommerceService" SET "body"=jsonb_set("body",'{published}','false'::jsonb),"version"="version"+1 WHERE "id"=${id}`;
      await tx.systemAuditLog.create({ data: { actorId: user.id, action: 'SERVICE_UNPUBLISHED', targetId: id } });
    });
    return { success: true };
  }
  const data = await serviceData(input, vendor);
  const service = await prisma.$transaction(async tx => {
    let saved;
    if (id) {
      const result = await tx.serviceItem.updateMany({ where: { id, vendorId: vendor.id }, data });
      if (!result.count) throw new HttpError(404, 'الخدمة غير موجودة');
      saved = await tx.serviceItem.findUniqueOrThrow({ where: { id } });
    } else saved = await tx.serviceItem.create({ data: { ...data, vendorId: vendor.id } });
    await tx.systemAuditLog.create({ data: { actorId: user.id, action: id ? 'SERVICE_UPDATED' : 'SERVICE_CREATED', targetId: saved.id } });
    await registerLegacyService(tx,saved,vendor);
    return saved;
  });
  return { success: true, service };
});
