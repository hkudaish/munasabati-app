// Incremental logical backups for PostgreSQL (no pg_dump needed).
//
//  full         every row of every table, taken in ONE read-only REPEATABLE READ transaction (consistent snapshot)
//  incremental  only rows that were added or changed since the previous backup, plus the keys of deleted rows
//  restore      replays full + incrementals (optionally up to an earlier backup) into a target database and then
//               re-reads it to prove every row matches
//
// A row's identity is its primary key; "changed" means its SHA-256 differs from the parent backup's. Files are
// gzip-compressed JSON lines and, when BACKUP_ENCRYPTION_KEY is set, AES-256-GCM encrypted. Every backup records the
// SHA-256 of its files and a chain hash that links it to its parent, so tampering or a missing link is detected.
//
// Scale note: rows are read into memory, which is right for this database (hundreds of thousands of rows at most).
// For multi-gigabyte databases use the provider's point-in-time recovery instead.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createHash, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

// Sessions and rate-limit counters are never backed up: restoring them would revive revoked logins.
const DEFAULT_EXCLUDE = ['AuthSession', 'AuthAttempt', 'SystemSetupToken'];
const FORMAT = 1;

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const q = name => '"' + String(name).replace(/"/g, '""') + '"';
const stable = value => JSON.stringify(value, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v));
const gz = buf => zlib.gzipSync(buf, { level: 9 });

// ---------------------------------------------------------------------------------------------------------------
// Encryption (optional)
// ---------------------------------------------------------------------------------------------------------------
function encryptionKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 random bytes in base64 (run: node scripts/backup.cjs keygen).');
  return key;
}
function seal(buf, key) {
  if (!key) return buf;
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]);
}
function unseal(buf, key) {
  if (!key) throw new Error('This backup is encrypted: set BACKUP_ENCRYPTION_KEY to the key it was created with.');
  const iv = buf.subarray(0, 12), tag = buf.subarray(buf.length - 16), body = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try { return Buffer.concat([decipher.update(body), decipher.final()]); }
  catch { throw new Error('Cannot decrypt: wrong key, or the file was modified.'); }
}

// ---------------------------------------------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------------------------------------------
function openDb(url) {
  const u = new URL(url);
  u.searchParams.delete('schema'); // every query below is schema-qualified
  return new PrismaClient({ datasourceUrl: u.toString(), log: [] });
}

async function describeSchema(tx, schema, exclude) {
  const tables = await tx.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY 1`, schema);
  const cols = await tx.$queryRawUnsafe(`SELECT table_name AS t, column_name AS c, data_type AS d, udt_name AS u FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name, ordinal_position`, schema);
  const pks = await tx.$queryRawUnsafe(`SELECT cl.relname AS t, a.attname AS c, k.ord::int AS o FROM pg_index i JOIN pg_class cl ON cl.oid=i.indrelid JOIN pg_namespace n ON n.oid=cl.relnamespace JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true JOIN pg_attribute a ON a.attrelid=cl.oid AND a.attnum=k.attnum WHERE i.indisprimary AND n.nspname=$1 ORDER BY cl.relname, k.ord`, schema);
  const fks = await tx.$queryRawUnsafe(`SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND n.nspname=$1`, schema);
  const skip = new Set(exclude);
  const info = {};
  for (const { t } of tables) if (!skip.has(t)) info[t] = { columns: [], pk: [], types: {} };
  for (const { t, c, d, u } of cols) if (info[t]) { info[t].columns.push(c); info[t].types[c] = d === 'USER-DEFINED' || d === 'ARRAY' ? u : d; }
  for (const { t, c } of pks) if (info[t]) info[t].pk.push(c);
  const missingPk = Object.keys(info).filter(t => !info[t].pk.length);
  if (missingPk.length) throw new Error('Tables without a primary key cannot be backed up incrementally: ' + missingPk.join(', '));
  const deps = Object.fromEntries(Object.keys(info).map(t => [t, new Set()]));
  for (const { child, parent } of fks) if (info[child] && info[parent] && child !== parent) deps[child].add(parent);
  // parents first
  const order = [], state = {};
  const visit = t => { if (state[t]) return; state[t] = 1; for (const d of deps[t]) visit(d); order.push(t); };
  Object.keys(info).sort().forEach(visit);
  // column ORDER is irrelevant to a logical restore (rows are keyed by column name), so it must not affect compatibility
  const fingerprint = sha256(stable(Object.fromEntries(Object.keys(info).sort().map(t => [t, info[t].columns.map(c => c + ':' + info[t].types[c]).sort()]))));
  return { info, order, fingerprint };
}

const rowKey = (row, pk) => JSON.stringify(pk.map(c => row[c]));

/**
 * Reads many tables per round trip (UNION ALL, tagged by table name). Each query costs one network round trip, so over
 * a slow link this is the difference between 70 seconds and a few. Rows come back sorted by primary key for stable files.
 */
async function readTables(tx, schema, tables, info, perQuery = 20) {
  const rows = Object.fromEntries(tables.map(t => [t, []]));
  for (let i = 0; i < tables.length; i += perQuery) {
    const batch = tables.slice(i, i + perQuery);
    const sql = batch.map(t => `SELECT ${"'" + t.replace(/'/g, "''") + "'"}::text AS t, to_jsonb(x) AS j FROM ${q(schema)}.${q(t)} x`).join(' UNION ALL ');
    for (const r of await tx.$queryRawUnsafe(sql)) rows[r.t].push(r.j);
  }
  for (const t of tables) {
    const pk = info[t].pk;
    const keyed = rows[t].map(row => [rowKey(row, pk), row]);
    keyed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    rows[t] = keyed.map(k => k[1]);
  }
  return rows;
}

/** One consistent, read-only snapshot of all included tables, hashed row by row. */
async function takeSnapshot(prisma, schema, exclude) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'UTC'`); // identical timestamp text on every run and server
    const { info, order, fingerprint } = await describeSchema(tx, schema, exclude);
    const rows = await readTables(tx, schema, order, info), hashes = {};
    for (const t of order) hashes[t] = new Map(rows[t].map(r => [rowKey(r, info[t].pk), sha256(stable(r))]));
    return { info, order, fingerprint, rows, hashes };
  }, { isolationLevel: 'RepeatableRead', timeout: 600000, maxWait: 60000 });
}

// ---------------------------------------------------------------------------------------------------------------
// Backup chain on disk
// ---------------------------------------------------------------------------------------------------------------
const manifestPath = (dir, id) => path.join(dir, id + '.manifest.json');
function readManifests(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.manifest.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
function chainTo(dir, headId) {
  const all = new Map(readManifests(dir).map(m => [m.id, m]));
  const chain = [];
  for (let m = all.get(headId); m; m = m.parent ? all.get(m.parent) : null) {
    chain.unshift(m);
    if (m.type === 'full') return chain;
    if (m.parent && !all.has(m.parent)) throw new Error(`Backup ${m.id} needs ${m.parent}, which is missing.`);
  }
  throw new Error('Backup ' + headId + ' not found or its chain has no full backup.');
}
function readState(dir, manifest, key) {
  const file = path.join(dir, manifest.files.state.name);
  const raw = fs.readFileSync(file);
  const buf = manifest.encrypted ? unseal(raw, key) : raw;
  return JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
}
function readOps(dir, manifest, key) {
  const raw = fs.readFileSync(path.join(dir, manifest.files.data.name));
  const buf = manifest.encrypted ? unseal(raw, key) : raw;
  return zlib.gunzipSync(buf).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}
const idNow = type => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '') + Date.now().toString().slice(-3) + 'Z-' + (type === 'full' ? 'full' : 'incr');

function withLock(dir, fn) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.lock');
  if (fs.existsSync(lock)) {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age < 6 * 3600 * 1000) throw new Error('Another backup is running (lock file ' + lock + '). If it crashed, delete the file.');
  }
  fs.writeFileSync(lock, String(process.pid));
  const release = () => { try { fs.unlinkSync(lock); } catch { /* already gone */ } };
  return Promise.resolve().then(fn).finally(release);
}

/** Creates a full or incremental backup. Returns { manifest, changed } */
async function createBackup({ url, schema = 'public', dir, type, exclude = DEFAULT_EXCLUDE, force = false, label = '', onStep = () => {} }) {
  const key = encryptionKey();
  onStep('key-ready');
  return withLock(dir, async () => {
    const manifests = readManifests(dir);
    const parent = type === 'incremental' ? manifests[manifests.length - 1] : null;
    if (type === 'incremental' && !parent) throw new Error('There is no backup to build on. Run a full backup first.');
    onStep('lock-held');
    const prisma = openDb(url);
    try {
      onStep('snapshot-begin');
      const snap = await takeSnapshot(prisma, schema, exclude);
      onStep('snapshot-done');
      if (parent && parent.schemaFingerprint !== snap.fingerprint && !force) throw new Error('The database structure changed since the last backup. Take a new full backup (or pass --force).');
      if (parent && !!parent.encrypted !== !!key && !force) throw new Error('Encryption setting differs from the previous backup in this chain. Use the same BACKUP_ENCRYPTION_KEY or start a new full backup.');
      const parentState = parent ? readState(dir, parent, key) : null;

      const lines = []; let upserts = 0, deletes = 0;
      const tablesMeta = {}; const state = {};
      for (const t of snap.order) {
        const pk = snap.info[t].pk, prev = parentState ? parentState[t] || {} : {}, now = {};
        let u = 0, d = 0;
        for (const row of snap.rows[t]) {
          const k = rowKey(row, pk), h = snap.hashes[t].get(k);
          now[k] = h;
          if (!parent || prev[k] !== h) { lines.push(JSON.stringify({ t, op: 'upsert', row })); u++; }
        }
        for (const k of Object.keys(prev)) if (!(k in now)) { lines.push(JSON.stringify({ t, op: 'delete', key: JSON.parse(k) })); d++; }
        state[t] = now; upserts += u; deletes += d;
        tablesMeta[t] = { rows: snap.rows[t].length, upserts: u, deletes: d, pk };
      }
      const id = idNow(type);
      const data = seal(gz(Buffer.from(lines.join('\n') + (lines.length ? '\n' : ''))), key);
      const stateFile = seal(gz(Buffer.from(JSON.stringify(state))), key);
      const dataName = id + '.data.jsonl.gz' + (key ? '.enc' : ''), stateName = id + '.state.json.gz' + (key ? '.enc' : '');
      const core = { format: FORMAT, id, type, createdAt: new Date().toISOString(), parent: parent ? parent.id : null, schema, schemaFingerprint: snap.fingerprint, encrypted: !!key, label };
      const files = { data: { name: dataName, sha256: sha256(data), bytes: data.length }, state: { name: stateName, sha256: sha256(stateFile), bytes: stateFile.length } };
      const chainHash = sha256((parent ? parent.chainHash : '') + stable(core) + files.data.sha256 + files.state.sha256);
      const manifest = { ...core, files, chainHash, stats: { tables: snap.order.length, rows: Object.values(tablesMeta).reduce((n, m) => n + m.rows, 0), upserts, deletes }, tables: tablesMeta, excluded: exclude };
      fs.writeFileSync(path.join(dir, dataName), data);
      fs.writeFileSync(path.join(dir, stateName), stateFile);
      fs.writeFileSync(manifestPath(dir, id), JSON.stringify(manifest, null, 2)); // manifest last: a crash leaves no half backup
      onStep('files-written');
      return { manifest, changed: upserts + deletes };
    } finally { await prisma.$disconnect(); }
  });
}

/** Checks hashes, chain links and readability of everything needed to restore `headId`. */
function verifyChain(dir, headId) {
  const key = encryptionKey(); const problems = []; const chain = chainTo(dir, headId);
  let prevHash = '';
  for (const m of chain) {
    for (const kind of ['data', 'state']) {
      const f = path.join(dir, m.files[kind].name);
      if (!fs.existsSync(f)) { problems.push(`${m.id}: missing ${m.files[kind].name}`); continue; }
      const buf = fs.readFileSync(f);
      if (sha256(buf) !== m.files[kind].sha256) problems.push(`${m.id}: ${kind} file was modified (checksum mismatch)`);
    }
    const { files, chainHash, stats, tables, excluded, ...core } = m;
    const expected = sha256(prevHash + stable({ format: core.format, id: core.id, type: core.type, createdAt: core.createdAt, parent: core.parent, schema: core.schema, schemaFingerprint: core.schemaFingerprint, encrypted: core.encrypted, label: core.label }) + m.files.data.sha256 + m.files.state.sha256);
    if (expected !== chainHash) problems.push(`${m.id}: chain hash does not match (backup edited or reordered)`);
    prevHash = chainHash;
    if (!problems.length) {
      try { const ops = readOps(dir, m, key); if (ops.length !== m.stats.upserts + m.stats.deletes) problems.push(`${m.id}: expected ${m.stats.upserts + m.stats.deletes} changes, found ${ops.length}`); }
      catch (e) { problems.push(`${m.id}: ${e.message}`); }
    }
  }
  return { ok: problems.length === 0, problems, chain };
}

/** Merges full + incrementals into the final row set. */
function mergeChain(dir, chain) {
  const key = encryptionKey(); const rows = {};
  for (const m of chain) {
    for (const op of readOps(dir, m, key)) {
      const pk = m.tables[op.t].pk; rows[op.t] = rows[op.t] || new Map();
      if (op.op === 'upsert') rows[op.t].set(rowKey(op.row, pk), op.row);
      else rows[op.t].delete(JSON.stringify(op.key));
    }
  }
  return rows;
}

/** Restores `headId` (default: newest) into a database. The target must already have the same structure. */
async function restoreBackup({ dir, url, schema = 'public', headId, replace = false, exclude = DEFAULT_EXCLUDE, safetyDir = null, log = () => {} }) {
  const manifests = readManifests(dir);
  if (!manifests.length) throw new Error('No backups found in ' + dir);
  const head = headId ? manifests.find(m => m.id === headId) : manifests[manifests.length - 1];
  if (!head) throw new Error('Backup ' + headId + ' not found.');
  const check = verifyChain(dir, head.id);
  if (!check.ok) throw new Error('Refusing to restore, the backup chain is damaged:\n  ' + check.problems.join('\n  '));
  const chain = check.chain, final = mergeChain(dir, chain);
  log(`Chain: ${chain.length} file set(s), ${chain.map(c => c.type).join(' + ')}; restoring state of ${head.createdAt}`);

  const prisma = openDb(url);
  try {
    const probe = await prisma.$transaction(async tx => ({ ...(await describeSchema(tx, schema, exclude)) }));
    if (probe.fingerprint !== head.schemaFingerprint) throw new Error('The target database structure differs from the backup. Create the target from the same migrations first (prisma db push).');
    let existing = 0;
    for (const t of probe.order) existing += (await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(schema)}.${q(t)}`))[0].n;
    if (existing > 0 && !replace) throw new Error(`The target already holds ${existing} rows. Restoring replaces them: pass --replace to confirm.`);
    if (existing > 0 && safetyDir) {
      log('Target is not empty: taking a safety backup of it first -> ' + safetyDir);
      await createBackup({ url, schema, dir: safetyDir, type: 'full', exclude, label: 'safety copy before restore of ' + head.id });
    }
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'UTC'`);
      let replica = true;
      try { await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`); } catch { replica = false; }
      for (const t of [...probe.order].reverse()) await tx.$executeRawUnsafe(`DELETE FROM ${q(schema)}.${q(t)}`);
      for (const t of probe.order) {
        const rows = [...(final[t] ? final[t].values() : [])]; if (!rows.length) continue;
        const cols = probe.info[t].columns.map(q).join(', ');
        for (let i = 0; i < rows.length; i += 400) {
          await tx.$executeRawUnsafe(`INSERT INTO ${q(schema)}.${q(t)} (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::${q(schema)}.${q(t)}, $1::jsonb)`, JSON.stringify(rows.slice(i, i + 400)));
        }
      }
      log(replica ? 'Restored with constraint checks deferred, FK order respected too.' : 'Restored in foreign-key order.');
    }, { timeout: 600000, maxWait: 60000, isolationLevel: 'Serializable' });

    // prove it: re-read the target and compare every row with the backup's final state
    const after = await takeSnapshot(prisma, schema, exclude);
    const mismatches = [];
    for (const t of probe.order) {
      const expectedHashes = new Map([...(final[t] ? final[t].entries() : [])].map(([k, row]) => [k, sha256(stable(row))]));
      const got = after.hashes[t];
      if (got.size !== expectedHashes.size) mismatches.push(`${t}: ${got.size} rows, expected ${expectedHashes.size}`);
      else for (const [k, h] of expectedHashes) if (got.get(k) !== h) { mismatches.push(`${t}: row ${k} differs`); break; }
    }
    return { head, tables: probe.order.length, rows: probe.order.reduce((n, t) => n + after.rows[t].length, 0), verified: mismatches.length === 0, mismatches };
  } finally { await prisma.$disconnect(); }
}

// ---------------------------------------------------------------------------------------------------------------
// Automatic policy and housekeeping
// ---------------------------------------------------------------------------------------------------------------
const DEFAULT_POLICY = { fullEveryDays: 7, maxIncrementals: 96, keepChains: 4 };

/** Decides what the scheduler should do next: a full backup (first run / old chain / long chain) or an incremental. */
function nextAutoType(dir, policy = DEFAULT_POLICY, now = Date.now()) {
  const all = readManifests(dir);
  if (!all.length) return { type: 'full', why: 'no backups yet' };
  const lastFullIdx = [...all].map(m => m.type).lastIndexOf('full');
  const lastFull = all[lastFullIdx], incrs = all.length - 1 - lastFullIdx;
  if (now - Date.parse(lastFull.createdAt) >= policy.fullEveryDays * 86400000) return { type: 'full', why: `last full backup is older than ${policy.fullEveryDays} days` };
  if (incrs >= policy.maxIncrementals) return { type: 'full', why: `chain already has ${incrs} incrementals` };
  return { type: 'incremental', why: `${incrs} incremental(s) since the last full backup` };
}

/** Removes whole old chains (never part of one), keeping the newest `keepChains`. Returns removed ids. */
function prune(dir, keepChains = DEFAULT_POLICY.keepChains) {
  const all = readManifests(dir), chains = [];
  for (const m of all) { if (m.type === 'full') chains.push([m]); else if (chains.length) chains[chains.length - 1].push(m); }
  const doomed = chains.slice(0, Math.max(0, chains.length - keepChains)).flat(), removed = [];
  for (const m of doomed) {
    for (const f of [m.files.data.name, m.files.state.name, m.id + '.manifest.json']) try { fs.unlinkSync(path.join(dir, f)); } catch { /* already gone */ }
    removed.push(m.id);
  }
  return removed;
}

function defaultRoot() { return process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups', 'munasabati', 'incremental'); }

module.exports = { DEFAULT_EXCLUDE, DEFAULT_POLICY, createBackup, restoreBackup, verifyChain, readManifests, chainTo, nextAutoType, prune, defaultRoot, openDb, describeSchema, takeSnapshot, encryptionKey, sha256 };
