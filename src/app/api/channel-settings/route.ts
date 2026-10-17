import { prisma } from '@/lib/db';
import { api, body, HttpError, text } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { CHANNELS, Channel, encrypt, validateConfig } from '@/lib/server/channels';
export const dynamic = 'force-dynamic';
export const GET = api(async () => {
  const user = await requireUser();
  const rows = await prisma.channelSetting.findMany({ where: { userId: user.id } });
  return { encryptionReady: /^[a-fA-F0-9]{64}$/.test(process.env.CHANNEL_ENCRYPTION_KEY || ''), settings: rows.map(r => ({ channel: r.channel, config: r.config, enabled: r.enabled, hasSecret: !!r.encryptedSecret, updatedAt: r.updatedAt })) };
});
export const PUT = api(async request => {
  const user = await requireUser(); const d = await body(request, 10000);
  if (!CHANNELS.includes(d.channel) || typeof d.enabled !== 'boolean') throw new HttpError(400, 'القناة أو الحالة غير صالحة');
  const channel = d.channel as Channel;
  const config = validateConfig(channel, d.config);
  const existing = await prisma.channelSetting.findUnique({ where: { userId_channel: { userId: user.id, channel } } });
  const secret = text(d.secret, 4096);
  if (!secret && !existing?.encryptedSecret) throw new HttpError(400, 'مفتاح مزود الخدمة مطلوب');
  const encryptedSecret = secret ? encrypt(secret, `${user.id}:${channel}`) : existing!.encryptedSecret;
  await prisma.channelSetting.upsert({ where: { userId_channel: { userId: user.id, channel } }, create: { userId: user.id, channel, config, encryptedSecret, enabled: d.enabled }, update: { config, encryptedSecret, enabled: d.enabled } });
  return { success: true };
});
export const DELETE = api(async request => {
  const user = await requireUser(); const d = await body(request, 1000);
  if (!CHANNELS.includes(d.channel)) throw new HttpError(400, 'القناة غير صالحة');
  await prisma.channelSetting.deleteMany({ where: { userId: user.id, channel: d.channel } }); return { success: true };
});
