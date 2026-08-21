-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CREATOR', 'BRAND', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'SUPPORT', 'FINANCE', 'BRAND_APPROVER');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'OTHER');

-- CreateEnum
CREATE TYPE "StoreConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "JoinMode" AS ENUM ('OPEN', 'APPROVAL');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('GOAL_BONUS', 'TEMP_COMMISSION_BOOST', 'LEADERBOARD', 'WELCOME_BONUS', 'CONTENT_CHALLENGE');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandChargeStatus" AS ENUM ('PENDING', 'CHARGED', 'FAILED');

-- CreateEnum
CREATE TYPE "InstantPayoutStatus" AS ENUM ('REQUESTED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('PENDING_REVIEW', 'CLEARED', 'CONFIRMED_FRAUD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL,
    "adminRole" "AdminRole",
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Vertical" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Colombia',
    "verticalId" TEXT,
    "baseCode" TEXT NOT NULL,
    "discoverable" BOOLEAN NOT NULL DEFAULT false,
    "storefrontSlug" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "paymentHolderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorSocialLink" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "approxFollowers" INTEGER,

    CONSTRAINT "CreatorSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Colombia',
    "verticalId" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "storeType" "StoreType" NOT NULL DEFAULT 'OTHER',
    "storeUrl" TEXT,
    "storeConnectionStatus" "StoreConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "storeLastSyncedAt" TIMESTAMP(3),
    "shopifyAccessToken" TEXT,
    "wooConsumerKey" TEXT,
    "wooConsumerSecret" TEXT,
    "platformFeePercentOverride" DECIMAL(5,2),
    "cardTokenRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultCommissionPercent" DECIMAL(5,2) NOT NULL,
    "defaultDiscountPercent" DECIMAL(5,2) NOT NULL,
    "joinMode" "JoinMode" NOT NULL DEFAULT 'OPEN',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorOfferEnrollment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionPercentOverride" DECIMAL(5,2),
    "discountPercentOverride" DECIMAL(5,2),
    "discountCode" TEXT NOT NULL,
    "shopifyPriceRuleId" TEXT,
    "wooCouponId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorOfferEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "creatorCommissionAmount" DECIMAL(12,2) NOT NULL,
    "platformFeeAmount" DECIMAL(12,2) NOT NULL,
    "platformFeeVatAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "instantPayoutRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorProfileId" TEXT,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "epaycoTransactionRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCharge" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "BrandChargeStatus" NOT NULL DEFAULT 'PENDING',
    "epaycoTransactionRef" TEXT,
    "chargedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstantPayoutRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountRequested" DECIMAL(12,2) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "status" "InstantPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstantPayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultPlatformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 19.0,
    "chargeDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "payoutDayOfMonth" INTEGER NOT NULL DEFAULT 15,
    "refundHoldDays" INTEGER NOT NULL DEFAULT 15,
    "instantPayoutFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudFlag" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FraudFlagStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_name_key" ON "Vertical"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_slug_key" ON "Vertical"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_verticalId_slug_key" ON "Category"("verticalId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_baseCode_key" ON "CreatorProfile"("baseCode");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_storefrontSlug_key" ON "CreatorProfile"("storefrontSlug");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorOfferEnrollment_offerId_creatorId_key" ON "CreatorOfferEnrollment"("offerId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_transactionId_key" ON "Commission"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_enrollmentId_key" ON "Conversation"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSocialLink" ADD CONSTRAINT "CreatorSocialLink_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOfferEnrollment" ADD CONSTRAINT "CreatorOfferEnrollment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOfferEnrollment" ADD CONSTRAINT "CreatorOfferEnrollment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CreatorOfferEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_instantPayoutRequestId_fkey" FOREIGN KEY ("instantPayoutRequestId") REFERENCES "InstantPayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCharge" ADD CONSTRAINT "BrandCharge_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPayoutRequest" ADD CONSTRAINT "InstantPayoutRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CreatorOfferEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
