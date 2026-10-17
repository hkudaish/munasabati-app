import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError, integer, text } from './http';
import { requireUser } from './auth';
import type { ServiceSelection } from '@/lib/catalog/types';

export async function ownVendor() {
  const user = await requireUser();
  if (user.role !== 'VENDOR' || !user.vendorProfile) throw new HttpError(403, 'هذه الوظيفة خاصة بحساب المورد');
  if (user.vendorProfile.status === 'SUSPENDED') throw new HttpError(403, 'حساب المورد موقوف');
  return { user, vendor: user.vendorProfile };
}
export function mediaUrl(value: unknown) {
  const raw = text(value, 2000);
  if (!raw) return null;
  let url: URL; try { url = new URL(raw); } catch { throw new HttpError(400, 'رابط الوسائط غير صالح'); }
  if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|\[?::1)/i.test(url.hostname)) throw new HttpError(400, 'استخدم رابط HTTPS عاماً دون بيانات دخول');
  return url.toString();
}
export function mediaUrls(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, 'الحد الأقصى 20 رابطاً');
  return value.map(mediaUrl).filter((u): u is string => !!u);
}
export function parseSelections(value: unknown): ServiceSelection[] {
  if (!Array.isArray(value) || value.length > 50) throw new HttpError(400, 'اختيارات الخدمات غير صالحة');
  const seen = new Set();
  return value.map(row => {
    if (!row || typeof row !== 'object') throw new HttpError(400, 'اختيار الخدمة غير صالح');
    const categoryId = text(row.categoryId, 100, true);
    if (seen.has(categoryId)) throw new HttpError(400, 'تصنيف مكرر'); seen.add(categoryId);
    const ids = (v: unknown) => { if (!Array.isArray(v) || v.length > 40) throw new HttpError(400, 'قائمة الاختيارات غير صالحة'); return Array.from(new Set(v.map(i => text(i, 100, true)))); };
    return { categoryId, subcategoryIds: ids(row.subcategoryIds || []), artistIds: ids(row.artistIds || []) };
  });
}
export async function validateSelections(selections: ServiceSelection[]) {
  for (const row of selections) {
    if (!await prisma.serviceCategory.findUnique({ where: { id: row.categoryId } })) throw new HttpError(400, 'التصنيف غير موجود');
    const subcategories = await prisma.serviceSubcategory.findMany({ where: { id: { in: row.subcategoryIds }, categoryId: row.categoryId, isActive: true } });
    if (subcategories.length !== row.subcategoryIds.length) throw new HttpError(400, 'تصنيف فرعي غير متاح أو لا يتبع القسم');
    const artists = await prisma.catalogArtist.findMany({ where: { id: { in: row.artistIds }, enabled: true } });
    if (artists.length !== row.artistIds.length || artists.some(a => !subcategories.some(s => s.artistKind === 'any' || s.artistKind === a.kind))) throw new HttpError(400, 'اختر الفنان من التصنيف الفرعي المناسب');
  }
}
export async function serviceData(input: Record<string, any>, vendor: any) {
  const categoryId = text(input.categoryId, 100, true), subcategoryId = text(input.subcategoryId, 100), artistId = text(input.artistId, 100);
  if (!await prisma.serviceCategory.findUnique({ where: { id: categoryId } })) throw new HttpError(400, 'التصنيف غير موجود');
  const subcategory = subcategoryId ? await prisma.serviceSubcategory.findFirst({ where: { id: subcategoryId, categoryId, isActive: true } }) : null;
  if (subcategoryId && !subcategory) throw new HttpError(400, 'التصنيف الفرعي لا يتبع القسم المحدد');
  const artist = artistId ? await prisma.catalogArtist.findFirst({ where: { id: artistId, enabled: true } }) : null;
  if (artistId && (!artist || !subcategory?.artistKind || !['any', artist.kind].includes(subcategory.artistKind))) throw new HttpError(400, 'الفنان لا يطابق التصنيف الفرعي');
  if (subcategory?.kind === 'performer' && !artist) throw new HttpError(400, 'حدد الفنان مقدم الخدمة');
  if (typeof input.isPublished !== 'boolean' || typeof input.rightsConfirmed !== 'boolean') throw new HttpError(400, 'إعدادات النشر غير صالحة');
  if (input.isPublished && vendor.status !== 'ACTIVE') throw new HttpError(403, 'يلزم اعتماد المتجر قبل نشر الخدمات');
  const previewAudioUrl = mediaUrl(input.previewAudioUrl);
  if ((previewAudioUrl || subcategory?.kind === 'performer') && !input.rightsConfirmed) throw new HttpError(400, 'أكد حقك في نشر العينة أو تقديم خدمة الفنان');
  const priceType = text(input.priceType || 'FIXED', 30).toUpperCase();
  if (!['FIXED','PER_PERSON','STARTING_AT'].includes(priceType)) throw new HttpError(400, 'نوع السعر غير صالح');
  const cityId = text(input.cityId || vendor.cityId, 100, true);
  if (cityId !== vendor.cityId && !vendor.serviceAreas.includes(cityId)) throw new HttpError(400, 'المدينة خارج نطاق متجرك');
  return { titleAr: text(input.titleAr, 200, true), descriptionAr: text(input.descriptionAr, 8000, true), categoryId, subcategoryId: subcategoryId || null, artistId: artistId || null,
    cityId, price: integer(input.price, 100000000), priceType: priceType as any, images: mediaUrls(input.images), videoUrls: mediaUrls(input.videoUrls), previewAudioUrl,
    featuresAr: Array.isArray(input.featuresAr) && input.featuresAr.length <= 30 ? input.featuresAr.map((f: unknown) => text(f, 300, true)) : [],
    executionDurationHours: Math.max(1, integer(input.executionDurationHours, 168, 4)), isPublished: input.isPublished, rightsConfirmed: input.rightsConfirmed, instantBooking: false };
}

export const publicServiceWhere = {
  isPublished: true,
  vendor: { status: 'ACTIVE' as const, OR: [{ userId: null }, { user: { isActive: true } }] },
  AND: [ { OR: [{ subcategoryId: null }, { subcategory: { isActive: true } }] }, { OR: [{ artistId: null }, { artist: { enabled: true } }] } ],
};
