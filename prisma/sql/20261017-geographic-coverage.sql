BEGIN;
-- AlterTable
ALTER TABLE "SaudiCity" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "defaultAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "GeoCountry" (
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoCountry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "GeoRegion" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "GeoRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRule" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "featureId" TEXT,
    "serviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "reason" TEXT,
    "message" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "unknownCity" TEXT NOT NULL DEFAULT 'PROMPT',
    "hideUnavailable" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reverseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoDraft" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRevision" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GeoRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPreview" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cityId" TEXT,
    "countryCode" TEXT,
    "draftId" TEXT,
    "visitorType" TEXT NOT NULL DEFAULT 'guest',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPreference" (
    "visitorHash" TEXT NOT NULL,
    "userId" TEXT,
    "cityId" TEXT,
    "countryCode" TEXT,
    "unknownName" TEXT,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPreference_pkey" PRIMARY KEY ("visitorHash")
);

-- CreateTable
CREATE TABLE "GeoDailyMetric" (
    "day" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GeoDailyMetric_pkey" PRIMARY KEY ("day","cityKey","countryKey","serviceKey","kind")
);

-- CreateTable
CREATE TABLE "GeoSessionEvent" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoRegion_countryCode_nameEn_key" ON "GeoRegion"("countryCode", "nameEn");

-- CreateIndex
CREATE INDEX "GeoRule_cityId_status_idx" ON "GeoRule"("cityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoRule_cityId_featureId_key" ON "GeoRule"("cityId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoRule_cityId_serviceId_key" ON "GeoRule"("cityId", "serviceId");

-- CreateIndex
CREATE INDEX "GeoDraft_ownerId_status_idx" ON "GeoDraft"("ownerId", "status");

-- CreateIndex
CREATE INDEX "GeoPreview_ownerId_idx" ON "GeoPreview"("ownerId");

-- CreateIndex
CREATE INDEX "GeoPreference_userId_idx" ON "GeoPreference"("userId");

-- CreateIndex
CREATE INDEX "GeoPreference_expiresAt_idx" ON "GeoPreference"("expiresAt");

-- CreateIndex
CREATE INDEX "GeoSessionEvent_expiresAt_idx" ON "GeoSessionEvent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaudiCity_externalId_key" ON "SaudiCity"("externalId");

-- AddForeignKey
ALTER TABLE "GeoRegion" ADD CONSTRAINT "GeoRegion_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "GeoCountry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "SaudiCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SystemFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaudiCity" ADD CONSTRAINT "SaudiCity_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "GeoCountry"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaudiCity" ADD CONSTRAINT "SaudiCity_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "GeoRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;


INSERT INTO "GeoCountry" ("code","nameAr","nameEn","enabled","updatedAt") VALUES ('SA','السعودية','Saudi Arabia',true,CURRENT_TIMESTAMP);
INSERT INTO "GeoRegion" ("id","countryCode","nameAr","nameEn") SELECT DISTINCT 'SA-' || md5("regionAr"),'SA',"regionAr","regionAr" FROM "SaudiCity";
UPDATE "SaudiCity" SET "countryCode"='SA',"regionId"='SA-'||md5("regionAr"),"defaultAvailable"=true;
INSERT INTO "GeoPolicy" ("id","updatedAt") VALUES ('default',CURRENT_TIMESTAMP);
INSERT INTO "GeoRevision" ("id","version") VALUES ('default',0);
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_one_service" CHECK (("featureId" IS NULL) <> ("serviceId" IS NULL));
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_period" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt">"startsAt");
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_status" CHECK ("status" IN ('AVAILABLE','UNAVAILABLE','SOON'));
ALTER TABLE "SaudiCity" ALTER COLUMN "updatedAt" DROP DEFAULT;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('zaffah_generator',false,false,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('folk_arts',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('marketplace',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('packages',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('planning',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('invitations',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('gate_scanner',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('reception',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('calculator',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('rfq',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('inspiration',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('commerce',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('vendor_portal',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SystemFeature" ("id","visible","enabled","updatedAt") VALUES ('luma',true,true,CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

COMMIT;
