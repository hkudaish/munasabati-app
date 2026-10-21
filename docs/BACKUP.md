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

## Restore
Restores are deliberately limited to **local** databases; production is recovered by restoring locally, checking the
result, and then loading it with the database provider's tools.
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
