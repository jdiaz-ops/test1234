-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'DIGITAL';

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "fulfillmentLeadDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "market" TEXT NOT NULL DEFAULT 'CO',
ADD COLUMN     "originAddress" TEXT,
ADD COLUMN     "originCity" TEXT,
ADD COLUMN     "originRegion" TEXT,
ADD COLUMN     "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "digitalFileUrl" TEXT;

-- AlterTable
ALTER TABLE "ShippingZoneRate" ADD COLUMN     "conditionMaxValue" DECIMAL(12,3),
ADD COLUMN     "conditionValueUnit" "WeightUnit" NOT NULL DEFAULT 'KG';

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StorePage" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontMenuItem" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePage_brandId_idx" ON "StorePage"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_brandId_slug_key" ON "StorePage"("brandId", "slug");

-- CreateIndex
CREATE INDEX "StorefrontMenuItem_brandId_idx" ON "StorefrontMenuItem"("brandId");

-- AddForeignKey
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontMenuItem" ADD CONSTRAINT "StorefrontMenuItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
