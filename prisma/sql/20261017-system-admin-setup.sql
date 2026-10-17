BEGIN;
CREATE TABLE "SystemSetupToken" (
  "tokenHash" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SystemSetupToken_email_idx" ON "SystemSetupToken"("email");
CREATE INDEX "SystemSetupToken_expiresAt_idx" ON "SystemSetupToken"("expiresAt");
COMMIT;
