
-- CreateEnum
CREATE TYPE "ContentPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "ContentLicenseStatus" AS ENUM ('APPROVED', 'PAID', 'VOIDED');

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "contentLicenseCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 20.0;

-- CreateTable
CREATE TABLE "LicensableContent" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "ContentPlatform" NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "caption" TEXT,
    "pricePer30Days" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicensableContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLicense" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "platformCutAmount" DECIMAL(12,2) NOT NULL,
    "creatorNetAmount" DECIMAL(12,2) NOT NULL,
    "status" "ContentLicenseStatus" NOT NULL DEFAULT 'APPROVED',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "brandChargeId" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentLicense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LicensableContent" ADD CONSTRAINT "LicensableContent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "LicensableContent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_brandChargeId_fkey" FOREIGN KEY ("brandChargeId") REFERENCES "BrandCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicense" ADD CONSTRAINT "ContentLicense_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

