-- Backfill-safe: Transaction table is empty at this point in dev, so
-- brandId can be added as NOT NULL directly.
ALTER TABLE "Transaction" ADD COLUMN "brandId" TEXT;

UPDATE "Transaction" t
SET "brandId" = o."brandId"
FROM "Offer" o
WHERE o.id = t."offerId";

ALTER TABLE "Transaction" ALTER COLUMN "brandId" SET NOT NULL;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Transaction_brandId_source_externalOrderId_key"
  ON "Transaction"("brandId", "source", "externalOrderId");
