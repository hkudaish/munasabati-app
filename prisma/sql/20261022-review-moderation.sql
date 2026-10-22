-- Customer reviews with approve-first moderation and vendor replies. Additive: no data is removed.
BEGIN;
ALTER TABLE "Review" ALTER COLUMN "vendorId" DROP NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "commerceItemId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "commerceServiceId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "replyStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "replyDraftAr" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "replyAt" TIMESTAMPTZ(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "replyById" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderatedById" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMPTZ(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderationNoteAr" TEXT;
-- replies that already existed were public; keep them public
UPDATE "Review" SET "replyStatus" = 'APPROVED' WHERE "replyAr" IS NOT NULL AND "replyAr" <> '' AND "replyStatus" = 'NONE';
CREATE UNIQUE INDEX IF NOT EXISTS "Review_userId_commerceItemId_key" ON "Review" ("userId", "commerceItemId");
CREATE INDEX IF NOT EXISTS "Review_commerceServiceId_idx" ON "Review" ("commerceServiceId");
COMMIT;
