// Netlify scheduled function: every 15 minutes asks the app to look for price changes, queue abandoned-cart reminders and send due
// notifications. The app does the work (it has the database connection); this only knocks with the shared secret.
export default async () => {
  const base = process.env.URL;
  const token = process.env.NOTIFICATIONS_CRON_TOKEN || process.env.BACKUP_CRON_TOKEN;
  if (!base || !token) { console.log('notifications-schedule: URL or token missing; nothing to do'); return; }
  const response = await fetch(base + '/api/internal/notifications-cron', { method: 'POST', headers: { 'x-backup-token': token } });
  console.log('notifications-schedule:', response.status, (await response.text()).slice(0, 300));
};

export const config = { schedule: '*/15 * * * *' };
