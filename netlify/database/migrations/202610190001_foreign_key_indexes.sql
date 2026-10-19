-- Additive, idempotent: index foreign-key columns that are filtered or deleted by (e.g. package save).
CREATE INDEX IF NOT EXISTS "CommercePackageItem_packageId_idx" ON "CommercePackageItem"("packageId");
CREATE INDEX IF NOT EXISTS "CommercePackageItem_offerId_idx" ON "CommercePackageItem"("offerId");
CREATE INDEX IF NOT EXISTS "CommerceService_ownerId_idx" ON "CommerceService"("ownerId");
CREATE INDEX IF NOT EXISTS "CommerceService_vendorId_idx" ON "CommerceService"("vendorId");
CREATE INDEX IF NOT EXISTS "CommercePackage_ownerId_idx" ON "CommercePackage"("ownerId");
