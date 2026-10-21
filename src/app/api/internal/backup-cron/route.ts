import { api } from '@/lib/server/http';
import { runScheduled } from '@/lib/server/backup/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

// Called every hour by netlify/functions/backup-schedule.mjs with a shared secret; no session, no browser.
export const POST = api(async request => ({ success: true, result: await runScheduled(request) }), { allowDisabledFeature: true });
