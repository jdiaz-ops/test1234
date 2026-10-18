-- Productos con variantes importados con precio base 0: el base pasa a ser
-- el menor precio de sus variantes, que es lo que muestran las tarjetas
-- (2026-10-18). Ver product-price.ts.
UPDATE "Product" p
SET "price" = v.min_price
FROM (
  SELECT "productId", MIN("price") AS min_price
  FROM "ProductVariant"
  WHERE "price" IS NOT NULL AND "price" > 0
  GROUP BY "productId"
) v
WHERE v."productId" = p.id AND p."hasVariants" = true AND p."price" = 0;
