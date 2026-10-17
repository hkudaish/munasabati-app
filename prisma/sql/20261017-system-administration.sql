BEGIN;
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "SystemFeature" (
  "id" TEXT PRIMARY KEY,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SystemAuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SystemAuditLog_createdAt_idx" ON "SystemAuditLog"("createdAt");
CREATE INDEX "SystemAuditLog_actorId_idx" ON "SystemAuditLog"("actorId");
INSERT INTO "SystemFeature" ("id", "visible", "enabled", "updatedAt") VALUES ('zaffah_generator', false, false, CURRENT_TIMESTAMP);
COMMIT;
