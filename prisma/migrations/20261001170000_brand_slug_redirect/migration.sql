-- Links viejos de tiendas que redirigen al link actual
CREATE TABLE "BrandSlugRedirect" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandSlugRedirect_slug_key" ON "BrandSlugRedirect"("slug");
CREATE INDEX "BrandSlugRedirect_brandId_idx" ON "BrandSlugRedirect"("brandId");

ALTER TABLE "BrandSlugRedirect" ADD CONSTRAINT "BrandSlugRedirect_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
