BEGIN;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Occasion" ADD COLUMN     "draftVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invitationDraft" JSONB,
ADD COLUMN     "shareCode" TEXT,
ADD COLUMN     "shareOrigin" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "congratulation" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "rsvpCompanionCount" INTEGER;

-- CreateTable
CREATE TABLE "AuthSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ChannelSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'private',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationFavorite" (
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "InvitationFavorite_pkey" PRIMARY KEY ("userId","templateId")
);

-- CreateTable
CREATE TABLE "InvitationDelivery" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelSetting_userId_channel_key" ON "ChannelSetting"("userId", "channel");

-- CreateIndex
CREATE INDEX "InvitationTemplate_ownerId_status_idx" ON "InvitationTemplate"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationDelivery_requestKey_key" ON "InvitationDelivery"("requestKey");

-- CreateIndex
CREATE INDEX "InvitationDelivery_guestId_createdAt_idx" ON "InvitationDelivery"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_shareCode_key" ON "Occasion"("shareCode");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSetting" ADD CONSTRAINT "ChannelSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationTemplate" ADD CONSTRAINT "InvitationTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationDelivery" ADD CONSTRAINT "InvitationDelivery_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
