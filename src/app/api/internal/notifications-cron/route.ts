import { timingSafeEqual } from 'node:crypto';
import { api, HttpError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/auth';
import { runCron } from '@/lib/server/commerce-v2/notify-worker';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;
// Called every 15 minutes by netlify/functions/notifications-schedule.mjs with the same shared secret as the backup job; no session, no browser.
export const POST = api(async request => {
  const secret = process.env.NOTIFICATIONS_CRON_TOKEN || process.env.BACKUP_CRON_TOKEN;
  if (!secret) throw new HttpError(503, 'غير مهيأ');
  const given = Buffer.from(request.headers.get('x-backup-token') || ''), expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) { await rateLimit('notifications-cron-bad', 20); throw new HttpError(401, 'غير مصرح'); }
  return { success: true, result: await runCron() };
}, { allowDisabledFeature: true });
