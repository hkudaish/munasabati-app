# Backups: incremental, automatic and manual

Two complementary tools:

| | `npm run db:backup` | `npm run backup:*` (this document) |
|---|---|---|
| What | one complete `pg_dump` file | a chain: one full snapshot, then small incrementals |
| Size per run | whole database | only what changed |
| Restore | `pg_restore` | any point in the chain, verified row by row |
| Good for | a manual safety copy before risky work | frequent, automatic protection |

## How incremental backups work
- Every run reads all tables in **one read-only, consistent snapshot** (the app is never blocked or changed).
- A **full** backup stores every row. An **incremental** stores only rows that were added or changed since the
  previous backup, and the keys of rows that were deleted. A row's identity is its primary key; "changed" means its
  SHA-256 differs from the previous backup's.
- Files are gzip-compressed and, when `BACKUP_ENCRYPTION_KEY` is set, **AES-256-GCM encrypted**. Each backup records
  the checksums of its files and a chain hash linking it to its parent, so a modified, missing or reordered file is
  detected before anything is restored.
- Sessions and login-attempt counters (`AuthSession`, `AuthAttempt`, `SystemSetupToken`) are **never** backed up, so
  a restore cannot revive logins that were signed out.
- A change in the database structure (a new migration) forces a new full backup; the chain is never continued
  across a different structure.

Example from the local database: full backup 550 rows / 39 KB; after a real purchase flow (8 orders, bookings,
reservations, finance entries) the incremental held 126 changes in 11 KB; restoring the chain into a fresh database
gave 673 rows, identical to the live database.

## Admin page: backups in the cloud, with a safe restore
**Administration > النسخ الاحتياطي** (`/admin/backups`, also in the account menu) manages backups kept on Netlify
(Netlify Blobs, private to the site), independent of your computer.

- **Hourly and automatic.** A Netlify scheduled function (`netlify/functions/backup-schedule.mjs`) calls the app every
  hour; the app takes a full or incremental backup, verifies it and prunes old chains, exactly like `backup:auto`.
  The page shows the health (OK / late / stopped), the newest backup, storage, encryption and the schedule, and warns
  when the key or the schedule is not configured.
- **Back up now, verify.** Super administrators can run a backup immediately and verify any backup.
- **Restore = preview, request, approval.**
  1. *Preview* compares a backup with the live data and changes nothing: how many rows would come back, disappear or
     revert, per table.
  2. A **super administrator requests** the restore (typing `RESTORE`).
  3. A **different administrator approves** it (typing `RESTORE`) within 30 minutes. Nobody can approve their own request.
  4. A safety backup of the current data is taken first, then everything is replaced in one transaction, re-read and
     verified row by row. If anything fails nothing changes.
- **After a restore** every session is revoked (everyone signs in again). The administration **audit log is preserved**:
  entries written after the backup are kept, so a restore can never erase the record of what happened.
- Every action (run, verify, preview, request, approve, cancel, result) is written to the audit log.
- The command line still works for your local copy; restores of the live site go through this page.

### One-time cloud setup (Netlify site settings > Environment variables)
| Variable | Value |
|---|---|
| `BACKUP_ENCRYPTION_KEY` | the same key as in your `.env` (`node scripts/backup.cjs keygen`). Without it the live site refuses to create backups. |
| `BACKUP_CRON_TOKEN` | a long random string; the scheduled function sends it so only Netlify can trigger the hourly run. |
Then deploy. The page shows "schedule: hourly" once both are set. Keep the key in a password manager as well.

Limits: a backup run must finish within the host's function time limit (about 26 seconds); this database takes about
one second there. When the data grows far beyond that, use the provider's point-in-time recovery or move the run to a
background function.

## Setup (once)
```
node scripts/backup.cjs keygen        # prints BACKUP_ENCRYPTION_KEY=...
```
Put that line in `.env` and **keep a copy somewhere safe** (a password manager). Without the key, encrypted backups
cannot be read; without any key the files are plain text and contain customer data and password hashes.

Backups go to `~/Backups/munasabati/incremental/<target>/` (change with `BACKUP_DIR` or `--dir`). Keep that folder
outside the repository and on a different disk or cloud-synced folder if you can.

## Manual use
```
npm run backup:full                         # start a chain
npm run backup:incremental                  # only changes since the last backup
npm run backup:list                         # what exists
npm run backup:verify                       # checksums + chain links (add --id <backup> for an older one)
npm run backup:auto                         # what the scheduler runs (see below)
```
Add `-- --target production` to back up the live database (read-only; the connection is fetched through the
Netlify login on this machine and is never printed or saved). The default target is the local database.

## Automatic
`backup:auto` decides by itself: first run a full backup, then incrementals; a new full backup every 7 days or after
96 incrementals; it verifies what it wrote, deletes whole chains older than the newest 4 (never part of a chain),
logs to `backup.log`, and exits non-zero on any failure. If the structure changed or the key changed it starts a new
chain instead of failing.

Windows (runs while you are signed in; nothing is stored):
```
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -Target production
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -Target production -Remove
```
Hourly by default (`-EveryMinutes 30` for more often). A missed run starts as soon as the computer is back.
Linux/macOS: `0 * * * * cd /path/to/repo && node scripts/backup.cjs auto --target production`.
A machine that is always on (a small server) is better than a laptop for production backups.

## Troubleshooting a scheduled run
`backup.log` (in the backup folder) has one JSON line per run. Set `BACKUP_TRACE=1` to also log each stage
(`start`, `url-resolved`, `snapshot-begin`, `snapshot-done`, `files-written`), which shows where a slow or stuck run
is. A production run takes about 20 seconds from a slow connection (tables are read in a few batched requests, not
one request per table). A run that is killed halfway leaves a `.lock` file; it is ignored after 6 hours, or delete it.

## Restore
The command line restores only into **local** databases. The live site is restored from the admin page (preview, request,
second administrator's approval); the command line can also restore a copy locally to inspect it.
```
# 1. an empty local database with the same structure (createdb restore_check, then apply the repo's schema)
DATABASE_URL=postgresql://.../restore_check npx prisma db push
# 2. restore the newest backup, or an earlier one with --id <backup id> (point in time)
npm run backup:restore -- --to-url postgresql://.../restore_check --target production
```
- A restore refuses a non-empty database unless `--replace` is given, and then first takes a safety copy of what it
  is about to replace (`pre-restore/` folder).
- It re-reads the database afterwards and compares every row with the backup; it reports `VERIFIED` or lists the
  mismatches.
- Wrong key, damaged file, missing link or a different structure: it stops before touching anything.

## Limits
- Rows are loaded in memory, which suits this database (hundreds of thousands of rows at most). For multi-gigabyte
  data use the provider's point-in-time recovery.
- Intervals are only as frequent as the schedule; changes between two backups are not recoverable individually.
- Binary large objects and database-level objects (roles, extensions) are not included; structure comes from migrations.
- `npm run test:backup` exercises all of this against throwaway schemas (15 checks).
