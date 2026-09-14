-- CreateEnum
CREATE TYPE "StorefrontSectionType" AS ENUM ('BANNER', 'FEATURED_COLLECTION', 'TEXT');

-- CreateEnum
CREATE TYPE "StoreOrderFulfillmentStatus" AS ENUM ('UNFULFILLED', 'PREPARED', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'UNLISTED');

-- AlterEnum
BEGIN;
CREATE TYPE "WeightUnit_new" AS ENUM ('KG', 'G');
ALTER TABLE "public"."Product" ALTER COLUMN "weightUnit" DROP DEFAULT;
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "weightUnit" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "weightUnit" TYPE "WeightUnit_new" USING ("weightUnit"::text::"WeightUnit_new");
ALTER TABLE "ProductVariant" ALTER COLUMN "weightUnit" TYPE "WeightUnit_new" USING ("weightUnit"::text::"WeightUnit_new");
ALTER TYPE "WeightUnit" RENAME TO "WeightUnit_old";
ALTER TYPE "WeightUnit_new" RENAME TO "WeightUnit";
DROP TYPE "public"."WeightUnit_old";
ALTER TABLE "Product" ALTER COLUMN "weightUnit" SET DEFAULT 'KG';
ALTER TABLE "ProductVariant" ALTER COLUMN "weightUnit" SET DEFAULT 'KG';
COMMIT;

-- AlterTable
ALTER TABLE "BrandCollection" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

-- Preserva el comportamiento de "available=false" para productos ya
-- existentes — sin esto, todo producto que hoy está marcado como no
-- disponible pasaría a verse como "Activo" en el nuevo selector de
-- estado, cuando en realidad la marca lo había ocultado.
UPDATE "Product" SET "status" = 'DRAFT' WHERE "available" = false AND "manual" = true;

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" "StoreOrderFulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "StorefrontSection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "StorefrontSectionType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCustomer" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "emailSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "storeCreditCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorefrontSection_brandId_idx" ON "StorefrontSection"("brandId");

-- CreateIndex
CREATE INDEX "StoreCustomer_brandId_idx" ON "StoreCustomer"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCustomer_brandId_email_key" ON "StoreCustomer"("brandId", "email");

-- AddForeignKey
ALTER TABLE "StorefrontSection" ADD CONSTRAINT "StorefrontSection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCustomer" ADD CONSTRAINT "StoreCustomer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

