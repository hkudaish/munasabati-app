// Temporary, expiring operator-only bridge for the first local-to-cloud transfer.
// Removed after the initial deployment; credentials and imported rows never enter Git.
import { createHash, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { api, body, HttpError, text } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const POST = api(async request => {
  const expected = process.env.DATABASE_BOOTSTRAP_TOKEN_HASH || '';
  const expires = new Date(process.env.DATABASE_BOOTSTRAP_EXPIRES_AT || '').getTime();
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(expected) || !Number.isFinite(expires) || expires < Date.now() || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(404, 'غير متاح');
  const actual = createHash('sha256').update(token).digest();
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new HttpError(404, 'غير متاح');
  const data = await body(request, 1500000);
  let db;
  try { db = getDatabase(); } catch { throw new HttpError(503, 'Managed database connection is not configured'); }
  const client = await db.pool.connect();
  try {
    if (data.action === 'inspect') {
      const status = await client.query('SELECT current_user, current_database()');
      return { connected: true, role: status.rows[0].current_user };
    }
    const sql = text(data.sql, 1400000, true);
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('munasabati-initial-transfer'))");
    const result = await client.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "SaudiCity")::int AS cities');
    if (result.rows[0].users || result.rows[0].cities) throw new HttpError(409, 'تم نقل البيانات مسبقاً');
    await client.query(sql);
    await client.query('COMMIT');
    return { imported: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await db.pool.end(); }
});
