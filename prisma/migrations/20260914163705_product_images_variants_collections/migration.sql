-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optionNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "StoreOrderItem" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantLabel" TEXT;

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "option1Value" TEXT,
    "option2Value" TEXT,
    "option3Value" TEXT,
    "price" DECIMAL(12,2),
    "sku" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCollection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBrandCollection" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBrandCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_option1Value_option2Value_option3V_key" ON "ProductVariant"("productId", "option1Value", "option2Value", "option3Value");

-- CreateIndex
CREATE INDEX "BrandCollection_brandId_idx" ON "BrandCollection"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCollection_brandId_slug_key" ON "BrandCollection"("brandId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBrandCollection_productId_collectionId_key" ON "ProductBrandCollection"("productId", "collectionId");

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCollection" ADD CONSTRAINT "BrandCollection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBrandCollection" ADD CONSTRAINT "ProductBrandCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBrandCollection" ADD CONSTRAINT "ProductBrandCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BrandCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
