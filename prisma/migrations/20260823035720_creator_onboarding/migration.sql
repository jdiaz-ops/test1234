-- CreateEnum
CREATE TYPE "CreatorPayoutMethod" AS ENUM ('BANK', 'BRE_B');

-- AlterTable
ALTER TABLE "CreatorOfferEnrollment" ADD COLUMN     "storefrontOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storefrontVisible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CreatorProfile" ADD COLUMN     "breBKey" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "payoutMethod" "CreatorPayoutMethod",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "storefrontFont" TEXT NOT NULL DEFAULT 'clasica',
ADD COLUMN     "storefrontHeadline" TEXT,
ADD COLUMN     "storefrontPalette" TEXT NOT NULL DEFAULT 'rosa-marcolini',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CreatorInterest" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,

    CONSTRAINT "CreatorInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorInterest_creatorProfileId_verticalId_key" ON "CreatorInterest"("creatorProfileId", "verticalId");

-- AddForeignKey
ALTER TABLE "CreatorInterest" ADD CONSTRAINT "CreatorInterest_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInterest" ADD CONSTRAINT "CreatorInterest_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

