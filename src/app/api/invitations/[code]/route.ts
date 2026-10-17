import { prisma } from '@/lib/db';
import { api, body, HttpError, integer, text } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/auth';
async function lookup(code: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new HttpError(404, 'الدعوة غير متاحة');
  const guest = await prisma.guest.findUnique({ where: { qrCode: code }, include: { occasion: { include: { city: true } } } });
  if (guest?.revokedAt) throw new HttpError(410, 'ألغى المنظم هذه الدعوة');
  const occasion = guest?.occasion || await prisma.occasion.findUnique({ where: { shareCode: code }, include: { city: true } });
  if (!occasion) throw new HttpError(404, 'الدعوة غير متاحة');
  return { guest, occasion };
}
export const dynamic = 'force-dynamic';
export const GET = api(async (_, { params }) => {
  const { guest, occasion: o } = await lookup(params.code);
  return { occasion: { id: o.id, title: o.title, date: o.date, time: o.time, venueName: o.venueName, cityNameAr: o.city.nameAr }, guest: guest ? { name: guest.name, companionCount: guest.companionCount, status: guest.status, rsvpCompanionCount: guest.rsvpCompanionCount } : null };
});
export const POST = api(async (request, { params }) => {
  await rateLimit(`rsvp:${params.code}`, 30);
  const { guest } = await lookup(params.code);
  if (!guest) throw new HttpError(400, 'هذا رابط عرض عام؛ اطلب رابطك الشخصي من المنظم لتأكيد الحضور');
  const d = await body(request, 4096);
  if (!['confirmed','declined'].includes(d.status)) throw new HttpError(400, 'الرد غير صالح');
  const rsvpCompanionCount = integer(d.companionCount, guest.companionCount);
  const result = await prisma.guest.updateMany({ where: { id: guest.id, revokedAt: null, status: { not: 'attended' } }, data: { status: d.status, rsvpTime: new Date(), rsvpCompanionCount, congratulation: text(d.congratsMessage, 1000) } });
  if (!result.count) throw new HttpError(409, 'الدعوة ملغاة أو تم تسجيل الدخول بالفعل');
  return { success: true, status: d.status };
});
