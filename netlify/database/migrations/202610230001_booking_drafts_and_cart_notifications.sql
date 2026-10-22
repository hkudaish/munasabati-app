-- Booking drafts with immutable versioned snapshots, cart price history and change events, a transactional outbox,
-- notification jobs with delivery attempts and consent. Additive: no existing table or row is removed or rewritten.
-- Ids are TEXT like every other table in this database.

-- ---------------------------------------------------------------------------------------------------------- booking drafts
CREATE TABLE IF NOT EXISTS "BookingDraft" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "guestTokenHash" TEXT,
  "serviceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStep" TEXT NOT NULL DEFAULT 'configure',
  "version" INTEGER NOT NULL DEFAULT 0,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "latestSnapshotId" TEXT,
  "cartLineId" TEXT,
  "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookingDraft_userId_status_idx" ON "BookingDraft" ("userId","status");
CREATE INDEX IF NOT EXISTS "BookingDraft_guestTokenHash_idx" ON "BookingDraft" ("guestTokenHash");
CREATE INDEX IF NOT EXISTS "BookingDraft_serviceId_idx" ON "BookingDraft" ("serviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingDraft_cartLineId_key" ON "BookingDraft" ("cartLineId") WHERE "cartLineId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "BookingSnapshot" (
  "id" TEXT PRIMARY KEY,
  "draftId" TEXT NOT NULL REFERENCES "BookingDraft"("id") ON DELETE RESTRICT,
  "versionNumber" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "hash" TEXT NOT NULL,
  "changedFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "previousSnapshotId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingSnapshot_draft_version_key" ON "BookingSnapshot" ("draftId","versionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingSnapshot_id_draft_key" ON "BookingSnapshot" ("id","draftId");

DO $$
BEGIN
  -- a snapshot's predecessor and a draft's latest snapshot must belong to the same draft
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingSnapshot_previous_same_draft' AND conrelid = to_regclass('"BookingSnapshot"')) THEN
    ALTER TABLE "BookingSnapshot" ADD CONSTRAINT "BookingSnapshot_previous_same_draft" FOREIGN KEY ("previousSnapshotId","draftId") REFERENCES "BookingSnapshot"("id","draftId") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_latest_same_draft' AND conrelid = to_regclass('"BookingDraft"')) THEN
    ALTER TABLE "BookingDraft" ADD CONSTRAINT "BookingDraft_latest_same_draft" FOREIGN KEY ("latestSnapshotId","id") REFERENCES "BookingSnapshot"("id","draftId") DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ------------------------------------------------------------------------------------------------- cart price history
CREATE TABLE IF NOT EXISTS "CartPriceSnapshot" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "lineId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "totalHalala" BIGINT NOT NULL,
  "breakdown" JSONB NOT NULL,
  "pricingVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CartPriceSnapshot_user_line_idx" ON "CartPriceSnapshot" ("userId","lineId","createdAt");

CREATE TABLE IF NOT EXISTS "CartPriceChange" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "lineId" TEXT NOT NULL,
  "previousSnapshotId" TEXT NOT NULL REFERENCES "CartPriceSnapshot"("id") ON DELETE RESTRICT,
  "newSnapshotId" TEXT NOT NULL UNIQUE REFERENCES "CartPriceSnapshot"("id") ON DELETE RESTRICT,
  "direction" TEXT NOT NULL,
  "differenceHalala" BIGINT NOT NULL,
  "differencePercent" NUMERIC(12,4),
  "reasonCode" TEXT NOT NULL,
  "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMPTZ(3)
);
CREATE INDEX IF NOT EXISTS "CartPriceChange_user_idx" ON "CartPriceChange" ("userId","acknowledgedAt");

-- ----------------------------------------------------------------------------------------------- transactional outbox
CREATE TABLE IF NOT EXISTS "DomainOutbox" (
  "id" TEXT PRIMARY KEY,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL DEFAULT 0,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT
);
CREATE INDEX IF NOT EXISTS "DomainOutbox_status_next_idx" ON "DomainOutbox" ("status","nextAttemptAt");

-- ------------------------------------------------------------------------------------- notifications (jobs, attempts, consent)
CREATE TABLE IF NOT EXISTS "CartNotificationSetting" (
  "id" TEXT PRIMARY KEY,
  "body" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId","channel")
);

CREATE TABLE IF NOT EXISTS "NotificationJob" (
  "id" TEXT PRIMARY KEY,
  "outboxEventId" TEXT REFERENCES "DomainOutbox"("id") ON DELETE SET NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "lineId" TEXT,
  "template" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMPTZ(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "dedupKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationJob_dedupKey_key" ON "NotificationJob" ("dedupKey");
CREATE INDEX IF NOT EXISTS "NotificationJob_status_scheduled_idx" ON "NotificationJob" ("status","scheduledAt");
CREATE INDEX IF NOT EXISTS "NotificationJob_userId_idx" ON "NotificationJob" ("userId");

CREATE TABLE IF NOT EXISTS "NotificationAttempt" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "NotificationJob"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL,
  "errorCode" TEXT,
  "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotificationAttempt_jobId_idx" ON "NotificationAttempt" ("jobId");

-- cart activity and the language the customer was using (reminders are written in it)
ALTER TABLE "CommerceCart" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CommerceCart" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'ar';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_one_owner' AND conrelid = to_regclass('"BookingDraft"')) THEN ALTER TABLE "BookingDraft" ADD CONSTRAINT "BookingDraft_one_owner" CHECK (("userId" IS NOT NULL) <> ("guestTokenHash" IS NOT NULL)); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_version' AND conrelid = to_regclass('"BookingDraft"')) THEN ALTER TABLE "BookingDraft" ADD CONSTRAINT "BookingDraft_version" CHECK ("version" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_status' AND conrelid = to_regclass('"BookingDraft"')) THEN ALTER TABLE "BookingDraft" ADD CONSTRAINT "BookingDraft_status" CHECK ("status" IN ('IN_PROGRESS','IN_CART','ABANDONED','EXPIRED','PURCHASED','DISCARDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingSnapshot_version' AND conrelid = to_regclass('"BookingSnapshot"')) THEN ALTER TABLE "BookingSnapshot" ADD CONSTRAINT "BookingSnapshot_version" CHECK ("versionNumber" >= 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CartPriceChange_direction' AND conrelid = to_regclass('"CartPriceChange"')) THEN ALTER TABLE "CartPriceChange" ADD CONSTRAINT "CartPriceChange_direction" CHECK ("direction" IN ('INCREASE','DECREASE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DomainOutbox_status' AND conrelid = to_regclass('"DomainOutbox"')) THEN ALTER TABLE "DomainOutbox" ADD CONSTRAINT "DomainOutbox_status" CHECK ("status" IN ('PENDING','DONE','DEAD')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationJob_status' AND conrelid = to_regclass('"NotificationJob"')) THEN ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_status" CHECK ("status" IN ('PENDING','SENT','SKIPPED','DEAD')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationJob_channel' AND conrelid = to_regclass('"NotificationJob"')) THEN ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_channel" CHECK ("channel" IN ('inbox','email')); END IF;
END $$;

-- ------------------------------------------------------------------------------------------------------- immutability
CREATE OR REPLACE FUNCTION booking_history_immutable() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = '23000';
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS booking_snapshot_immutable ON "BookingSnapshot";
CREATE TRIGGER booking_snapshot_immutable BEFORE UPDATE OR DELETE ON "BookingSnapshot" FOR EACH ROW EXECUTE FUNCTION booking_history_immutable();
DROP TRIGGER IF EXISTS cart_price_snapshot_immutable ON "CartPriceSnapshot";
CREATE TRIGGER cart_price_snapshot_immutable BEFORE UPDATE OR DELETE ON "CartPriceSnapshot" FOR EACH ROW EXECUTE FUNCTION booking_history_immutable();
