-- Orden de los productos dentro de una colección de Mi tienda
CREATE TYPE "CollectionSortOrder" AS ENUM ('MANUAL', 'ALPHA_ASC', 'ALPHA_DESC', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST');

ALTER TABLE "BrandCollection" ADD COLUMN "sortOrder" "CollectionSortOrder" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "ProductBrandCollection" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Las colecciones existentes conservan el orden que tenían (el de entrada).
UPDATE "ProductBrandCollection" AS pbc
SET "position" = ranked.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "collectionId" ORDER BY "createdAt", "id") - 1 AS rn
  FROM "ProductBrandCollection"
) AS ranked
WHERE pbc."id" = ranked."id";

CREATE INDEX "ProductBrandCollection_collectionId_position_idx" ON "ProductBrandCollection"("collectionId", "position");
