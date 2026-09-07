
-- CreateEnum
CREATE TYPE "PaidContentRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DELIVERED', 'DECLINED', 'CANCELLED', 'PAID');

-- CreateTable
CREATE TABLE "PaidContentRequest" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "briefing" TEXT NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "deadlineDays" INTEGER,
    "status" "PaidContentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "respondedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryUrl" TEXT,
    "deliveryScreenshotUrl" TEXT,
    "platformCutAmount" DECIMAL(12,2),
    "creatorNetAmount" DECIMAL(12,2),
    "brandChargeId" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaidContentRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaidContentRequest" ADD CONSTRAINT "PaidContentRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidContentRequest" ADD CONSTRAINT "PaidContentRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidContentRequest" ADD CONSTRAINT "PaidContentRequest_brandChargeId_fkey" FOREIGN KEY ("brandChargeId") REFERENCES "BrandCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidContentRequest" ADD CONSTRAINT "PaidContentRequest_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

