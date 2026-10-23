-- Unified pricing: package pricing policies (versioned), discount rules with typed targets, itemised price quotes with the discounts applied to them,
-- redemptions with transaction-safe limits, and scheduled price changes. Additive: every existing package keeps pricing exactly as it was
-- (a policy row is created from its current fixed total / percentage discount). Ids are TEXT like the rest of this database; money is integer halala.

-- ------------------------------------------------------------------------------------------------ package pricing policies
CREATE TABLE IF NOT EXISTS "PackagePricingPolicy" (
  "id" TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL REFERENCES "CommercePackage"("id") ON DELETE RESTRICT,
  "pricingModel" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
  "fixedPrice" BIGINT,
  "discountPercentage" NUMERIC(7,4),
  "discountAmount" BIGINT,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PackagePricingPolicy_package_version_key" ON "PackagePricingPolicy" ("packageId","version");
CREATE INDEX IF NOT EXISTS "PackagePricingPolicy_package_status_idx" ON "PackagePricingPolicy" ("packageId","status","effectiveFrom");

-- ------------------------------------------------------------------------------------------------------------- discount rules
CREATE TABLE IF NOT EXISTS "DiscountRule" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'GENERAL',
  "discountType" TEXT NOT NULL,
  "value" NUMERIC(18,4) NOT NULL,
  "maximumDiscount" BIGINT,
  "minimumSubtotal" BIGINT NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "stackable" BOOLEAN NOT NULL DEFAULT FALSE,
  "stackingGroup" TEXT,
  "fundingType" TEXT NOT NULL DEFAULT 'PLATFORM',
  "vendorShareBps" INTEGER NOT NULL DEFAULT 0,
  "code" TEXT,
  "startsAt" TIMESTAMPTZ(3),
  "endsAt" TIMESTAMPTZ(3),
  "usageLimit" INTEGER,
  "perCustomerLimit" INTEGER,
  "ownerVendorId" TEXT REFERENCES "Vendor"("id") ON DELETE RESTRICT,
  "campaign" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "conditions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountRule_code_key" ON "DiscountRule" (upper("code")) WHERE "code" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "DiscountRule_status_idx" ON "DiscountRule" ("status","startsAt","endsAt");

-- a target is exactly one of: package, service, offer, vendor (typed columns, each with its own foreign key)
CREATE TABLE IF NOT EXISTS "DiscountRuleTarget" (
  "id" TEXT PRIMARY KEY,
  "ruleId" TEXT NOT NULL REFERENCES "DiscountRule"("id") ON DELETE CASCADE,
  "packageId" TEXT REFERENCES "CommercePackage"("id") ON DELETE CASCADE,
  "serviceId" TEXT REFERENCES "CommerceService"("id") ON DELETE CASCADE,
  "offerId" TEXT REFERENCES "CommerceOffer"("id") ON DELETE CASCADE,
  "vendorId" TEXT REFERENCES "Vendor"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DiscountRuleTarget_ruleId_idx" ON "DiscountRuleTarget" ("ruleId");
CREATE INDEX IF NOT EXISTS "DiscountRuleTarget_packageId_idx" ON "DiscountRuleTarget" ("packageId");
CREATE INDEX IF NOT EXISTS "DiscountRuleTarget_serviceId_idx" ON "DiscountRuleTarget" ("serviceId");
CREATE INDEX IF NOT EXISTS "DiscountRuleTarget_offerId_idx" ON "DiscountRuleTarget" ("offerId");
CREATE INDEX IF NOT EXISTS "DiscountRuleTarget_vendorId_idx" ON "DiscountRuleTarget" ("vendorId");

-- ------------------------------------------------------------------------------------------------- itemised quotes and what was applied
CREATE TABLE IF NOT EXISTS "PriceQuote" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "orderId" TEXT REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT,
  "calculationVersion" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
  "status" TEXT NOT NULL DEFAULT 'ESTIMATE',
  "mode" TEXT NOT NULL DEFAULT 'PACKAGE',
  "totals" JSONB NOT NULL,
  "summary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PriceQuote_orderId_idx" ON "PriceQuote" ("orderId");
CREATE INDEX IF NOT EXISTS "PriceQuote_userId_idx" ON "PriceQuote" ("userId");

CREATE TABLE IF NOT EXISTS "PriceQuoteComponent" (
  "id" TEXT PRIMARY KEY,
  "priceQuoteId" TEXT NOT NULL REFERENCES "PriceQuote"("id") ON DELETE RESTRICT,
  "offerId" TEXT REFERENCES "CommerceOffer"("id") ON DELETE RESTRICT,
  "packageItemId" TEXT,
  "packageId" TEXT,
  "lineId" TEXT NOT NULL,
  "componentType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" BIGINT NOT NULL,
  "grossAmount" BIGINT NOT NULL,
  "discountAmount" BIGINT NOT NULL,
  "netAmount" BIGINT NOT NULL,
  "taxAmount" BIGINT NOT NULL DEFAULT 0,
  "vendorFundedAmount" BIGINT NOT NULL DEFAULT 0,
  "platformFundedAmount" BIGINT NOT NULL DEFAULT 0,
  "commissionAmount" BIGINT NOT NULL DEFAULT 0,
  "vendorId" TEXT,
  "currency" CHAR(3) NOT NULL DEFAULT 'SAR'
);
CREATE INDEX IF NOT EXISTS "PriceQuoteComponent_priceQuoteId_idx" ON "PriceQuoteComponent" ("priceQuoteId");
CREATE INDEX IF NOT EXISTS "PriceQuoteComponent_offerId_idx" ON "PriceQuoteComponent" ("offerId");

CREATE TABLE IF NOT EXISTS "AppliedDiscount" (
  "id" TEXT PRIMARY KEY,
  "priceQuoteId" TEXT NOT NULL REFERENCES "PriceQuote"("id") ON DELETE RESTRICT,
  "discountRuleId" TEXT REFERENCES "DiscountRule"("id") ON DELETE RESTRICT,
  "discountRuleVersion" INTEGER,
  "source" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "discountAmount" BIGINT NOT NULL,
  "eligibleBaseAmount" BIGINT NOT NULL,
  "fundingType" TEXT NOT NULL,
  "allocationDetails" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ruleSnapshot" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AppliedDiscount_priceQuoteId_idx" ON "AppliedDiscount" ("priceQuoteId");
CREATE INDEX IF NOT EXISTS "AppliedDiscount_discountRuleId_idx" ON "AppliedDiscount" ("discountRuleId");

CREATE TABLE IF NOT EXISTS "DiscountRedemption" (
  "id" TEXT PRIMARY KEY,
  "discountRuleId" TEXT NOT NULL REFERENCES "DiscountRule"("id") ON DELETE RESTRICT,
  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "orderId" TEXT NOT NULL REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT,
  "redeemedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "discountAmount" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REDEEMED'
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountRedemption_rule_order_key" ON "DiscountRedemption" ("discountRuleId","orderId");
CREATE INDEX IF NOT EXISTS "DiscountRedemption_rule_status_idx" ON "DiscountRedemption" ("discountRuleId","status");
CREATE INDEX IF NOT EXISTS "DiscountRedemption_customer_idx" ON "DiscountRedemption" ("customerId","discountRuleId");

-- ------------------------------------------------------------------------------------------------------ scheduled price changes
CREATE TABLE IF NOT EXISTS "OfferPriceSchedule" (
  "id" TEXT PRIMARY KEY,
  "offerId" TEXT NOT NULL REFERENCES "CommerceOffer"("id") ON DELETE RESTRICT,
  "newBaseAmount" BIGINT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "appliedAt" TIMESTAMPTZ(3),
  "previousBaseAmount" BIGINT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OfferPriceSchedule_due_idx" ON "OfferPriceSchedule" ("status","effectiveFrom");
CREATE INDEX IF NOT EXISTS "OfferPriceSchedule_offerId_idx" ON "OfferPriceSchedule" ("offerId");

-- ------------------------------------------------------------------------------------------------------ constraints and triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackagePricingPolicy_model' AND conrelid = to_regclass('"PackagePricingPolicy"')) THEN ALTER TABLE "PackagePricingPolicy" ADD CONSTRAINT "PackagePricingPolicy_model" CHECK ("pricingModel" IN ('SUM','FIXED_PRICE','PERCENT','FIXED_AMOUNT','TIERED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackagePricingPolicy_status' AND conrelid = to_regclass('"PackagePricingPolicy"')) THEN ALTER TABLE "PackagePricingPolicy" ADD CONSTRAINT "PackagePricingPolicy_status" CHECK ("status" IN ('DRAFT','ACTIVE','ARCHIVED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackagePricingPolicy_values' AND conrelid = to_regclass('"PackagePricingPolicy"')) THEN ALTER TABLE "PackagePricingPolicy" ADD CONSTRAINT "PackagePricingPolicy_values" CHECK (("fixedPrice" IS NULL OR "fixedPrice" >= 0) AND ("discountAmount" IS NULL OR "discountAmount" >= 0) AND ("discountPercentage" IS NULL OR ("discountPercentage" >= 0 AND "discountPercentage" <= 100)) AND ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom") AND "version" >= 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackagePricingPolicy_model_needs_value' AND conrelid = to_regclass('"PackagePricingPolicy"')) THEN ALTER TABLE "PackagePricingPolicy" ADD CONSTRAINT "PackagePricingPolicy_model_needs_value" CHECK (("pricingModel" <> 'FIXED_PRICE' OR "fixedPrice" IS NOT NULL) AND ("pricingModel" <> 'PERCENT' OR "discountPercentage" IS NOT NULL) AND ("pricingModel" <> 'FIXED_AMOUNT' OR "discountAmount" IS NOT NULL)); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRule_type' AND conrelid = to_regclass('"DiscountRule"')) THEN ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_type" CHECK ("discountType" IN ('PERCENTAGE','FIXED_AMOUNT')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRule_kind' AND conrelid = to_regclass('"DiscountRule"')) THEN ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_kind" CHECK ("kind" IN ('GENERAL','PROMO_CODE','QUANTITY','BUNDLE','TIMED','CUSTOMER','LOYALTY')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRule_funding' AND conrelid = to_regclass('"DiscountRule"')) THEN ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_funding" CHECK ("fundingType" IN ('PLATFORM','VENDOR','SHARED') AND "vendorShareBps" BETWEEN 0 AND 10000); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRule_status' AND conrelid = to_regclass('"DiscountRule"')) THEN ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_status" CHECK ("status" IN ('DRAFT','ACTIVE','DISABLED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRule_values' AND conrelid = to_regclass('"DiscountRule"')) THEN ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_values" CHECK ("value" > 0 AND ("discountType" <> 'PERCENTAGE' OR "value" <= 100) AND ("maximumDiscount" IS NULL OR "maximumDiscount" > 0) AND "minimumSubtotal" >= 0 AND ("usageLimit" IS NULL OR "usageLimit" > 0) AND ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0) AND ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRuleTarget_one_target' AND conrelid = to_regclass('"DiscountRuleTarget"')) THEN ALTER TABLE "DiscountRuleTarget" ADD CONSTRAINT "DiscountRuleTarget_one_target" CHECK ((("packageId" IS NOT NULL)::int + ("serviceId" IS NOT NULL)::int + ("offerId" IS NOT NULL)::int + ("vendorId" IS NOT NULL)::int) = 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceQuote_status' AND conrelid = to_regclass('"PriceQuote"')) THEN ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_status" CHECK ("status" IN ('ESTIMATE','FINAL')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceQuoteComponent_amounts' AND conrelid = to_regclass('"PriceQuoteComponent"')) THEN ALTER TABLE "PriceQuoteComponent" ADD CONSTRAINT "PriceQuoteComponent_amounts" CHECK ("quantity" >= 1 AND "grossAmount" >= 0 AND "discountAmount" >= 0 AND "netAmount" >= 0 AND "grossAmount" - "discountAmount" = "netAmount"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppliedDiscount_amount' AND conrelid = to_regclass('"AppliedDiscount"')) THEN ALTER TABLE "AppliedDiscount" ADD CONSTRAINT "AppliedDiscount_amount" CHECK ("discountAmount" > 0 AND "discountAmount" <= "eligibleBaseAmount" AND "fundingType" IN ('PLATFORM','VENDOR','SHARED','PACKAGE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscountRedemption_status' AND conrelid = to_regclass('"DiscountRedemption"')) THEN ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_status" CHECK ("status" IN ('RESERVED','REDEEMED','RELEASED') AND "discountAmount" > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfferPriceSchedule_values' AND conrelid = to_regclass('"OfferPriceSchedule"')) THEN ALTER TABLE "OfferPriceSchedule" ADD CONSTRAINT "OfferPriceSchedule_values" CHECK ("newBaseAmount" >= 0 AND "status" IN ('SCHEDULED','APPLIED','CANCELLED')); END IF;
END $$;

-- two active policies for one package must never overlap in time
CREATE OR REPLACE FUNCTION package_pricing_no_overlap() RETURNS trigger AS $fn$
BEGIN
  IF NEW."status" = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "PackagePricingPolicy" p WHERE p."packageId" = NEW."packageId" AND p."status" = 'ACTIVE' AND p."id" <> NEW."id"
      AND p."effectiveFrom" < COALESCE(NEW."effectiveUntil", 'infinity'::timestamptz) AND NEW."effectiveFrom" < COALESCE(p."effectiveUntil", 'infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'package % already has an active pricing policy in that period', NEW."packageId" USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS package_pricing_no_overlap ON "PackagePricingPolicy";
CREATE TRIGGER package_pricing_no_overlap BEFORE INSERT OR UPDATE ON "PackagePricingPolicy" FOR EACH ROW EXECUTE FUNCTION package_pricing_no_overlap();

-- a policy row's pricing terms are history: only its status and end date may change once written
CREATE OR REPLACE FUNCTION pricing_terms_frozen() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% rows cannot be deleted', TG_TABLE_NAME USING ERRCODE = '23000'; END IF;
  IF NEW."pricingModel" IS DISTINCT FROM OLD."pricingModel" OR NEW."fixedPrice" IS DISTINCT FROM OLD."fixedPrice" OR NEW."discountPercentage" IS DISTINCT FROM OLD."discountPercentage"
     OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount" OR NEW."config" IS DISTINCT FROM OLD."config" OR NEW."version" IS DISTINCT FROM OLD."version" OR NEW."packageId" IS DISTINCT FROM OLD."packageId" THEN
    RAISE EXCEPTION 'pricing terms of a published policy are immutable; create a new version' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS package_pricing_terms_frozen ON "PackagePricingPolicy";
CREATE TRIGGER package_pricing_terms_frozen BEFORE UPDATE OR DELETE ON "PackagePricingPolicy" FOR EACH ROW EXECUTE FUNCTION pricing_terms_frozen();

-- quotes and what was applied to them are transaction records: append-only
CREATE OR REPLACE FUNCTION pricing_record_immutable() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = '23000';
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS price_quote_immutable ON "PriceQuote";
CREATE TRIGGER price_quote_immutable BEFORE UPDATE OR DELETE ON "PriceQuote" FOR EACH ROW EXECUTE FUNCTION pricing_record_immutable();
DROP TRIGGER IF EXISTS price_quote_component_immutable ON "PriceQuoteComponent";
CREATE TRIGGER price_quote_component_immutable BEFORE UPDATE OR DELETE ON "PriceQuoteComponent" FOR EACH ROW EXECUTE FUNCTION pricing_record_immutable();
DROP TRIGGER IF EXISTS applied_discount_immutable ON "AppliedDiscount";
CREATE TRIGGER applied_discount_immutable BEFORE UPDATE OR DELETE ON "AppliedDiscount" FOR EACH ROW EXECUTE FUNCTION pricing_record_immutable();

-- ------------------------------------------------------------------------------------------------------- existing packages keep their pricing
-- every package gets a version-1 policy equal to what it already does (fixed total, percentage discount, or plain sum), so nothing changes for customers
INSERT INTO "PackagePricingPolicy" ("id","packageId","pricingModel","currency","fixedPrice","discountPercentage","discountAmount","config","effectiveFrom","version","status","createdBy")
SELECT 'legacy-' || p."id", p."id",
  CASE WHEN COALESCE((p."body"->>'fixedTotal')::bigint,0) > 0 THEN 'FIXED_PRICE' WHEN COALESCE((p."body"->>'discountBps')::int,0) > 0 THEN 'PERCENT' ELSE 'SUM' END,
  'SAR',
  CASE WHEN COALESCE((p."body"->>'fixedTotal')::bigint,0) > 0 THEN (p."body"->>'fixedTotal')::bigint END,
  CASE WHEN COALESCE((p."body"->>'discountBps')::int,0) > 0 AND COALESCE((p."body"->>'fixedTotal')::bigint,0) = 0 THEN ((p."body"->>'discountBps')::numeric / 100) END,
  NULL, '{}'::jsonb, p."createdAt", 1, 'ACTIVE', 'migration'
FROM "CommercePackage" p
WHERE NOT EXISTS (SELECT 1 FROM "PackagePricingPolicy" x WHERE x."packageId" = p."id");
