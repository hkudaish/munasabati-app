import 'server-only';
import { prisma } from '@/lib/db';
import { requireAdmin } from './auth';
import { HttpError, text } from './http';

/** A vendor's rating counts only reviews an administrator approved; a vendor with none is "not rated yet", never a default 5.0. */
const PRIOR_MEAN = 4.0, PRIOR_WEIGHT = 3;
export const score = (average: number | null, count: number) => (count * (average ?? 0) + PRIOR_WEIGHT * PRIOR_MEAN) / (count + PRIOR_WEIGHT);

/**
 * Who stands out for a service and an area, for administrators and coordinators. Ranked by a damped average of approved reviews
 * (a single 5-star review does not beat fifty 4.8s), then by completed bookings.
 */
export async function vendorInsights(params: URLSearchParams) {
  await requireAdmin();
  const categoryId = params.get('categoryId') ? text(params.get('categoryId'), 100) : null, cityId = params.get('cityId') ? text(params.get('cityId'), 100) : null, q = params.get('q') ? text(params.get('q'), 80) : null;
  const limit = Math.min(20, Math.max(1, Number(params.get('limit')) || 8));
  if (params.get('limit') && !Number.isInteger(Number(params.get('limit')))) throw new HttpError(400, 'قيمة رقمية غير صالحة');
  const rows = await prisma.$queryRaw<any[]>`
    SELECT v."id", v."businessName", v."categoryId", c."nameAr" AS "categoryAr", v."cityId", ci."nameAr" AS "cityAr", v."serviceAreas", v."verified", v."featured", v."responseTimeMinutes", v."contactPhone",
      r."average", COALESCE(r."count",0)::int AS "reviews", COALESCE(o."done",0)::int AS "completed", COALESCE(s."services",0)::int AS "services"
    FROM "Vendor" v
    JOIN "ServiceCategory" c ON c."id"=v."categoryId" JOIN "SaudiCity" ci ON ci."id"=v."cityId"
    LEFT JOIN (SELECT "vendorId", AVG("rating")::float AS "average", COUNT(*) AS "count" FROM "Review" WHERE "status"='approved' AND "vendorId" IS NOT NULL GROUP BY "vendorId") r ON r."vendorId"=v."id"
    LEFT JOIN (SELECT s."vendorId", COUNT(*) AS "done" FROM "CommerceOrderItem" i JOIN "CommerceService" s ON s."id"=i."serviceId" WHERE i."body"->>'status' IN ('COMPLETED','CLOSED') GROUP BY s."vendorId") o ON o."vendorId"=v."id"
    LEFT JOIN (SELECT "vendorId", COUNT(*) AS "services" FROM "CommerceService" WHERE "body"->>'published'='true' AND "body"->>'approved'='true' GROUP BY "vendorId") s ON s."vendorId"=v."id"
    WHERE v."status"='ACTIVE'
      AND (${categoryId}::text IS NULL OR v."categoryId"=${categoryId})
      AND (${cityId}::text IS NULL OR v."cityId"=${cityId} OR ${cityId} = ANY(v."serviceAreas") OR EXISTS (SELECT 1 FROM "CommerceService" cs WHERE cs."vendorId"=v."id" AND cs."body"->'cities' ? ${cityId}))
      AND (${q}::text IS NULL OR v."businessName" ILIKE '%' || ${q} || '%')
    LIMIT 200`;
  const ranked = rows.map(v => ({ ...v, score: score(v.average, v.reviews) }))
    .sort((a, b) => b.score - a.score || b.completed - a.completed || a.businessName.localeCompare(b.businessName, 'ar'))
    .slice(0, limit)
    .map(({ score: s, average, ...v }) => ({ ...v, rating: average === null ? null : Number(average.toFixed(2)), score: Number(s.toFixed(3)), rated: v.reviews > 0 }));
  const [category, city] = await Promise.all([
    categoryId ? prisma.serviceCategory.findUnique({ where: { id: categoryId }, select: { nameAr: true } }) : null,
    cityId ? prisma.saudiCity.findUnique({ where: { id: cityId }, select: { nameAr: true } }) : null,
  ]);
  return { vendors: ranked, total: rows.length, categoryAr: category?.nameAr ?? null, cityAr: city?.nameAr ?? null, method: 'متوسط التقييمات المعتمدة بعد تخفيف أثر العدد القليل، ثم عدد الحجوزات المكتملة' };
}
