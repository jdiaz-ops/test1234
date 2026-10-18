-- Redirecciones de los links viejos de la tienda que la marca tenía antes
-- (2026-10-18). Ver storefront-redirect-service.ts.
CREATE TABLE "StorefrontRedirect" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontRedirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorefrontRedirect_brandId_fromPath_key" ON "StorefrontRedirect"("brandId", "fromPath");
ALTER TABLE "StorefrontRedirect" ADD CONSTRAINT "StorefrontRedirect_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
