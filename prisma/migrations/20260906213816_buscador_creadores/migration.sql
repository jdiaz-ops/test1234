
-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SampleRequestInitiator" AS ENUM ('CREATOR', 'BRAND');

-- AlterEnum
ALTER TYPE "SampleRequestStatus" ADD VALUE 'OFFERED';

-- AlterTable
ALTER TABLE "CreatorProfile" ALTER COLUMN "discoverable" SET DEFAULT true;

-- AlterTable
ALTER TABLE "SampleRequest" ADD COLUMN     "initiatedBy" "SampleRequestInitiator" NOT NULL DEFAULT 'CREATOR',
ALTER COLUMN "shippingName" DROP NOT NULL,
ALTER COLUMN "shippingPhone" DROP NOT NULL,
ALTER COLUMN "shippingAddress" DROP NOT NULL,
ALTER COLUMN "shippingCity" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EnrollmentInvitation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "commissionPercentOverride" DECIMAL(5,2),
    "discountPercentOverride" DECIMAL(5,2),
    "message" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "EnrollmentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentInvitation_enrollmentId_key" ON "EnrollmentInvitation"("enrollmentId");

-- AddForeignKey
ALTER TABLE "EnrollmentInvitation" ADD CONSTRAINT "EnrollmentInvitation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentInvitation" ADD CONSTRAINT "EnrollmentInvitation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentInvitation" ADD CONSTRAINT "EnrollmentInvitation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CreatorOfferEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

