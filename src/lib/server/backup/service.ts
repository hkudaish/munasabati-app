import 'server-only';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma, databaseConnectionUrl } from '@/lib/db';
import { HttpError } from '../http';
import { rateLimit, requireAdmin, requireSystemAdmin } from '../auth';
import * as engine from '../../../../scripts/lib/backup-engine.cjs';
import type { Preview, Storage } from '../../../../scripts/lib/backup-engine.cjs';

/**
 * Backups managed from the admin page.
 *  - On Netlify the files live in Netlify Blobs (private to the site) and an hourly scheduled function calls the cron route.
 *  - Locally (development, tests) they live in a folder, so the same page works without Netlify.
 * Restoring the live data is a two-person action: one administrator requests it after a preview, a different one approves.
 */
/** The schema the app's connection uses (Prisma's `schema` URL parameter; Netlify's database uses `public`). */
function dbSchema() {
  try { return new URL(databaseConnectionUrl() || '').searchParams.get('schema') || 'public'; } catch { return 'public'; }
}
const CONFIRM = 'RESTORE';
const REQUEST_TTL_MS = 30 * 60 * 1000;

export const isCloud = () => !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);

export async function backupStorage(): Promise<Storage> {
  if (isCloud()) {
    const { getStore } = await import('@netlify/blobs');
    return new engine.BlobStorage(getStore({ name: 'backups', consistency: 'strong' }));
  }
  return new engine.FileStorage(process.env.BACKUP_STORAGE_DIR || path.join(os.homedir(), 'Backups', 'munasabati', 'incremental', 'app'));
}

/** Backups contain customer data: on the live site they are never written without an encryption key. */
function requireKeyInCloud() {
  if (isCloud() && !engine.encryptionKey()) throw new HttpError(409, 'مفتاح تشفير النسخ الاحتياطية (BACKUP_ENCRYPTION_KEY) غير مضبوط في إعدادات الموقع');
}
function wrap<T>(work: Promise<T>): Promise<T> {
  return work.catch(error => { if (error instanceof HttpError) throw error; throw new HttpError(409, String(error?.message || error).slice(0, 600)); });
}
async function audit(actorId: string, action: string, targetId: string, details: Record<string, unknown> = {}) {
  await prisma.systemAuditLog.create({ data: { actorId, action, targetId, details: details as object } });
}

// ---- backups -------------------------------------------------------------------------------------------------------
/** What the scheduler and the "Back up now" button do: a full backup first, then incrementals, a new full one weekly. */
export async function runAuto(actorId: string, type?: 'full' | 'incremental') {
  requireKeyInCloud();
  const storage = await backupStorage();
  return wrap((async () => {
    const decision = type ? { type, why: 'requested by an administrator' } : engine.nextAutoType(await engine.readManifests(storage));
    let result;
    try { result = await engine.createBackup({ prisma, schema: dbSchema(), storage, type: decision.type, label: actorId === 'SCHEDULER' ? 'auto' : 'manual' }); }
    catch (error: any) {
      if (decision.type === 'incremental' && /structure changed|Encryption setting/.test(String(error?.message))) {
        result = await engine.createBackup({ prisma, schema: dbSchema(), storage, type: 'full', label: 'auto (new chain: ' + String(error.message).split('.')[0] + ')' });
      } else throw error;
    }
    const check = await engine.verifyChain(storage, result.manifest.id);
    if (!check.ok) throw new Error('Backup written but verification failed: ' + check.problems.join('; '));
    const removed = await engine.prune(storage);
    await audit(actorId, 'BACKUP_RUN', result.manifest.id, { type: result.manifest.type, why: decision.why, changed: result.changed, pruned: removed.length });
    return { id: result.manifest.id, type: result.manifest.type, why: decision.why, changed: result.changed, rows: result.manifest.stats.rows, pruned: removed.length };
  })());
}

export async function runManual(type: 'auto' | 'full' | 'incremental') {
  const user = await requireSystemAdmin();
  await rateLimit('backup-run:' + user.id, 20);
  return runAuto(user.id, type === 'auto' ? undefined : type);
}

/** Called hourly by the Netlify scheduled function; proves itself with a shared secret. */
export async function runScheduled(request: Request) {
  const secret = process.env.BACKUP_CRON_TOKEN;
  if (!secret) throw new HttpError(503, 'الجدولة غير مهيأة');
  const given = Buffer.from(request.headers.get('x-backup-token') || '');
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) { await rateLimit('backup-cron-bad', 20); throw new HttpError(401, 'غير مصرح'); }
  return runAuto('SCHEDULER');
}

export async function verifyBackup(id: string) {
  const user = await requireSystemAdmin();
  await rateLimit('backup-verify:' + user.id, 60);
  const storage = await backupStorage();
  const check = await wrap(engine.verifyChain(storage, id));
  await audit(user.id, 'BACKUP_VERIFY', id, { ok: check.ok, problems: check.problems.slice(0, 5) });
  return { ok: check.ok, problems: check.problems, chainLength: check.chain.length };
}

export async function previewBackup(id: string) {
  const user = await requireSystemAdmin();
  await rateLimit('backup-preview:' + user.id, 30);
  const storage = await backupStorage();
  const preview = await wrap(engine.previewRestore({ prisma, schema: dbSchema(), storage, headId: id }));
  await audit(user.id, 'BACKUP_PREVIEW', id, { add: preview.totals.toAdd, remove: preview.totals.toRemove, revert: preview.totals.toChange });
  return preview;
}

// ---- restore requests (two-person rule) ---------------------------------------------------------------------------
type RequestStatus = 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
interface RestoreRequest {
  id: string; backupId: string; backupCreatedAt: string; status: RequestStatus;
  requestedBy: { id: string; name: string }; requestedAt: string; expiresAt: string;
  preview: Pick<Preview, 'totals'> & { tables: { table: string; toAdd: number; toRemove: number; toChange: number }[] };
  approvedBy?: { id: string; name: string }; finishedAt?: string; error?: string;
  result?: { rows: number; verified: boolean; mismatches: string[]; safetyBackupId: string | null };
}
async function requestStore() { return (await backupStorage()).sub('restore-requests'); }
async function readRequest(store: Storage, id: string): Promise<RestoreRequest | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const buf = await store.read(id + '.json');
  return buf ? JSON.parse(buf.toString('utf8')) : null;
}
const saveRequest = (store: Storage, request: RestoreRequest) => store.write(request.id + '.json', Buffer.from(JSON.stringify(request)));
async function listRequests(): Promise<RestoreRequest[]> {
  const store = await requestStore();
  const all = (await Promise.all((await store.list()).filter(n => n.endsWith('.json')).map(n => readRequest(store, n.slice(0, -5))))).filter(Boolean) as RestoreRequest[];
  const now = Date.now();
  for (const request of all) if (request.status === 'PENDING' && Date.parse(request.expiresAt) < now) { request.status = 'EXPIRED'; await saveRequest(store, request); }
  return all.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function requestRestore(id: string, confirm: string) {
  const user = await requireSystemAdmin();
  await rateLimit('backup-restore-request:' + user.id, 10);
  if (confirm !== CONFIRM) throw new HttpError(400, `اكتب ${CONFIRM} للتأكيد`);
  requireKeyInCloud();
  if ((await listRequests()).some(r => r.status === 'PENDING')) throw new HttpError(409, 'يوجد طلب استعادة معلق؛ ألغه أو انتظر انتهاءه');
  const storage = await backupStorage();
  const preview = await wrap(engine.previewRestore({ prisma, schema: dbSchema(), storage, headId: id }));
  if (!preview.compatible) throw new HttpError(409, 'بنية قاعدة البيانات الحالية تختلف عن بنية النسخة؛ لا يمكن الاستعادة منها');
  const now = Date.now();
  const request: RestoreRequest = {
    id: randomUUID(), backupId: id, backupCreatedAt: preview.head.createdAt, status: 'PENDING',
    requestedBy: { id: user.id, name: user.name }, requestedAt: new Date(now).toISOString(), expiresAt: new Date(now + REQUEST_TTL_MS).toISOString(),
    preview: { totals: preview.totals, tables: preview.tables.map(t => ({ table: t.table, toAdd: t.toAdd, toRemove: t.toRemove, toChange: t.toChange })) },
  };
  await saveRequest(await requestStore(), request);
  await audit(user.id, 'BACKUP_RESTORE_REQUESTED', id, { requestId: request.id, add: preview.totals.toAdd, remove: preview.totals.toRemove, revert: preview.totals.toChange });
  return request;
}

export async function cancelRestore(requestId: string) {
  const user = await requireAdmin();
  const store = await requestStore();
  const request = await readRequest(store, requestId);
  if (!request || request.status !== 'PENDING') throw new HttpError(404, 'الطلب غير موجود أو لم يعد معلقاً');
  request.status = 'CANCELLED'; request.finishedAt = new Date().toISOString();
  await saveRequest(store, request);
  await audit(user.id, 'BACKUP_RESTORE_CANCELLED', request.backupId, { requestId });
  return request;
}

/** A DIFFERENT administrator confirms; then a safety backup is taken and the live data is replaced in one transaction. */
export async function approveRestore(requestId: string, confirm: string) {
  const user = await requireAdmin();
  await rateLimit('backup-restore-approve:' + user.id, 10);
  if (confirm !== CONFIRM) throw new HttpError(400, `اكتب ${CONFIRM} للتأكيد`);
  requireKeyInCloud();
  const requests = await requestStore();
  const request = await readRequest(requests, requestId);
  if (!request) throw new HttpError(404, 'الطلب غير موجود');
  if (request.status !== 'PENDING') throw new HttpError(409, request.status === 'EXPIRED' ? 'انتهت صلاحية الطلب؛ أنشئ طلباً جديداً' : 'الطلب لم يعد معلقاً');
  if (Date.parse(request.expiresAt) < Date.now()) { request.status = 'EXPIRED'; await saveRequest(requests, request); throw new HttpError(409, 'انتهت صلاحية الطلب؛ أنشئ طلباً جديداً'); }
  if (request.requestedBy.id === user.id) throw new HttpError(403, 'يجب أن يوافق مسؤول آخر غير مقدّم الطلب');
  request.approvedBy = { id: user.id, name: user.name };
  await audit(user.id, 'BACKUP_RESTORE_APPROVED', request.backupId, { requestId, requestedBy: request.requestedBy.id });

  const storage = await backupStorage();
  const release = await wrap(storage.acquireLock()); // no backup run may start while the data is being replaced
  try {
    const safety = storage.sub('pre-restore');
    const before = (await engine.readManifests(safety)).length;
    const result = await engine.restoreBackup({ prisma, schema: dbSchema(), storage, headId: request.backupId, replace: true, safetyStorage: safety });
    const safetyList = await engine.readManifests(safety);
    request.status = result.verified ? 'DONE' : 'FAILED';
    request.finishedAt = new Date().toISOString();
    request.result = { rows: result.rows, verified: result.verified, mismatches: result.mismatches.slice(0, 10), safetyBackupId: safetyList.length > before ? safetyList[safetyList.length - 1].id : null };
    await saveRequest(requests, request);
    await audit(user.id, result.verified ? 'BACKUP_RESTORE_DONE' : 'BACKUP_RESTORE_MISMATCH', request.backupId, { requestId, rows: result.rows, safetyBackupId: request.result.safetyBackupId, mismatches: result.mismatches.length });
    return request;
  } catch (error: any) {
    request.status = 'FAILED'; request.finishedAt = new Date().toISOString(); request.error = String(error?.message || error).slice(0, 600);
    await saveRequest(requests, request);
    await audit(user.id, 'BACKUP_RESTORE_FAILED', request.backupId, { requestId, error: request.error });
    throw new HttpError(409, 'فشلت الاستعادة ولم يتغير شيء: ' + request.error);
  } finally { await release(); }
}

// ---- overview for the page ----------------------------------------------------------------------------------------
export async function overview() {
  const user = await requireAdmin();
  const storage = await backupStorage();
  const manifests = await wrap(engine.readManifests(storage));
  const newest = manifests[manifests.length - 1];
  const ageMinutes = newest ? Math.floor((Date.now() - Date.parse(newest.createdAt)) / 60000) : null;
  const next = engine.nextAutoType(manifests);
  const history = await prisma.systemAuditLog.findMany({ where: { action: { startsWith: 'BACKUP_' } }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, actorId: true, action: true, targetId: true, details: true, createdAt: true } });
  const actors = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(history.map(h => h.actorId))) } }, select: { id: true, name: true } });
  const names = new Map(actors.map(a => [a.id, a.name]));
  return {
    viewer: { id: user.id, isSystemAdmin: user.role === 'SUPER_ADMIN' },
    config: {
      storage: isCloud() ? 'cloud' : 'local', storageLabel: storage.describe(), encrypted: !!engine.encryptionKey(), schedule: isCloud() && !!process.env.BACKUP_CRON_TOKEN ? 'hourly' : 'off',
      policy: engine.DEFAULT_POLICY, nextBackup: next, keyMissingInCloud: isCloud() && !engine.encryptionKey(),
    },
    health: !newest ? 'none' : ageMinutes! <= 150 ? 'ok' : ageMinutes! <= 1440 ? 'stale' : 'bad',
    newest: newest ? { id: newest.id, createdAt: newest.createdAt, ageMinutes } : null,
    backups: manifests.slice().reverse().map(m => ({ id: m.id, type: m.type, createdAt: m.createdAt, parent: m.parent, rows: m.stats.rows, upserts: m.stats.upserts, deletes: m.stats.deletes, bytes: m.files.data.bytes, encrypted: m.encrypted, label: m.label })),
    requests: (await listRequests()).slice(0, 10),
    history: history.map(h => ({ id: h.id, action: h.action, targetId: h.targetId, at: h.createdAt, by: h.actorId === 'SCHEDULER' ? 'الجدولة التلقائية' : names.get(h.actorId) || 'غير معروف', details: h.details })),
  };
}
