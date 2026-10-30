-- Advance-notice exceptions and exceptional reschedules: a three-stage approval workflow (provider feasibility, customer price approval,
-- final confirmation), coordinator tasks, versioned offers, customer consents, notifications and an append-only history.
-- Additive only: no existing table is altered and no existing row is touched. The whole feature is off until the "booking_exceptions" feature is enabled.
-- Rollback (nothing else depends on these tables): drop them in reverse order, see docs/EXCEPTION_REQUESTS.md.

CREATE TABLE IF NOT EXISTS "ExceptionRequest" (
  "id" TEXT PRIMARY KEY,
  "number" TEXT NOT NULL UNIQUE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('NOTICE','RESCHEDULE')),
  "status" TEXT NOT NULL,
  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "vendorId" TEXT,
  "serviceId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "packageId" TEXT,
  "cityId" TEXT NOT NULL,
  "bookingRequestId" TEXT REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT,
  "requestedDate" TEXT NOT NULL,
  "requestedTime" TEXT NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "originalStartAt" TIMESTAMPTZ(3),
  "requiredNoticeMinutes" INTEGER NOT NULL,
  "remainingNoticeMinutes" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "urgencyDetails" TEXT NOT NULL DEFAULT '',
  "customerNotes" TEXT NOT NULL DEFAULT '',
  "contact" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "priority" SMALLINT NOT NULL DEFAULT 3,
  "assignedCoordinatorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "dueAt" TIMESTAMPTZ(3),
  "stateEnteredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "dedupKey" TEXT NOT NULL,
  "selection" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "body" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- one active request per customer, offer, kind and slot: a double submit (or a second tab) cannot create a duplicate
CREATE UNIQUE INDEX IF NOT EXISTS "ExceptionRequest_active_dedup_key" ON "ExceptionRequest" ("dedupKey") WHERE "status" NOT IN ('completed','rejected','customer_declined','cancelled','execution_unavailable');
CREATE INDEX IF NOT EXISTS "ExceptionRequest_customer_idx" ON "ExceptionRequest" ("customerId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ExceptionRequest_status_idx" ON "ExceptionRequest" ("status","dueAt");
CREATE INDEX IF NOT EXISTS "ExceptionRequest_vendor_idx" ON "ExceptionRequest" ("vendorId","status");
CREATE INDEX IF NOT EXISTS "ExceptionRequest_coordinator_idx" ON "ExceptionRequest" ("assignedCoordinatorId","status");
CREATE INDEX IF NOT EXISTS "ExceptionRequest_booking_idx" ON "ExceptionRequest" ("bookingRequestId");
CREATE INDEX IF NOT EXISTS "ExceptionRequest_offer_slot_idx" ON "ExceptionRequest" ("offerId","requestedDate");

-- Append-only history: who did what, when, and the state before and after.
CREATE TABLE IF NOT EXISTS "ExceptionEvent" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "actorId" TEXT,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "body" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ExceptionEvent_request_idx" ON "ExceptionEvent" ("requestId","createdAt");

-- The three mandatory stages and who must decide each of them.
CREATE TABLE IF NOT EXISTS "ExceptionApprovalStep" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "stage" TEXT NOT NULL CHECK ("stage" IN ('FEASIBILITY','CUSTOMER_PRICE','FINAL_CONFIRMATION')),
  "approverType" TEXT NOT NULL CHECK ("approverType" IN ('PROVIDER','PLATFORM','CUSTOMER','SYSTEM')),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','SUPERSEDED')),
  "offerId" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMPTZ(3),
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- one pending decision per stage, approver type and (for a package) component
CREATE UNIQUE INDEX IF NOT EXISTS "ExceptionApprovalStep_one_pending_key" ON "ExceptionApprovalStep" ("requestId","stage","approverType",COALESCE("offerId", '')) WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "ExceptionApprovalStep_request_idx" ON "ExceptionApprovalStep" ("requestId","stage");

-- A priced offer. Each re-negotiation is a new version; once it has been sent its money and terms never change.
CREATE TABLE IF NOT EXISTS "ExceptionOffer" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','SUPERSEDED','WITHDRAWN')),
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "baseAmount" INTEGER NOT NULL CHECK ("baseAmount" >= 0),
  "exceptionFee" INTEGER NOT NULL DEFAULT 0 CHECK ("exceptionFee" >= 0),
  "discount" INTEGER NOT NULL DEFAULT 0 CHECK ("discount" >= 0),
  "vatAmount" INTEGER NOT NULL DEFAULT 0 CHECK ("vatAmount" >= 0),
  "total" INTEGER NOT NULL CHECK ("total" >= 0),
  "previousTotal" INTEGER NOT NULL DEFAULT 0,
  "terms" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "expiresAt" TIMESTAMPTZ(3),
  "tokenHash" TEXT UNIQUE,
  "createdBy" TEXT NOT NULL,
  "supervisorId" TEXT,
  "sentAt" TIMESTAMPTZ(3),
  "decidedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("requestId","version")
);
CREATE INDEX IF NOT EXISTS "ExceptionOffer_request_idx" ON "ExceptionOffer" ("requestId","version" DESC);
CREATE INDEX IF NOT EXISTS "ExceptionOffer_expiry_idx" ON "ExceptionOffer" ("expiresAt") WHERE "status" = 'SENT';

-- The customer's explicit acknowledgements and decisions, with the exact wording they saw.
CREATE TABLE IF NOT EXISTS "CustomerConsent" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "offerId" TEXT REFERENCES "ExceptionOffer"("id") ON DELETE RESTRICT,
  "customerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('EXCEPTION_ACK','OFFER_ACCEPT','OFFER_DECLINE','OFFER_RENEGOTIATE')),
  "offerVersion" INTEGER,
  "textHash" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "ip" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerConsent_request_idx" ON "CustomerConsent" ("requestId","createdAt");

-- Booking coordinators: one task per exception, with a response target and an escalation level.
CREATE TABLE IF NOT EXISTS "CoordinatorTask" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "coordinatorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  "priority" SMALLINT NOT NULL DEFAULT 3,
  "dueAt" TIMESTAMPTZ(3) NOT NULL,
  "escalationLevel" SMALLINT NOT NULL DEFAULT 0,
  "escalatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoordinatorTask_one_open_key" ON "CoordinatorTask" ("requestId") WHERE "status" IN ('OPEN','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS "CoordinatorTask_coordinator_idx" ON "CoordinatorTask" ("coordinatorId","status","dueAt");

CREATE TABLE IF NOT EXISTS "NegotiationLog" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "taskId" TEXT REFERENCES "CoordinatorTask"("id") ON DELETE RESTRICT,
  "actorId" TEXT NOT NULL,
  "channel" TEXT NOT NULL CHECK ("channel" IN ('PHONE','WHATSAPP','SMS','EMAIL','NOTE')),
  "party" TEXT NOT NULL CHECK ("party" IN ('CUSTOMER','VENDOR','INTERNAL')),
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NegotiationLog_request_idx" ON "NegotiationLog" ("requestId","createdAt");

-- Roles for staff who are not full administrators (a coordinator can work the exception queue and nothing else).
CREATE TABLE IF NOT EXISTS "StaffRole" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL CHECK ("role" IN ('COORDINATOR','BOOKING_SUPERVISOR','SUPPORT')),
  "grantedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId","role")
);

-- Escalation windows and thresholds, editable by the system administrators.
CREATE TABLE IF NOT EXISTS "ExceptionConfig" (
  "key" TEXT PRIMARY KEY,
  "body" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every message about an exception (or a vendor approval, which has no request), once per recipient, event and channel. Also the in-app inbox.
CREATE TABLE IF NOT EXISTS "ExceptionNotification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requestId" TEXT REFERENCES "ExceptionRequest"("id") ON DELETE RESTRICT,
  "event" TEXT NOT NULL,
  "channel" TEXT NOT NULL CHECK ("channel" IN ('inbox','email','sms','whatsapp')),
  "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','SENT','FAILED','SKIPPED')),
  "dedupKey" TEXT NOT NULL UNIQUE,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "detail" TEXT NOT NULL DEFAULT '',
  "readAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ExceptionNotification_user_idx" ON "ExceptionNotification" ("userId","channel","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ExceptionNotification_queue_idx" ON "ExceptionNotification" ("status","channel") WHERE "status" = 'QUEUED';

-- Vendor account approval is separate from the operational status (Vendor.status) and from the approval of each published service.
CREATE TABLE IF NOT EXISTS "VendorApproval" (
  "vendorId" TEXT PRIMARY KEY REFERENCES "Vendor"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','INFO_REQUIRED','APPROVED','REJECTED','ON_HOLD')),
  "note" TEXT NOT NULL DEFAULT '',
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "VendorApprovalEvent" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VendorApprovalEvent_vendor_idx" ON "VendorApprovalEvent" ("vendorId","createdAt");
-- Vendors that already exist keep working: those that are active are recorded as approved, the rest as pending.
INSERT INTO "VendorApproval" ("vendorId","state","decidedAt")
SELECT v."id", CASE WHEN v."status" = 'ACTIVE' THEN 'APPROVED' ELSE 'PENDING' END, CASE WHEN v."status" = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE NULL END FROM "Vendor" v
ON CONFLICT ("vendorId") DO NOTHING;

-- Approvals, decisions, consents and logs are history: they can be added to, never edited or deleted.
CREATE OR REPLACE FUNCTION exception_record_immutable() RETURNS trigger AS $fn$
BEGIN RAISE EXCEPTION '% rows cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = '23000'; END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS exception_event_immutable ON "ExceptionEvent";
CREATE TRIGGER exception_event_immutable BEFORE UPDATE OR DELETE ON "ExceptionEvent" FOR EACH ROW EXECUTE FUNCTION exception_record_immutable();
DROP TRIGGER IF EXISTS customer_consent_immutable ON "CustomerConsent";
CREATE TRIGGER customer_consent_immutable BEFORE UPDATE OR DELETE ON "CustomerConsent" FOR EACH ROW EXECUTE FUNCTION exception_record_immutable();
DROP TRIGGER IF EXISTS negotiation_log_immutable ON "NegotiationLog";
CREATE TRIGGER negotiation_log_immutable BEFORE UPDATE OR DELETE ON "NegotiationLog" FOR EACH ROW EXECUTE FUNCTION exception_record_immutable();
DROP TRIGGER IF EXISTS vendor_approval_event_immutable ON "VendorApprovalEvent";
CREATE TRIGGER vendor_approval_event_immutable BEFORE UPDATE OR DELETE ON "VendorApprovalEvent" FOR EACH ROW EXECUTE FUNCTION exception_record_immutable();

-- A decided approval step keeps its decision; only a pending one can still be decided or superseded.
CREATE OR REPLACE FUNCTION exception_step_frozen() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% rows cannot be deleted', TG_TABLE_NAME USING ERRCODE = '23000'; END IF;
  IF OLD."status" <> 'PENDING' AND (NEW."status" IS DISTINCT FROM OLD."status" OR NEW."decidedBy" IS DISTINCT FROM OLD."decidedBy" OR NEW."note" IS DISTINCT FROM OLD."note") THEN
    RAISE EXCEPTION 'a decided approval step cannot be changed' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS exception_step_frozen ON "ExceptionApprovalStep";
CREATE TRIGGER exception_step_frozen BEFORE UPDATE OR DELETE ON "ExceptionApprovalStep" FOR EACH ROW EXECUTE FUNCTION exception_step_frozen();

-- A sent offer is what the customer agreed to: its price, date and terms are frozen; only its status can move on.
CREATE OR REPLACE FUNCTION exception_offer_frozen() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% rows cannot be deleted', TG_TABLE_NAME USING ERRCODE = '23000'; END IF;
  IF OLD."status" <> 'DRAFT' AND (NEW."startAt" IS DISTINCT FROM OLD."startAt" OR NEW."baseAmount" IS DISTINCT FROM OLD."baseAmount" OR NEW."exceptionFee" IS DISTINCT FROM OLD."exceptionFee"
     OR NEW."discount" IS DISTINCT FROM OLD."discount" OR NEW."vatAmount" IS DISTINCT FROM OLD."vatAmount" OR NEW."total" IS DISTINCT FROM OLD."total" OR NEW."terms" IS DISTINCT FROM OLD."terms"
     OR NEW."version" IS DISTINCT FROM OLD."version" OR NEW."requestId" IS DISTINCT FROM OLD."requestId") THEN
    RAISE EXCEPTION 'a sent offer cannot be changed; issue a new version' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS exception_offer_frozen ON "ExceptionOffer";
CREATE TRIGGER exception_offer_frozen BEFORE UPDATE OR DELETE ON "ExceptionOffer" FOR EACH ROW EXECUTE FUNCTION exception_offer_frozen();
