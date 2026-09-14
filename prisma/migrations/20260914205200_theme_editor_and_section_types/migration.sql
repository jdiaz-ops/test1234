-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StorefrontSectionType" ADD VALUE 'IMAGE_CAROUSEL';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'SHIPPING_INFO_BANNERS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'CATEGORY_BANNERS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'PROMO_BANNERS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'FEATURED_PRODUCTS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'NEW_PRODUCTS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'ON_SALE_PRODUCTS';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'BRAND_CAROUSEL';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'VIDEO';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'WELCOME_MESSAGE';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'INSTITUTIONAL_MESSAGE';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'IMAGE_TEXT_MODULE';
ALTER TYPE "StorefrontSectionType" ADD VALUE 'INSTAGRAM_CTA';

-- CreateTable
CREATE TABLE "BrandTheme" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "draftConfig" JSONB NOT NULL,
    "publishedConfig" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandTheme_brandId_key" ON "BrandTheme"("brandId");

-- AddForeignKey
ALTER TABLE "BrandTheme" ADD CONSTRAINT "BrandTheme_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
