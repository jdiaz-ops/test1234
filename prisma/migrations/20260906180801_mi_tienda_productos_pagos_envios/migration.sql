-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('NONE', 'WOMPI');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('TEST', 'PRODUCTION');

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "freeShippingThreshold" DECIMAL(12,2),
ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'TEST',
ADD COLUMN     "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "shippingFlatRate" DECIMAL(12,2),
ADD COLUMN     "shippingNotes" TEXT,
ADD COLUMN     "storefrontSlug" TEXT,
ADD COLUMN     "wompiEventsKeyProd" TEXT,
ADD COLUMN     "wompiEventsKeyTest" TEXT,
ADD COLUMN     "wompiIntegrityKeyProd" TEXT,
ADD COLUMN     "wompiIntegrityKeyTest" TEXT,
ADD COLUMN     "wompiPrivateKeyProd" TEXT,
ADD COLUMN     "wompiPrivateKeyTest" TEXT,
ADD COLUMN     "wompiPublicKeyProd" TEXT,
ADD COLUMN     "wompiPublicKeyTest" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "description" TEXT,
ADD COLUMN     "manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stock" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_storefrontSlug_key" ON "BrandProfile"("storefrontSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_brandId_slug_key" ON "Product"("brandId", "slug");

