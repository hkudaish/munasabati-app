import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { activeLines } from './cart';
import { detectAllPriceChanges } from './price-watch';
import { expireDrafts } from './drafts';
import { readSettings, renderTemplate, money, NotificationSettings } from './events';

const MAX_RETRIES = 5;
const LEASE_MINUTES = 10;
const backoffMinutes = (retry: number) => Math.min(720, 2 ** retry * 5);
const jobKey = (parts: (string | number)[]) => parts.join(':');

/** What the customer allowed. The in-app inbox is on unless switched off; email only after the customer opted in. */
async function consent(userId: string) {
  const rows = await prisma.$queryRaw<{ channel: string; enabled: boolean }[]>`SELECT "channel","enabled" FROM "NotificationPreference" WHERE "userId"=${userId}`;
  const pref = new Map(rows.map(r => [r.channel, r.enabled]));
  return { inbox: pref.get('inbox') !== false, email: pref.get('email') === true };
}

async function addJobs(event: any, spec: { template: string; userId: string; lineId?: string | null; key: string; scheduledAt: Date; payload: Record<string, unknown>; merge?: boolean }, settings: NotificationSettings) {
  const user = (await prisma.$queryRaw<any[]>`SELECT "id","email","isActive" FROM "User" WHERE "id"=${spec.userId}`)[0];
  if (!user?.isActive) return;
  const allowed = await consent(spec.userId);
  const channels: ('inbox' | 'email')[] = [];
  if (settings.channels.inbox && allowed.inbox) channels.push('inbox');
  if (settings.channels.email && allowed.email && user.email) channels.push('email');
  for (const channel of channels) {
    const payload = JSON.stringify(spec.payload), dedup = spec.key + ':' + channel;
    if (spec.merge) {
      // changes in the same window join one message; replaying the same event adds nothing
      await prisma.$executeRaw`INSERT INTO "NotificationJob" ("id","outboxEventId","userId","lineId","template","channel","scheduledAt","dedupKey","payload") VALUES (${randomUUID()},${event.id},${spec.userId},${spec.lineId ?? null},${spec.template},${channel},${spec.scheduledAt},${dedup},${payload}::jsonb) ON CONFLICT ("dedupKey") DO UPDATE SET "payload"=jsonb_set("NotificationJob"."payload",'{changes}',("NotificationJob"."payload"->'changes') || (EXCLUDED."payload"->'changes')) WHERE "NotificationJob"."status"='PENDING' AND NOT (("NotificationJob"."payload"->'changes') @> jsonb_build_array(jsonb_build_object('changeId',(EXCLUDED."payload"->'changes'->0)->>'changeId')))`;
    } else {
      await prisma.$executeRaw`INSERT INTO "NotificationJob" ("id","outboxEventId","userId","lineId","template","channel","scheduledAt","dedupKey","payload") VALUES (${randomUUID()},${event.id},${spec.userId},${spec.lineId ?? null},${spec.template},${channel},${spec.scheduledAt},${dedup},${payload}::jsonb) ON CONFLICT ("dedupKey") DO NOTHING`;
    }
  }
}

/** Turns committed domain events into notification jobs. Safe to run twice: jobs are de-duplicated by key. */
export async function dispatchOutbox(limit = 50) {
  const events = await prisma.$queryRaw<any[]>`UPDATE "DomainOutbox" SET "nextAttemptAt"=CURRENT_TIMESTAMP + ${LEASE_MINUTES + ' minutes'}::interval WHERE "id" IN (SELECT "id" FROM "DomainOutbox" WHERE "status"='PENDING' AND "nextAttemptAt"<=CURRENT_TIMESTAMP ORDER BY "occurredAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED) RETURNING *`;
  const { settings } = await prisma.$transaction(tx => readSettings(tx as any));
  let done = 0, failed = 0;
  for (const event of events) {
    try {
      if (settings.enabled) {
        const p = event.payload;
        if (event.eventType === 'CartPriceIncreased' || event.eventType === 'CartPriceDecreased') {
          const up = event.eventType === 'CartPriceIncreased';
          if (settings.price.enabled && (up || settings.price.notifyDecreases)) {
            const windowMs = settings.price.groupWindowMinutes * 60000, at = new Date(event.occurredAt).getTime();
            const bucket = windowMs ? Math.floor(at / windowMs) : event.id;
            await addJobs(event, { template: up ? 'price_increase' : 'price_decrease', userId: event.aggregateId, key: jobKey(['price', up ? 'up' : 'down', event.aggregateId, bucket]), scheduledAt: windowMs ? new Date((Number(bucket) + 1) * windowMs) : new Date(), merge: true,
              payload: { changes: [{ changeId: p.changeId, lineId: p.lineId, title: p.title, titleEn: p.titleEn, previousHalala: p.previousHalala, newHalala: p.newHalala }] } }, settings);
          }
        } else if (event.eventType === 'CartItemRequiresReview') {
          await addJobs(event, { template: 'item_review', userId: event.aggregateId, lineId: p.lineId, key: jobKey(['review', event.aggregateId, p.key]), scheduledAt: new Date(), payload: { lineId: p.lineId } }, settings);
        }
      }
      await prisma.$executeRaw`UPDATE "DomainOutbox" SET "status"='DONE',"publishedAt"=CURRENT_TIMESTAMP,"lastError"=NULL WHERE "id"=${event.id}`; done++;
    } catch (error) {
      failed++;
      const retry = event.retryCount + 1, message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await prisma.$executeRaw`UPDATE "DomainOutbox" SET "retryCount"=${retry},"lastError"=${message},"status"=${retry >= MAX_RETRIES ? 'DEAD' : 'PENDING'},"nextAttemptAt"=CURRENT_TIMESTAMP + ${backoffMinutes(retry) + ' minutes'}::interval WHERE "id"=${event.id}`;
    }
  }
  return { claimed: events.length, done, failed };
}

/** Abandoned-cart reminders: for each cart with active items, the next stage whose idle time has passed and that was not yet queued. */
export async function scheduleReminders(limit = 200) {
  const { settings } = await prisma.$transaction(tx => readSettings(tx as any));
  if (!settings.enabled || !settings.reminders.enabled) return { queued: 0 };
  const stages = [...settings.reminders.stagesHours, ...(settings.reminders.finalHours ? [settings.reminders.finalHours] : [])];
  if (!stages.length) return { queued: 0 };
  const carts = await prisma.$queryRaw<any[]>`SELECT "userId","body","lastActivityAt" FROM "CommerceCart" WHERE "lastActivityAt" <= CURRENT_TIMESTAMP - ${stages[0] + ' hours'}::interval AND EXISTS (SELECT 1 FROM jsonb_array_elements("body"->'lines') l WHERE COALESCE(l->>'savedForLater','false') <> 'true') ORDER BY "lastActivityAt" LIMIT ${limit}`;
  let queued = 0;
  for (const cart of carts) {
    const idleHours = (Date.now() - new Date(cart.lastActivityAt).getTime()) / 3600000, activity = new Date(cart.lastActivityAt).getTime();
    const sent = await prisma.$queryRaw<{ dedupKey: string }[]>`SELECT "dedupKey" FROM "NotificationJob" WHERE "userId"=${cart.userId} AND "template"='cart_reminder' AND "dedupKey" LIKE ${'cart-reminder:' + cart.userId + ':%:' + activity + ':%'}`;
    const taken = new Set(sent.map(r => Number(r.dedupKey.split(':')[2])));
    const stage = stages.findIndex((h, i) => idleHours >= h && !taken.has(i));
    if (stage < 0) continue;
    const before = (await prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${cart.userId} AND "template"='cart_reminder'`)[0].n;
    await addJobs({ id: null }, { template: 'cart_reminder', userId: cart.userId, key: jobKey(['cart-reminder', cart.userId, stage, activity]), scheduledAt: new Date(), payload: { stage, activityAt: activity } }, settings);
    const after = (await prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "NotificationJob" WHERE "userId"=${cart.userId} AND "template"='cart_reminder'`)[0].n;
    queued += after - before > 0 ? 1 : 0;
  }
  return { queued };
}

async function sendEmail(to: string, subject: string, body: string, key: string) {
  const apiKey = process.env.NOTIFY_EMAIL_API_KEY, from = process.env.NOTIFY_EMAIL_FROM;
  if (!apiKey || !from) return { skipped: 'email_not_configured' as const };
  const response = await fetch(process.env.NOTIFY_EMAIL_URL || 'https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ from, to: [to], subject, text: body }), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('provider_' + response.status);
  const data = await response.json().catch(() => ({}));
  return { id: typeof data.id === 'string' ? data.id : null };
}

type Decision = { skip: string } | { send: { title: string; body: string } };
/** Looks again at the customer's cart at the moment of sending: a message about something that is no longer true is never sent. */
async function decide(job: any, settings: NotificationSettings): Promise<Decision> {
  if (!settings.enabled) return { skip: 'disabled' };
  const cart = (await prisma.$queryRaw<any[]>`SELECT "body","locale","lastActivityAt" FROM "CommerceCart" WHERE "userId"=${job.userId}`)[0];
  if (!cart) return { skip: 'no_cart' };
  const locale: 'ar' | 'en' = cart.locale === 'en' ? 'en' : 'ar', active = activeLines(cart.body.lines), ids = new Set(active.map((l: any) => l.id));
  const allowed = await consent(job.userId);
  if (job.channel === 'inbox' && !allowed.inbox) return { skip: 'no_consent' };
  if (job.channel === 'email' && !allowed.email) return { skip: 'no_consent' };
  if (job.template === 'cart_reminder') {
    if (!settings.reminders.enabled) return { skip: 'disabled' };
    if (!active.length) return { skip: 'cart_empty' };
    if (new Date(cart.lastActivityAt).getTime() !== job.payload.activityAt) return { skip: 'customer_returned' };
    return { send: renderTemplate(settings, 'cart_reminder', locale) };
  }
  if (job.template === 'item_review') {
    if (!ids.has(job.payload.lineId)) return { skip: 'item_gone' };
    return { send: renderTemplate(settings, 'item_review', locale) };
  }
  const up = job.template === 'price_increase';
  if (!settings.price.enabled || (!up && !settings.price.notifyDecreases)) return { skip: 'disabled' };
  const pending = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CartPriceChange" WHERE "userId"=${job.userId} AND "acknowledgedAt" IS NULL AND "direction"='INCREASE'`;
  const stillOpen = new Set(pending.map(r => r.id));
  const changes = (job.payload.changes as any[]).filter(c => ids.has(c.lineId) && (up ? stillOpen.has(c.changeId) : true));
  if (!changes.length) return { skip: 'nothing_to_report' };
  const lines = changes.map(c => `${locale === 'en' && c.titleEn ? c.titleEn : c.title}: ${money(c.previousHalala, locale)} → ${money(c.newHalala, locale)}`).join('\n');
  return { send: renderTemplate(settings, up ? 'price_increase' : 'price_decrease', locale, { lines }) };
}

/** Sends due jobs. A failed send is retried with backoff and finally parked as DEAD; it never touches the booking or cart data. */
export async function runNotificationJobs(limit = 50) {
  const jobs = await prisma.$queryRaw<any[]>`UPDATE "NotificationJob" SET "scheduledAt"=CURRENT_TIMESTAMP + ${LEASE_MINUTES + ' minutes'}::interval WHERE "id" IN (SELECT "id" FROM "NotificationJob" WHERE "status"='PENDING' AND "scheduledAt"<=CURRENT_TIMESTAMP ORDER BY "scheduledAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED) RETURNING *`;
  const { settings } = await prisma.$transaction(tx => readSettings(tx as any));
  const result = { claimed: jobs.length, sent: 0, skipped: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const decision = await decide(job, settings);
      if ('skip' in decision) { await prisma.$executeRaw`UPDATE "NotificationJob" SET "status"='SKIPPED',"lastError"=${decision.skip} WHERE "id"=${job.id}`; result.skipped++; continue; }
      let providerId: string | null = null, provider = 'inbox';
      if (job.channel === 'inbox') {
        await prisma.$executeRaw`INSERT INTO "ServiceInbox" ("id","userId","requestId","event","body") VALUES (${randomUUID()},${job.userId},${'notify:' + job.id},${'CART:' + job.template},${JSON.stringify({ referenceType: 'CART', titleAr: decision.send.title, statusAr: decision.send.body, url: '/commerce/cart' })}::jsonb) ON CONFLICT ("userId","requestId","event") DO NOTHING`;
      } else {
        provider = 'email';
        const user = (await prisma.$queryRaw<any[]>`SELECT "email" FROM "User" WHERE "id"=${job.userId}`)[0];
        const sent = await sendEmail(user.email, decision.send.title, decision.send.body, createHash('sha256').update(job.id).digest('hex'));
        if ('skipped' in sent) { await prisma.$executeRaw`UPDATE "NotificationJob" SET "status"='SKIPPED',"lastError"=${sent.skipped} WHERE "id"=${job.id}`; result.skipped++; continue; }
        providerId = sent.id;
      }
      await prisma.$executeRaw`INSERT INTO "NotificationAttempt" ("id","jobId","provider","providerMessageId","status") VALUES (${randomUUID()},${job.id},${provider},${providerId},'SENT')`;
      await prisma.$executeRaw`UPDATE "NotificationJob" SET "status"='SENT',"sentAt"=CURRENT_TIMESTAMP,"lastError"=NULL WHERE "id"=${job.id}`; result.sent++;
    } catch (error) {
      result.failed++;
      const retry = job.retryCount + 1, code = (error instanceof Error ? error.message : String(error)).slice(0, 120);
      await prisma.$executeRaw`INSERT INTO "NotificationAttempt" ("id","jobId","provider","status","errorCode") VALUES (${randomUUID()},${job.id},${job.channel},'FAILED',${code})`;
      await prisma.$executeRaw`UPDATE "NotificationJob" SET "retryCount"=${retry},"lastError"=${code},"status"=${retry >= MAX_RETRIES ? 'DEAD' : 'PENDING'},"scheduledAt"=CURRENT_TIMESTAMP + ${backoffMinutes(retry) + ' minutes'}::interval WHERE "id"=${job.id}`;
    }
  }
  return result;
}

/** One pass of everything scheduled: find price changes, expire old drafts, queue reminders, turn events into jobs, send. */
export async function runCron() {
  const prices = await detectAllPriceChanges();
  const expired = await expireDrafts();
  const reminders = await scheduleReminders();
  const outbox = await dispatchOutbox();
  const jobs = await runNotificationJobs();
  return { prices, expiredDrafts: Number(expired), reminders, outbox, jobs };
}
