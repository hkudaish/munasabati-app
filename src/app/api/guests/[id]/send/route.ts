import { prisma } from '@/lib/db';
import { api, body, HttpError, text } from '@/lib/server/http';
import { requireUser, rateLimit } from '@/lib/server/auth';
import { CHANNELS, Channel, decrypt, deliver } from '@/lib/server/channels';
export const GET = api(async (_, { params }) => {
  const user = await requireUser();
  const guest = await prisma.guest.findFirst({ where: { id: params.id, occasion: { userId: user.id } } });
  if (!guest) throw new HttpError(404, 'الضيف غير موجود');
  return { deliveries: await prisma.invitationDelivery.findMany({ where: { guestId: guest.id }, orderBy: { createdAt: 'desc' }, take: 20 }) };
});
export const POST = api(async (request, { params }) => {
  const user = await requireUser(); const d = await body(request, 4096);
  if (!CHANNELS.includes(d.channel)) throw new HttpError(400, 'القناة غير صالحة');
  const channel = d.channel as Channel; const requestKey = text(d.requestKey, 100, true);
  if (!/^[a-f0-9-]{36}$/.test(requestKey)) throw new HttpError(400, 'معرف طلب غير صالح');
  const guest = await prisma.guest.findFirst({ where: { id: params.id, revokedAt: null, occasion: { userId: user.id } }, include: { occasion: true } });
  if (!guest) throw new HttpError(404, 'الضيف غير موجود أو الدعوة ملغاة');
  const previous = await prisma.invitationDelivery.findUnique({ where: { requestKey } });
  if (previous) { if (previous.guestId !== guest.id || previous.channel !== channel) throw new HttpError(409, 'تعارض معرف الطلب'); return { delivery: previous }; }
  await rateLimit(`send:${user.id}`, 100, 3600000);
  const setting = await prisma.channelSetting.findUnique({ where: { userId_channel: { userId: user.id, channel } } });
  if (!setting?.enabled) throw new HttpError(400, 'أكمل إعدادات القناة وفعّلها أولاً');
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
  if (process.env.NODE_ENV === 'production' && (origin.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(origin.hostname))) throw new HttpError(503, 'أدخل عنوان الموقع المنشور الآمن على الخادم قبل الإرسال');
  const secret = decrypt(setting.encryptedSecret, `${user.id}:${channel}`);
  const delivery = await prisma.invitationDelivery.create({ data: { guestId: guest.id, channel, requestKey } });
  let providerId: string;
  try { providerId = await deliver(channel, setting.config as Record<string,string>, secret, { phone: guest.phone, email: guest.email, name: guest.name, title: guest.occasion.title, url: `${origin.origin}/invite/${guest.qrCode}`, requestKey }); }
  catch (e) {
    const status = e instanceof HttpError && e.status !== 504 ? 'FAILED' : 'UNKNOWN';
    await prisma.invitationDelivery.update({ where: { id: delivery.id }, data: { status, errorCode: e instanceof HttpError ? String(e.status) : 'PROVIDER_ERROR' } });
    throw e;
  }
  // ACCEPTED means provider acceptance, not confirmed delivery to the recipient.
  const saved = await prisma.$transaction(async tx => {
    const row = await tx.invitationDelivery.update({ where: { id: delivery.id }, data: { providerId, status: 'ACCEPTED' } });
    await tx.guest.update({ where: { id: guest.id }, data: { invitationSentAt: new Date(), invitedVia: channel } }); return row;
  });
  return { delivery: saved };
});
