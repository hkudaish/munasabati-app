import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { Tx } from '../booking/repository';
import { internationalPhone } from '../channels';

// Notifications about exception requests. Every message is a row, once per person, event and channel (the dedup key), so a retried request
// or a repeated sweep never sends twice. The in-app inbox is always written; email, SMS and WhatsApp are queued and sent by `deliverQueued`
// only if the provider is configured by environment variables, otherwise the row is marked SKIPPED with the reason. A delivered message
// is never treated as the customer's approval: approvals are only ever recorded by the signed-in customer on the offer page.

export type ExceptionEvent =
  | 'SUBMITTED' | 'PROVIDER_REQUEST' | 'FEASIBILITY_APPROVED' | 'REJECTED' | 'ALTERNATIVE_PROPOSED' | 'INFO_REQUIRED' | 'ASSIGNED' | 'OFFER_SENT' | 'OFFER_ACCEPTED' | 'OFFER_DECLINED'
  | 'OFFER_RENEGOTIATE' | 'OFFER_EXPIRED' | 'PAYMENT_REQUESTED' | 'CONFIRMED' | 'RESCHEDULE_APPLIED' | 'CANCELLED' | 'UNAVAILABLE' | 'ESCALATED' | 'OFFER_APPROVAL_NEEDED'
  | 'VENDOR_REGISTERED' | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'VENDOR_INFO_REQUIRED' | 'VENDOR_ON_HOLD';

const EXTERNAL: ExceptionEvent[] = ['OFFER_SENT', 'PAYMENT_REQUESTED', 'CONFIRMED', 'RESCHEDULE_APPLIED', 'REJECTED', 'ALTERNATIVE_PROPOSED', 'OFFER_EXPIRED', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'VENDOR_INFO_REQUIRED'];

export interface Note { number?: string; titleAr: string; bodyAr: string; /** app path, e.g. /exceptions/<id> */ path: string; /** a one-time offer link (only in messages that must reach the customer outside the app) */ link?: string }

export async function notify(tx: Tx, request: { id: string | null; version: number; number: string }, event: ExceptionEvent, userIds: string[], note: Note, options: { once?: string } = {}) {
  const key = options.once ?? `${request.version}`;
  for (const userId of Array.from(new Set(userIds.filter(Boolean)))) {
    const user = (await tx.$queryRaw<any[]>`SELECT "id","email","phone","isActive" FROM "User" WHERE "id"=${userId}`)[0];
    if (!user?.isActive) continue;
    const channels: ('inbox' | 'email' | 'sms' | 'whatsapp')[] = ['inbox'];
    if (EXTERNAL.includes(event)) { if (user.email) channels.push('email'); if (user.phone) channels.push('sms', 'whatsapp'); }
    for (const channel of channels) {
      const dedupKey = `${request.id ?? 'general'}:${event}:${key}:${userId}:${channel}`;
      await tx.$executeRaw`INSERT INTO "ExceptionNotification" ("id","userId","requestId","event","channel","status","dedupKey","payload") VALUES (${randomUUID()},${userId},${request.id},${event},${channel},${channel === 'inbox' ? 'SENT' : 'QUEUED'},${dedupKey},${JSON.stringify({ ...note, number: request.number || undefined })}::jsonb) ON CONFLICT ("dedupKey") DO NOTHING`;
    }
  }
}

async function wantsEmail(userId: string) {
  const rows = await prisma.$queryRaw<{ enabled: boolean }[]>`SELECT "enabled" FROM "NotificationPreference" WHERE "userId"=${userId} AND "channel"='email'`;
  return rows[0]?.enabled === true;
}
const origin = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || '').replace(/\/$/, '');

async function sendEmail(to: string, subject: string, body: string, key: string) {
  const apiKey = process.env.NOTIFY_EMAIL_API_KEY, from = process.env.NOTIFY_EMAIL_FROM;
  if (!apiKey || !from) return 'channel_not_configured';
  const response = await fetch(process.env.NOTIFY_EMAIL_URL || 'https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ from, to: [to], subject, text: body }), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('provider_' + response.status);
  return null;
}
async function sendSms(phone: string, body: string) {
  const config = process.env.EXCEPTION_SMS_ACCOUNT_SID, token = process.env.EXCEPTION_SMS_AUTH_TOKEN, from = process.env.EXCEPTION_SMS_FROM;
  if (!config || !token || !from) return 'channel_not_configured';
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${config}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: internationalPhone(phone), From: from, Body: body }).toString(), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('provider_' + response.status);
  return null;
}
async function sendWhatsApp(phone: string, title: string, text: string) {
  const id = process.env.EXCEPTION_WHATSAPP_PHONE_NUMBER_ID, token = process.env.EXCEPTION_WHATSAPP_TOKEN, template = process.env.EXCEPTION_WHATSAPP_TEMPLATE;
  if (!id || !token || !template) return 'channel_not_configured';
  const response = await fetch(`https://graph.facebook.com/${process.env.EXCEPTION_WHATSAPP_API_VERSION || 'v20.0'}/${id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: internationalPhone(phone).slice(1), type: 'template', template: { name: template, language: { code: process.env.EXCEPTION_WHATSAPP_LANGUAGE || 'ar' }, components: [{ type: 'body', parameters: [title, text].map(value => ({ type: 'text', text: value.slice(0, 900) })) }] } }), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('provider_' + response.status);
  return null;
}

/** Sends queued outside-the-app messages. Called by the 15-minute cron; safe to run twice (a row is claimed before it is sent). */
export async function deliverQueued(limit = 40) {
  const rows = await prisma.$queryRaw<any[]>`SELECT n.*, u."email", u."phone" FROM "ExceptionNotification" n JOIN "User" u ON u."id"=n."userId" WHERE n."status"='QUEUED' AND n."channel" <> 'inbox' ORDER BY n."createdAt" LIMIT ${limit}`;
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    const claimed = await prisma.$executeRaw`UPDATE "ExceptionNotification" SET "status"='SENT',"sentAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id} AND "status"='QUEUED'`;
    if (claimed !== 1) continue;
    const note = row.payload as Note & { number: string };
    const text = `${note.bodyAr}\n${note.link ?? origin() + note.path}`;
    let reason: string | null = null;
    try {
      if (row.channel === 'email') reason = row.email && await wantsEmail(row.userId) ? await sendEmail(row.email, note.number ? `${note.titleAr} (${note.number})` : note.titleAr, text, createHash('sha256').update(row.id).digest('hex')) : 'no_consent';
      else if (row.channel === 'sms') reason = row.phone ? await sendSms(row.phone, `${note.titleAr}: ${text}`) : 'no_phone';
      else reason = row.phone ? await sendWhatsApp(row.phone, note.titleAr, text) : 'no_phone';
    } catch (e) {
      await prisma.$executeRaw`UPDATE "ExceptionNotification" SET "status"='FAILED',"detail"=${e instanceof Error ? e.message.slice(0, 200) : 'error'} WHERE "id"=${row.id}`;
      result.failed++; continue;
    }
    if (reason) { await prisma.$executeRaw`UPDATE "ExceptionNotification" SET "status"='SKIPPED',"detail"=${reason},"sentAt"=NULL WHERE "id"=${row.id}`; result.skipped++; }
    else result.sent++;
  }
  return result;
}
