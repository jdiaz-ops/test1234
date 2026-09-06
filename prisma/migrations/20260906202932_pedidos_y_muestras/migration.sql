
-- CreateEnum
CREATE TYPE "StoreOrderKind" AS ENUM ('PURCHASE', 'SAMPLE');

-- CreateEnum
CREATE TYPE "SampleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sampleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sampleStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "kind" "StoreOrderKind" NOT NULL DEFAULT 'PURCHASE';

-- CreateTable
CREATE TABLE "SampleRequest" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "shippingName" TEXT NOT NULL,
    "shippingPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingNotes" TEXT,
    "status" "SampleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SampleRequest_orderId_key" ON "SampleRequest"("orderId");

-- CreateIndex
CREATE INDEX "SampleRequest_brandId_status_idx" ON "SampleRequest"("brandId", "status");

-- CreateIndex
CREATE INDEX "SampleRequest_creatorId_status_idx" ON "SampleRequest"("creatorId", "status");

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

