-- Initial schema for a new Netlify Database. Existing installations use prisma/sql upgrades.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'VENDOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MADA', 'APPLE_PAY', 'STC_PAY', 'TAMARA', 'CREDIT_CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'PER_PERSON', 'STARTING_AT');

-- CreateEnum
CREATE TYPE "PackageTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "AddonPricingType" AS ENUM ('FIXED', 'PER_UNIT', 'PER_HOUR', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "OMSOrderStatus" AS ENUM ('CREATED', 'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'ROUTING_TO_SUPPLIER', 'AWAITING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER_REVIEW', 'COMPLETED', 'CLOSED', 'REJECTED', 'UNRESPONSIVE_VENDOR', 'ASSIGNMENT_FAILED', 'AWAITING_CUSTOMER_INFO', 'EXTENSION_REQUESTED', 'AT_RISK', 'DELAYED', 'PAUSED', 'REASSIGNMENT_REQUESTED', 'MODIFICATION_REQUESTED', 'DISPUTED', 'CANCEL_REQUESTED', 'CANCELLED', 'PENDING_REFUND', 'REFUNDED', 'UNFULFILLABLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING_PAYMENT', 'PROCESSING', 'PAID', 'PAYMENT_FAILED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "avatar" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "SaudiCity" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "regionAr" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "countryCode" TEXT,
    "regionId" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalId" TEXT,
    "defaultAvailable" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaudiCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessName" TEXT NOT NULL,
    "businessNameEn" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "bannerImage" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "completedBookingsCount" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "crNumber" TEXT,
    "freelanceLicense" TEXT,
    "vatNumber" TEXT,
    "cityId" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startingPrice" INTEGER NOT NULL DEFAULT 0,
    "instantBooking" BOOLEAN NOT NULL DEFAULT true,
    "responseTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bioAr" TEXT NOT NULL,
    "portfolio" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactPhone" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "genderSpecialty" TEXT,
    "cancellationPolicyAr" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "specialtiesAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMetrics" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "repeatCustomerRate" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "acceptanceRate" INTEGER NOT NULL DEFAULT 100,
    "onTimeRate" INTEGER NOT NULL DEFAULT 100,
    "satisfactionRate" INTEGER NOT NULL DEFAULT 100,
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "priceType" "PriceType" NOT NULL DEFAULT 'FIXED',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuresAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capacityMax" INTEGER,
    "instantBooking" BOOLEAN NOT NULL DEFAULT true,
    "genderPreference" TEXT,
    "badge" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" INTEGER,
    "originalPrice" INTEGER,
    "executionDurationHours" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "tier" "PackageTier" NOT NULL DEFAULT 'STANDARD',
    "price" INTEGER NOT NULL,
    "descriptionAr" TEXT,
    "durationHours" INTEGER DEFAULT 4,
    "featuresAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPopular" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAddon" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "nameAr" TEXT,
    "descriptionAr" TEXT,
    "price" INTEGER NOT NULL,
    "pricingType" "AddonPricingType" NOT NULL DEFAULT 'FIXED',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "maxQuantity" INTEGER DEFAULT 10,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAvailability" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "vendorId" TEXT,
    "workingDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "timeSlots" TEXT[] DEFAULT ARRAY['04:00 م - 07:00 م', '07:00 م - 10:00 م', '10:00 م - 01:00 ص']::TEXT[],
    "capacityPerSlot" INTEGER NOT NULL DEFAULT 2,
    "blackoutDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minNoticeDays" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 180,

    CONSTRAINT "ServiceAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "occasionTypeId" TEXT NOT NULL,
    "occasionTypeNameAr" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "neighborhood" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "isApproximateDate" BOOLEAN NOT NULL DEFAULT false,
    "guestCount" INTEGER NOT NULL DEFAULT 50,
    "guestsSection" TEXT NOT NULL DEFAULT 'women',
    "venueType" TEXT NOT NULL DEFAULT 'home',
    "venueName" TEXT,
    "budget" INTEGER NOT NULL DEFAULT 15000,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'medium',
    "readinessPercentage" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "notes" TEXT,
    "shareCode" TEXT,
    "invitationDraft" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "shareOrigin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "category" TEXT NOT NULL DEFAULT 'family',
    "familyGroup" TEXT,
    "companionCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "qrCode" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "invitedVia" TEXT NOT NULL DEFAULT 'whatsapp',
    "invitationSentAt" TIMESTAMP(3),
    "rsvpTime" TIMESTAMP(3),
    "rsvpCompanionCount" INTEGER,
    "congratulation" TEXT,
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "SystemFeature" (
    "id" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetupToken" (
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetupToken_pkey" PRIMARY KEY ("tokenHash")
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

-- CreateTable
CREATE TABLE "MultiVendorOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "occasionId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT,
    "cityId" TEXT NOT NULL,
    "venueName" TEXT,
    "totalSubtotal" INTEGER NOT NULL,
    "totalTax" INTEGER NOT NULL,
    "couponDiscount" INTEGER NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "finalTotal" INTEGER NOT NULL,
    "totalDeposit" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MADA',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "isDepositOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "omsStatus" "OMSOrderStatus" NOT NULL DEFAULT 'PAYMENT_CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultiVendorOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suborder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorLogo" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "depositAmount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "omsStatus" "OMSOrderStatus" NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
    "bookingNumber" TEXT NOT NULL,
    "assignedRole" TEXT NOT NULL DEFAULT 'vendor',
    "assignedUserId" TEXT,
    "nextAction" TEXT NOT NULL DEFAULT 'VENDOR_ACCEPTANCE',
    "nextActionDeadline" TIMESTAMP(3),
    "acceptanceDeadline" TIMESTAMP(3),
    "fulfillmentDeadline" TIMESTAMP(3),
    "deliveryDeadline" TIMESTAMP(3),
    "customerReviewDeadline" TIMESTAMP(3),
    "isAtRisk" BOOLEAN NOT NULL DEFAULT false,
    "isDelayed" BOOLEAN NOT NULL DEFAULT false,
    "delayReasonAr" TEXT,
    "cancellationReasonAr" TEXT,
    "disputeReasonAr" TEXT,
    "deliverablesUrl" TEXT,
    "proofOfDelivery" TEXT,
    "slaExtensionDays" INTEGER NOT NULL DEFAULT 0,
    "slaOriginalDeadline" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suborder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "suborderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceTitleAr" TEXT NOT NULL,
    "serviceImage" TEXT NOT NULL,
    "packageId" TEXT,
    "packageNameAr" TEXT,
    "packagePrice" INTEGER NOT NULL,
    "addons" JSONB,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT,
    "cityId" TEXT NOT NULL,
    "cityNameAr" TEXT NOT NULL,
    "venueAddress" TEXT,
    "notes" TEXT,
    "basePrice" INTEGER NOT NULL,
    "addonsTotal" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OMSOrderEvent" (
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
CREATE TABLE "OMSException" (
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
CREATE TABLE "OMSAutomationConfig" (
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
CREATE TABLE "IdempotencyRecord" (
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
CREATE TABLE "OMSNotificationLog" (
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

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceId" TEXT,
    "userId" TEXT,
    "bookingId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "qualityRating" DOUBLE PRECISION DEFAULT 5.0,
    "communicationRating" DOUBLE PRECISION DEFAULT 5.0,
    "timelinessRating" DOUBLE PRECISION DEFAULT 5.0,
    "valueRating" DOUBLE PRECISION DEFAULT 5.0,
    "commentAr" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "replyAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" INTEGER NOT NULL,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountAmount" INTEGER,
    "descriptionAr" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "applicableVendorId" TEXT,
    "usageLimit" INTEGER,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

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

-- CreateIndex
CREATE INDEX "SaudiCity_isAvailable_idx" ON "SaudiCity"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_key" ON "Vendor"("userId");

-- CreateIndex
CREATE INDEX "Vendor_categoryId_idx" ON "Vendor"("categoryId");

-- CreateIndex
CREATE INDEX "Vendor_cityId_idx" ON "Vendor"("cityId");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_rating_idx" ON "Vendor"("rating");

-- CreateIndex
CREATE INDEX "Vendor_featured_idx" ON "Vendor"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "VendorMetrics_vendorId_key" ON "VendorMetrics"("vendorId");

-- CreateIndex
CREATE INDEX "ServiceItem_vendorId_idx" ON "ServiceItem"("vendorId");

-- CreateIndex
CREATE INDEX "ServiceItem_categoryId_idx" ON "ServiceItem"("categoryId");

-- CreateIndex
CREATE INDEX "ServiceItem_price_idx" ON "ServiceItem"("price");

-- CreateIndex
CREATE INDEX "ServicePackage_serviceId_idx" ON "ServicePackage"("serviceId");

-- CreateIndex
CREATE INDEX "ServicePackage_price_idx" ON "ServicePackage"("price");

-- CreateIndex
CREATE INDEX "ServiceAddon_serviceId_idx" ON "ServiceAddon"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAvailability_serviceId_key" ON "ServiceAvailability"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAvailability_vendorId_key" ON "ServiceAvailability"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_shareCode_key" ON "Occasion"("shareCode");

-- CreateIndex
CREATE INDEX "Occasion_cityId_idx" ON "Occasion"("cityId");

-- CreateIndex
CREATE INDEX "Occasion_date_idx" ON "Occasion"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_qrCode_key" ON "Guest"("qrCode");

-- CreateIndex
CREATE INDEX "Guest_occasionId_idx" ON "Guest"("occasionId");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SystemAuditLog_createdAt_idx" ON "SystemAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemAuditLog_actorId_idx" ON "SystemAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "SystemSetupToken_email_idx" ON "SystemSetupToken"("email");

-- CreateIndex
CREATE INDEX "SystemSetupToken_expiresAt_idx" ON "SystemSetupToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelSetting_userId_channel_key" ON "ChannelSetting"("userId", "channel");

-- CreateIndex
CREATE INDEX "InvitationTemplate_ownerId_status_idx" ON "InvitationTemplate"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationDelivery_requestKey_key" ON "InvitationDelivery"("requestKey");

-- CreateIndex
CREATE INDEX "InvitationDelivery_guestId_createdAt_idx" ON "InvitationDelivery"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MultiVendorOrder_orderNumber_key" ON "MultiVendorOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "MultiVendorOrder_orderNumber_idx" ON "MultiVendorOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "MultiVendorOrder_customerPhone_idx" ON "MultiVendorOrder"("customerPhone");

-- CreateIndex
CREATE INDEX "MultiVendorOrder_createdAt_idx" ON "MultiVendorOrder"("createdAt");

-- CreateIndex
CREATE INDEX "MultiVendorOrder_omsStatus_idx" ON "MultiVendorOrder"("omsStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Suborder_bookingNumber_key" ON "Suborder"("bookingNumber");

-- CreateIndex
CREATE INDEX "Suborder_orderId_idx" ON "Suborder"("orderId");

-- CreateIndex
CREATE INDEX "Suborder_vendorId_idx" ON "Suborder"("vendorId");

-- CreateIndex
CREATE INDEX "Suborder_bookingNumber_idx" ON "Suborder"("bookingNumber");

-- CreateIndex
CREATE INDEX "Suborder_omsStatus_idx" ON "Suborder"("omsStatus");

-- CreateIndex
CREATE INDEX "Suborder_isAtRisk_idx" ON "Suborder"("isAtRisk");

-- CreateIndex
CREATE INDEX "Suborder_isDelayed_idx" ON "Suborder"("isDelayed");

-- CreateIndex
CREATE INDEX "OrderItem_suborderId_idx" ON "OrderItem"("suborderId");

-- CreateIndex
CREATE INDEX "OrderItem_serviceId_idx" ON "OrderItem"("serviceId");

-- CreateIndex
CREATE INDEX "OMSOrderEvent_orderId_idx" ON "OMSOrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "OMSOrderEvent_suborderId_idx" ON "OMSOrderEvent"("suborderId");

-- CreateIndex
CREATE INDEX "OMSOrderEvent_createdAt_idx" ON "OMSOrderEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OMSException_orderId_idx" ON "OMSException"("orderId");

-- CreateIndex
CREATE INDEX "OMSException_suborderId_idx" ON "OMSException"("suborderId");

-- CreateIndex
CREATE INDEX "OMSException_status_idx" ON "OMSException"("status");

-- CreateIndex
CREATE INDEX "OMSException_severity_idx" ON "OMSException"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_key_idx" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "OMSNotificationLog_suborderId_idx" ON "OMSNotificationLog"("suborderId");

-- CreateIndex
CREATE INDEX "OMSNotificationLog_status_idx" ON "OMSNotificationLog"("status");

-- CreateIndex
CREATE INDEX "Review_vendorId_idx" ON "Review"("vendorId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_featured_idx" ON "Review"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

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

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "SaudiCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMetrics" ADD CONSTRAINT "VendorMetrics_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "SaudiCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSetting" ADD CONSTRAINT "ChannelSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationTemplate" ADD CONSTRAINT "InvitationTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationDelivery" ADD CONSTRAINT "InvitationDelivery_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiVendorOrder" ADD CONSTRAINT "MultiVendorOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiVendorOrder" ADD CONSTRAINT "MultiVendorOrder_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiVendorOrder" ADD CONSTRAINT "MultiVendorOrder_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "SaudiCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suborder" ADD CONSTRAINT "Suborder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suborder" ADD CONSTRAINT "Suborder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSOrderEvent" ADD CONSTRAINT "OMSOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSOrderEvent" ADD CONSTRAINT "OMSOrderEvent_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSException" ADD CONSTRAINT "OMSException_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSException" ADD CONSTRAINT "OMSException_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSNotificationLog" ADD CONSTRAINT "OMSNotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MultiVendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OMSNotificationLog" ADD CONSTRAINT "OMSNotificationLog_suborderId_fkey" FOREIGN KEY ("suborderId") REFERENCES "Suborder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_one_service" CHECK (("featureId" IS NULL) <> ("serviceId" IS NULL));
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_period" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt">"startsAt");
ALTER TABLE "GeoRule" ADD CONSTRAINT "GeoRule_status" CHECK ("status" IN ('AVAILABLE','UNAVAILABLE','SOON'));
