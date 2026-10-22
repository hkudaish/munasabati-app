-- Availability policies, geography-scoped restrictions, schedules, append-only audit log, interest registrations and
-- public statistics settings. Additive and idempotent: no existing data is read, changed or removed.
CREATE TABLE IF NOT EXISTS "AvailabilityPolicy" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "configuredStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "visibilityMode" TEXT NOT NULL DEFAULT 'AUTO',
  "bookingMode" TEXT NOT NULL DEFAULT 'ENABLED',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "restrictionConfig" JSONB NOT NULL DEFAULT '{}',
  "suspensionPolicy" JSONB NOT NULL DEFAULT '{}',
  "publicMessage" JSONB NOT NULL DEFAULT '{}',
  "effectiveFrom" TIMESTAMPTZ(3),
  "effectiveUntil" TIMESTAMPTZ(3),
  "autoActivate" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS "AvailabilityGeoRule" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "policyId" TEXT NOT NULL REFERENCES "AvailabilityPolicy"("id") ON DELETE CASCADE,
  "countryCode" TEXT REFERENCES "GeoCountry"("code") ON DELETE CASCADE,
  "regionId" TEXT REFERENCES "GeoRegion"("id") ON DELETE CASCADE,
  "cityId" TEXT REFERENCES "SaudiCity"("id") ON DELETE CASCADE,
  "geographicEffect" TEXT NOT NULL DEFAULT 'ALLOW',
  "statusOverride" TEXT,
  "restrictionConfig" JSONB NOT NULL DEFAULT '{}',
  "effectiveFrom" TIMESTAMPTZ(3),
  "effectiveUntil" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AvailabilitySchedule" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "policyId" TEXT NOT NULL REFERENCES "AvailabilityPolicy"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'OPERATING',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  "startTime" TEXT,
  "endTime" TEXT,
  "dayOfWeek" INTEGER,
  "recurrenceRule" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "maxBookings" INTEGER,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS "AvailabilityAuditLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "policyId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "previousValue" JSONB,
  "newValue" JSONB,
  "actorId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AvailabilityInterest" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "serviceId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL REFERENCES "SaudiCity"("id") ON DELETE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "contactPreference" TEXT NOT NULL DEFAULT 'NONE',
  "consentAt" TIMESTAMPTZ(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "PublicStatsConfig" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "cards" JSONB NOT NULL DEFAULT '[]',
  "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
  "cityId" TEXT,
  "period" TEXT NOT NULL DEFAULT 'ALL',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- indexes and uniqueness (one policy per entity per start time; one rule per place; one interest per customer/service/city)
CREATE INDEX IF NOT EXISTS "AvailabilityPolicy_entityType_entityId_idx" ON "AvailabilityPolicy" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AvailabilityPolicy_configuredStatus_idx" ON "AvailabilityPolicy" ("configuredStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityPolicy_entity_start_key" ON "AvailabilityPolicy" ("entityType", "entityId", COALESCE("effectiveFrom", '-infinity'::timestamptz));
CREATE INDEX IF NOT EXISTS "AvailabilityGeoRule_policyId_idx" ON "AvailabilityGeoRule" ("policyId");
CREATE INDEX IF NOT EXISTS "AvailabilityGeoRule_cityId_idx" ON "AvailabilityGeoRule" ("cityId");
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityGeoRule_place_key" ON "AvailabilityGeoRule" ("policyId", COALESCE("countryCode", ''), COALESCE("regionId", ''), COALESCE("cityId", ''));
CREATE INDEX IF NOT EXISTS "AvailabilitySchedule_policyId_idx" ON "AvailabilitySchedule" ("policyId");
CREATE INDEX IF NOT EXISTS "AvailabilityAuditLog_policyId_createdAt_idx" ON "AvailabilityAuditLog" ("policyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AvailabilityAuditLog_entity_createdAt_idx" ON "AvailabilityAuditLog" ("entityType", "entityId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityInterest_serviceId_cityId_customerId_key" ON "AvailabilityInterest" ("serviceId", "cityId", "customerId");
CREATE INDEX IF NOT EXISTS "AvailabilityInterest_serviceId_cityId_status_idx" ON "AvailabilityInterest" ("serviceId", "cityId", "status");

-- value and time-range checks (added only when missing, so this file also works on a schema created by prisma db push)
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('AvailabilityPolicy', 'AvailabilityPolicy_entityType_check', $c$"entityType" IN ('PLATFORM','MODULE','CATEGORY','SERVICE','OFFER','VENDOR','PACKAGE')$c$),
    ('AvailabilityPolicy', 'AvailabilityPolicy_status_check', $c$"configuredStatus" IN ('ACTIVE','PARTIALLY_AVAILABLE','COMING_SOON','TEMPORARILY_SUSPENDED','DISABLED','MAINTENANCE')$c$),
    ('AvailabilityPolicy', 'AvailabilityPolicy_visibility_check', $c$"visibilityMode" IN ('VISIBLE','HIDDEN','AUTO')$c$),
    ('AvailabilityPolicy', 'AvailabilityPolicy_booking_check', $c$"bookingMode" IN ('ENABLED','DISABLED','CONDITIONAL')$c$),
    ('AvailabilityPolicy', 'AvailabilityPolicy_window_check', $c$"effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom"$c$),
    ('AvailabilityPolicy', 'AvailabilityPolicy_json_check', $c$jsonb_typeof("restrictionConfig") = 'object' AND jsonb_typeof("suspensionPolicy") = 'object' AND jsonb_typeof("publicMessage") = 'object'$c$),
    ('AvailabilityGeoRule', 'AvailabilityGeoRule_effect_check', $c$"geographicEffect" IN ('ALLOW','DENY','INHERIT')$c$),
    ('AvailabilityGeoRule', 'AvailabilityGeoRule_status_check', $c$"statusOverride" IS NULL OR "statusOverride" IN ('ACTIVE','PARTIALLY_AVAILABLE','COMING_SOON','TEMPORARILY_SUSPENDED','DISABLED','MAINTENANCE')$c$),
    ('AvailabilityGeoRule', 'AvailabilityGeoRule_place_check', $c$"countryCode" IS NOT NULL OR "regionId" IS NOT NULL OR "cityId" IS NOT NULL$c$),
    ('AvailabilityGeoRule', 'AvailabilityGeoRule_window_check', $c$"effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom"$c$),
    ('AvailabilitySchedule', 'AvailabilitySchedule_kind_check', $c$"kind" IN ('OPERATING','EXCEPTION','HOLIDAY','MAINTENANCE')$c$),
    ('AvailabilitySchedule', 'AvailabilitySchedule_day_check', $c$"dayOfWeek" IS NULL OR "dayOfWeek" BETWEEN 0 AND 6$c$),
    ('AvailabilitySchedule', 'AvailabilitySchedule_time_check', $c$("startTime" IS NULL OR "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND ("endTime" IS NULL OR "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR "endTime" = '24:00')$c$),
    ('AvailabilitySchedule', 'AvailabilitySchedule_dates_check', $c$("startDate" IS NULL OR "startDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AND ("endDate" IS NULL OR "endDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AND ("startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate")$c$),
    ('AvailabilitySchedule', 'AvailabilitySchedule_max_check', $c$"maxBookings" IS NULL OR "maxBookings" >= 0$c$),
    ('AvailabilityInterest', 'AvailabilityInterest_contact_check', $c$"contactPreference" IN ('EMAIL','PHONE','WHATSAPP','NONE')$c$),
    ('AvailabilityInterest', 'AvailabilityInterest_status_check', $c$"status" IN ('ACTIVE','NOTIFIED','CANCELLED')$c$),
    ('PublicStatsConfig', 'PublicStatsConfig_scope_check', $c$"scope" IN ('GLOBAL','CITY') AND "period" IN ('ALL','YEAR','QUARTER','MONTH')$c$)
  ) AS t(tbl, cname, expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.cname AND conrelid = to_regclass(format('%I', c.tbl))) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)', c.tbl, c.cname, c.expr);
    END IF;
  END LOOP;
END $$;

-- the audit log can only grow
CREATE OR REPLACE FUNCTION availability_audit_immutable() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'AvailabilityAuditLog is append-only';
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS availability_audit_immutable ON "AvailabilityAuditLog";
CREATE TRIGGER availability_audit_immutable BEFORE UPDATE OR DELETE ON "AvailabilityAuditLog" FOR EACH ROW EXECUTE FUNCTION availability_audit_immutable();
