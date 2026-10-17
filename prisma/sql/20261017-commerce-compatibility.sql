-- Additive compatibility upgrade for older local schemas and safe defaults for new orders.
-- Existing rows and amounts are retained. Newly introduced payment state stays UNPAID
-- until historical gateway records are reconciled; migration never invents payment success.
BEGIN;
-- CreateEnum
DO $$ BEGIN CREATE TYPE "OMSOrderStatus" AS ENUM ('CREATED', 'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ROUTING_TO_SUPPLIER', 'AWAITING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER_REVIEW', 'COMPLETED', 'CLOSED', 'REJECTED', 'UNRESPONSIVE_VENDOR', 'ASSIGNMENT_FAILED', 'AWAITING_CUSTOMER_INFO', 'EXTENSION_REQUESTED', 'AT_RISK', 'DELAYED', 'PAUSED', 'REASSIGNMENT_REQUESTED', 'MODIFICATION_REQUESTED', 'DISPUTED', 'CANCEL_REQUESTED', 'CANCELLED', 'PENDING_REFUND', 'REFUNDED', 'UNFULFILLABLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING_PAYMENT', 'PROCESSING', 'PAID', 'PAYMENT_FAILED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED', 'DISPUTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExceptionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
DO $$ DECLARE upgrading boolean := NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'MultiVendorOrder' AND column_name = 'omsStatus');
BEGIN
ALTER TABLE "MultiVendorOrder" ADD COLUMN IF NOT EXISTS "omsStatus" "OMSOrderStatus" NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ALTER COLUMN "status" SET DEFAULT 'requested';
IF upgrading THEN
UPDATE "MultiVendorOrder" SET "omsStatus" = CASE WHEN "status" = 'completed' THEN 'COMPLETED'::"OMSOrderStatus" WHEN "status" = 'cancelled' THEN 'CANCELLED'::"OMSOrderStatus" WHEN "status" = 'in_preparation' THEN 'IN_PROGRESS'::"OMSOrderStatus" ELSE 'AWAITING_ACCEPTANCE'::"OMSOrderStatus" END;
END IF;
END $$;

-- AlterTable
DO $$ DECLARE upgrading boolean := NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Suborder' AND column_name = 'omsStatus');
BEGIN
ALTER TABLE "Suborder" ADD COLUMN IF NOT EXISTS "acceptanceDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "assignedRole" TEXT NOT NULL DEFAULT 'vendor',
ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationReasonAr" TEXT,
ADD COLUMN IF NOT EXISTS "customerReviewDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "delayReasonAr" TEXT,
ADD COLUMN IF NOT EXISTS "deliverablesUrl" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "disputeReasonAr" TEXT,
ADD COLUMN IF NOT EXISTS "fulfillmentDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isAtRisk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isDelayed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "nextAction" TEXT NOT NULL DEFAULT 'VENDOR_ACCEPTANCE',
ADD COLUMN IF NOT EXISTS "nextActionDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "omsStatus" "OMSOrderStatus" NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
ADD COLUMN IF NOT EXISTS "proofOfDelivery" TEXT,
ADD COLUMN IF NOT EXISTS "slaExtensionDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "slaOriginalDeadline" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';
IF upgrading THEN
UPDATE "Suborder" SET "omsStatus" = CASE "status"::text WHEN 'CONFIRMED' THEN 'ACCEPTED'::"OMSOrderStatus" WHEN 'IN_PREPARATION' THEN 'IN_PROGRESS'::"OMSOrderStatus" WHEN 'COMPLETED' THEN 'COMPLETED'::"OMSOrderStatus" WHEN 'CANCELLED' THEN 'CANCELLED'::"OMSOrderStatus" WHEN 'DISPUTED' THEN 'DISPUTED'::"OMSOrderStatus" ELSE 'AWAITING_ACCEPTANCE'::"OMSOrderStatus" END;
END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OMSOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "suborderId" TEXT,
    "fromState" "OMSOrderStatus" NOT NULL,
    "toState" "OMSOrderStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL DEFAULT 'SYSTEM',
    "noteAr" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OMSOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OMSException" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "suborderId" TEXT,
    "issueType" TEXT NOT NULL,
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "assignedRole" TEXT NOT NULL DEFAULT 'OPERATIONS',
    "assignedUserId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctiveActionAr" TEXT NOT NULL,
    "resolutionDeadline" TIMESTAMP(3),
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotesAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OMSException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OMSAutomationConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "acceptanceDeadlineMinutes" INTEGER NOT NULL DEFAULT 120,
    "executionNoticeDays" INTEGER NOT NULL DEFAULT 2,
    "customerReviewDeadlineHours" INTEGER NOT NULL DEFAULT 48,
    "alert50PercentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alert75PercentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alert90PercentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alert100PercentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReassignOnTimeout" BOOLEAN NOT NULL DEFAULT true,
    "maxInactivityHours" INTEGER NOT NULL DEFAULT 24,
    "routingWeights" JSONB,
    "escalationPolicy" JSONB,
    "businessHoursConfig" JSONB,
    "deliveryProofRequired" BOOLEAN NOT NULL DEFAULT true,
    "autoClosePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OMSAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseData" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OMSNotificationLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "suborderId" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OMSNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSOrderEvent_orderId_idx" ON "OMSOrderEvent"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSOrderEvent_suborderId_idx" ON "OMSOrderEvent"("suborderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSOrderEvent_createdAt_idx" ON "OMSOrderEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSException_orderId_idx" ON "OMSException"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSException_suborderId_idx" ON "OMSException"("suborderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSException_status_idx" ON "OMSException"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSException_severity_idx" ON "OMSException"("severity");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_key_idx" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSNotificationLog_suborderId_idx" ON "OMSNotificationLog"("suborderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OMSNotificationLog_status_idx" ON "OMSNotificationLog"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MultiVendorOrder_omsStatus_idx" ON "MultiVendorOrder"("omsStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MultiVendorOrder_customerId_createdAt_idx" ON "MultiVendorOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_scheduledDate_idx" ON "OrderItem"("scheduledDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Suborder_omsStatus_idx" ON "Suborder"("omsStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Suborder_isAtRisk_idx" ON "Suborder"("isAtRisk");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Suborder_vendorId_omsStatus_idx" ON "Suborder"("vendorId", "omsStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Suborder_isDelayed_idx" ON "Suborder"("isDelayed");

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSOrderEvent_orderId_fkey' AND conrelid = '"OMSOrderEvent"'::regclass) THEN
ALTER TABLE "OMSOrderEvent" ADD CONSTRAINT "OMSOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSOrderEvent_suborderId_fkey' AND conrelid = '"OMSOrderEvent"'::regclass) THEN
ALTER TABLE "OMSOrderEvent" ADD CONSTRAINT "OMSOrderEvent_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSException_orderId_fkey' AND conrelid = '"OMSException"'::regclass) THEN
ALTER TABLE "OMSException" ADD CONSTRAINT "OMSException_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSException_suborderId_fkey' AND conrelid = '"OMSException"'::regclass) THEN
ALTER TABLE "OMSException" ADD CONSTRAINT "OMSException_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSNotificationLog_orderId_fkey' AND conrelid = '"OMSNotificationLog"'::regclass) THEN
ALTER TABLE "OMSNotificationLog" ADD CONSTRAINT "OMSNotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OMSNotificationLog_suborderId_fkey' AND conrelid = '"OMSNotificationLog"'::regclass) THEN
ALTER TABLE "OMSNotificationLog" ADD CONSTRAINT "OMSNotificationLog_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

ALTER TABLE "MultiVendorOrder" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
ALTER TABLE "MultiVendorOrder" ALTER COLUMN "status" SET DEFAULT 'requested';
ALTER TABLE "MultiVendorOrder" ALTER COLUMN "omsStatus" SET DEFAULT 'AWAITING_ACCEPTANCE';
ALTER TABLE "Suborder" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
