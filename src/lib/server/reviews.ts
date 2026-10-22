import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError, text } from './http';
import { rateLimit } from './auth';
import { featureStates, requireFeature } from './features';

/* Customer reviews with approve-first moderation.
   - A customer can review a service only after the order item is COMPLETED, once per item.
   - A new review is "pending" and invisible to the public until an administrator approves it.
   - A vendor can reply to approved reviews of their own services; the reply is "PENDING" and invisible until approved.
   - An administrator can reply directly (public at once) and can hide, restore, feature or delete reviews.
   - The platform administrator can switch the whole feature off ("reviews" in the feature catalogue): no new reviews or replies,
     already approved reviews stay visible. */

export const COMMENT_MIN = 10, COMMENT_MAX = 2000, REPLY_MIN = 2, REPLY_MAX = 1000;
export const REVIEW_STATUS = ['pending', 'approved', 'hidden'] as const;
const isAdmin = (user: any) => ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

export async function reviewsEnabled() { return !!(await featureStates()).find(f => f.id === 'reviews')?.enabled; }

/** First name and the initial of the next one: private enough for a public page. */
export function displayName(name: string) {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  const initial = Array.from(second)[0];
  return initial ? `${first} ${initial}.` : first || 'عميل';
}
const stars = (value: unknown, fallback?: number) => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) throw new HttpError(400, 'التقييم يجب أن يكون رقماً من 1 إلى 5');
  return value as number;
};
const isoDay = () => new Date().toISOString().slice(0, 10);
const publicShape = (r: any) => ({
  id: r.id, reviewerName: r.reviewerName, rating: r.rating, qualityRating: r.qualityRating, communicationRating: r.communicationRating, timelinessRating: r.timelinessRating, valueRating: r.valueRating,
  commentAr: r.commentAr, date: r.date, featured: r.featured, replyAr: r.replyStatus === 'APPROVED' ? r.replyAr : null,
});

// ---- who owns what -------------------------------------------------------------------------------------------------
async function myServiceIds(user: any): Promise<string[]> {
  const profileId: string | null = user.vendorProfile?.id ?? null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CommerceService" WHERE "ownerId" = ${user.id} OR ("vendorId" IS NOT NULL AND "vendorId" = ${profileId}) OR "body"->'managerIds' @> ${JSON.stringify([user.id])}::jsonb`;
  return rows.map(r => r.id);
}
const mineWhere = async (user: any) => {
  const ids = await myServiceIds(user);
  return { OR: [{ commerceServiceId: { in: ids } }, ...(user.vendorProfile?.id ? [{ vendorId: user.vendorProfile.id }] : [])] };
};

// ---- vendor rating -------------------------------------------------------------------------------------------------
async function refreshVendor(vendorId: string | null | undefined) {
  if (!vendorId) return;
  const agg = await prisma.review.aggregate({ where: { vendorId, status: 'approved' }, _avg: { rating: true }, _count: { _all: true } });
  await prisma.vendor.update({ where: { id: vendorId }, data: { reviewsCount: agg._count._all, ...(agg._count._all ? { rating: Math.round((agg._avg.rating ?? 5) * 10) / 10 } : {}) } }).catch(() => undefined);
}
async function audit(actorId: string, action: string, targetId: string, details: object) { await prisma.systemAuditLog.create({ data: { actorId, action, targetId, details } }); }

// ---- public --------------------------------------------------------------------------------------------------------
export async function publicReviews(filter: { serviceId?: string; vendorId?: string; featured?: boolean; limit?: number }) {
  const where: any = { status: 'approved' };
  if (filter.serviceId) where.OR = [{ commerceServiceId: filter.serviceId }, { serviceId: filter.serviceId }];
  if (filter.vendorId) where.vendorId = filter.vendorId;
  if (filter.featured) where.featured = true;
  const [rows, agg] = await Promise.all([
    prisma.review.findMany({ where, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }], take: Math.min(filter.limit ?? 20, 50) }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  return { reviews: rows.map(publicShape), summary: { count: agg._count._all, average: agg._count._all ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null } };
}
/** Used by the catalogue so a service page carries its approved reviews and approved replies. */
export async function servicePublicReviews(serviceId: string, sourceId?: string | null) {
  const where: any = { status: 'approved', OR: [{ commerceServiceId: serviceId }, ...(sourceId ? [{ serviceId: sourceId }] : [])] };
  const [rows, agg] = await Promise.all([prisma.review.findMany({ where, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }], take: 20 }), prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } })]);
  return { reviews: rows.map(publicShape), summary: { count: agg._count._all, average: agg._count._all ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null } };
}

// ---- customer ------------------------------------------------------------------------------------------------------
export async function customerView(user: any) {
  const [items, reviews, enabled] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT i."id", i."snapshot", o."number", s."id" AS "serviceId", s."body"->>'titleAr' AS "titleAr" FROM "CommerceOrderItem" i JOIN "CommerceOrder" o ON o."id" = i."orderId" JOIN "CommerceService" s ON s."id" = i."serviceId" WHERE o."customerId" = ${user.id} AND i."body"->>'status' = 'COMPLETED' ORDER BY o."createdAt" DESC LIMIT 100`,
    prisma.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    reviewsEnabled(),
  ]);
  const reviewed = new Set(reviews.map(r => r.commerceItemId));
  return {
    enabled,
    reviewable: items.filter(i => !reviewed.has(i.id)).map(i => ({ itemId: i.id, orderNumber: i.number, serviceId: i.serviceId, titleAr: i.titleAr ?? i.snapshot?.titleAr ?? 'خدمة' })),
    reviews: reviews.map(r => ({ ...publicShape(r), itemId: r.commerceItemId, status: r.status, moderationNoteAr: r.status === 'hidden' ? r.moderationNoteAr : null, replyStatus: r.replyStatus, serviceId: r.commerceServiceId })),
  };
}
export async function submitReview(user: any, input: Record<string, any>) {
  await requireFeature('reviews');
  await rateLimit(`review:${user.id}`, 30);
  const itemId = text(input.itemId, 140, true);
  const rows = await prisma.$queryRaw<any[]>`SELECT i."id", i."body", o."customerId", s."id" AS "serviceId", s."sourceId", s."ownerId", s."vendorId" FROM "CommerceOrderItem" i JOIN "CommerceOrder" o ON o."id" = i."orderId" JOIN "CommerceService" s ON s."id" = i."serviceId" WHERE i."id" = ${itemId}`;
  const item = rows[0];
  if (!item || item.customerId !== user.id) throw new HttpError(404, 'العنصر غير موجود');
  if (item.body?.status !== 'COMPLETED') throw new HttpError(409, 'يمكن التقييم بعد اكتمال الخدمة');
  const commentAr = text(input.commentAr, COMMENT_MAX, true);
  if (commentAr.length < COMMENT_MIN) throw new HttpError(400, `اكتب تعليقاً لا يقل عن ${COMMENT_MIN} أحرف`);
  const rating = stars(input.rating);
  const vendorId: string | null = item.vendorId ?? (item.ownerId ? (await prisma.vendor.findFirst({ where: { userId: item.ownerId }, select: { id: true } }))?.id : undefined) ?? null;
  try {
    const review = await prisma.review.create({ data: {
      vendorId, serviceId: item.sourceId ?? null, userId: user.id, commerceItemId: itemId, commerceServiceId: item.serviceId, reviewerName: displayName(user.name), rating,
      qualityRating: stars(input.qualityRating, rating), communicationRating: stars(input.communicationRating, rating), timelinessRating: stars(input.timelinessRating, rating), valueRating: stars(input.valueRating, rating),
      commentAr, date: isoDay(), status: 'pending', featured: false,
    } });
    return { review: { ...publicShape(review), itemId, status: review.status, replyStatus: review.replyStatus } };
  } catch (error: any) {
    if (error?.code === 'P2002') throw new HttpError(409, 'سبق أن قيّمت هذه الخدمة');
    throw error;
  }
}

// ---- vendor --------------------------------------------------------------------------------------------------------
export async function vendorView(user: any) {
  const where = { AND: [await mineWhere(user), { status: 'approved' }] };
  const rows = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  const titles = await serviceTitles(rows.map(r => r.commerceServiceId));
  return {
    enabled: await reviewsEnabled(),
    reviews: rows.map(r => ({ ...publicShape(r), serviceTitleAr: r.commerceServiceId ? titles.get(r.commerceServiceId) ?? null : null, replyStatus: r.replyStatus, replyDraftAr: r.replyStatus === 'PENDING' || r.replyStatus === 'REJECTED' ? r.replyDraftAr : null, replyNoteAr: r.replyStatus === 'REJECTED' ? r.moderationNoteAr : null })),
  };
}
export async function vendorReply(user: any, input: Record<string, any>) {
  await requireFeature('reviews');
  await rateLimit(`review-reply:${user.id}`, 60);
  const review = await prisma.review.findUnique({ where: { id: text(input.reviewId, 140, true) } });
  const mine = review ? await prisma.review.findFirst({ where: { AND: [{ id: review.id }, await mineWhere(user)] }, select: { id: true } }) : null;
  if (!review || !mine) throw new HttpError(404, 'التقييم غير موجود');
  if (review.status !== 'approved') throw new HttpError(409, 'يمكن الرد على التقييمات المعتمدة فقط');
  if (review.replyStatus === 'APPROVED') throw new HttpError(409, 'تم اعتماد ردك؛ لا يمكن تعديله. اطلب من الإدارة إزالته أولاً');
  const replyAr = text(input.replyAr, REPLY_MAX, true);
  if (replyAr.length < REPLY_MIN) throw new HttpError(400, 'الرد قصير جداً');
  await prisma.review.update({ where: { id: review.id }, data: { replyStatus: 'PENDING', replyDraftAr: replyAr, replyById: user.id, replyAt: new Date(), moderationNoteAr: null } });
  return { success: true, replyStatus: 'PENDING' };
}

// ---- administrator -------------------------------------------------------------------------------------------------
async function serviceTitles(ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const rows = await prisma.$queryRaw<any[]>`SELECT "id", "body"->>'titleAr' AS "titleAr" FROM "CommerceService" WHERE "id" = ANY(${unique}::text[])`;
  rows.forEach(r => map.set(r.id, r.titleAr));
  return map;
}
export async function moderationView(filter: string) {
  const where: any = filter === 'pending' ? { status: 'pending' } : filter === 'replies' ? { status: 'approved', replyStatus: 'PENDING' } : filter === 'approved' ? { status: 'approved' } : filter === 'hidden' ? { status: 'hidden' } : {};
  const [rows, pending, replies, approved, hidden, enabled] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { vendor: { select: { businessName: true } } } }),
    prisma.review.count({ where: { status: 'pending' } }), prisma.review.count({ where: { status: 'approved', replyStatus: 'PENDING' } }),
    prisma.review.count({ where: { status: 'approved' } }), prisma.review.count({ where: { status: 'hidden' } }), reviewsEnabled(),
  ]);
  const titles = await serviceTitles(rows.map(r => r.commerceServiceId));
  return {
    enabled, counts: { pending, replies, approved, hidden },
    reviews: rows.map(r => ({ id: r.id, reviewerName: r.reviewerName, rating: r.rating, qualityRating: r.qualityRating, communicationRating: r.communicationRating, timelinessRating: r.timelinessRating, valueRating: r.valueRating, commentAr: r.commentAr, date: r.date, status: r.status, featured: r.featured, vendorName: r.vendor?.businessName ?? null, serviceTitleAr: r.commerceServiceId ? titles.get(r.commerceServiceId) ?? null : null, replyStatus: r.replyStatus, replyAr: r.replyAr, replyDraftAr: r.replyDraftAr, moderationNoteAr: r.moderationNoteAr, moderatedAt: r.moderatedAt })),
  };
}
export async function moderate(admin: any, input: Record<string, any>) {
  const id = text(input.id, 140, true), action = text(input.action, 40, true);
  const note = text(input.noteAr, 500), replyAr = text(input.replyAr, REPLY_MAX);
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new HttpError(404, 'التقييم غير موجود');
  const stamp = { moderatedById: admin.id, moderatedAt: new Date() };
  const needNote = () => { if (!note) throw new HttpError(400, 'اكتب سبب الإجراء'); };
  let data: any = null, remove = false;
  switch (action) {
    case 'APPROVE': if (review.status === 'approved') throw new HttpError(409, 'التقييم معتمد مسبقاً'); data = { status: 'approved', moderationNoteAr: null, ...stamp }; break;
    case 'HIDE': needNote(); data = { status: 'hidden', featured: false, moderationNoteAr: note, ...stamp }; break;
    case 'FEATURE': if (review.status !== 'approved') throw new HttpError(409, 'يمكن تمييز التقييمات المعتمدة فقط'); data = { featured: true }; break;
    case 'UNFEATURE': data = { featured: false }; break;
    case 'DELETE': needNote(); remove = true; break;
    case 'APPROVE_REPLY': if (review.replyStatus !== 'PENDING' || !review.replyDraftAr) throw new HttpError(409, 'لا يوجد رد بانتظار الاعتماد'); data = { replyAr: review.replyDraftAr, replyStatus: 'APPROVED', replyDraftAr: null, replyAt: new Date(), moderationNoteAr: null }; break;
    case 'REJECT_REPLY': if (review.replyStatus !== 'PENDING') throw new HttpError(409, 'لا يوجد رد بانتظار الاعتماد'); needNote(); data = { replyStatus: 'REJECTED', moderationNoteAr: note }; break;
    case 'ADMIN_REPLY': if (review.status !== 'approved') throw new HttpError(409, 'اعتمد التقييم قبل الرد عليه'); if (replyAr.length < REPLY_MIN) throw new HttpError(400, 'اكتب الرد'); data = { replyAr, replyStatus: 'APPROVED', replyDraftAr: null, replyById: admin.id, replyAt: new Date() }; break;
    case 'REMOVE_REPLY': needNote(); data = { replyAr: null, replyDraftAr: null, replyStatus: 'NONE', moderationNoteAr: null }; break;
    default: throw new HttpError(400, 'إجراء غير صالح');
  }
  if (remove) await prisma.review.delete({ where: { id } }); else await prisma.review.update({ where: { id }, data });
  await audit(admin.id, 'REVIEW_' + action, id, { noteAr: note || undefined, before: { status: review.status, replyStatus: review.replyStatus, featured: review.featured } });
  if (['APPROVE', 'HIDE', 'DELETE'].includes(action)) await refreshVendor(review.vendorId);
  return { success: true };
}
export { isAdmin };
