-- Devoluciones de pedidos de "Mi tienda"
ALTER TYPE "StoreOrderStatus" ADD VALUE 'REFUNDED';

ALTER TABLE "StoreOrder" ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundReason" TEXT,
ADD COLUMN "restocked" BOOLEAN NOT NULL DEFAULT false;

-- Reseñas de productos
CREATE TYPE "ProductReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ProductReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductReview_productId_authorEmail_key" ON "ProductReview"("productId", "authorEmail");
CREATE INDEX "ProductReview_brandId_status_idx" ON "ProductReview"("brandId", "status");
CREATE INDEX "ProductReview_productId_status_idx" ON "ProductReview"("productId", "status");

ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Límite de intentos
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
