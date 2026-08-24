-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'PAID');

-- CreateTable
CREATE TABLE "CreatorReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "bonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 20000,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "qualifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReferral_referredId_key" ON "CreatorReferral"("referredId");

-- AddForeignKey
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
