// Netlify scheduled function: asks the app to take its hourly backup. The app does the work (it already has the
// database connection); this only knocks on the door with a shared secret. Runs on published production deploys.
export default async () => {
  const base = process.env.URL;
  const token = process.env.BACKUP_CRON_TOKEN;
  if (!base || !token) { console.log('backup-schedule: URL or BACKUP_CRON_TOKEN missing; nothing to do'); return; }
  const response = await fetch(base + '/api/internal/backup-cron', { method: 'POST', headers: { 'x-backup-token': token } });
  console.log('backup-schedule:', response.status, (await response.text()).slice(0, 300));
};

export const config = { schedule: '@hourly' };
