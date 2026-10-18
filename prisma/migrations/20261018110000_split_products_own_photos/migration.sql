-- Los productos que salieron de "Separar variantes en productos" se
-- llevaron la galería entera del original, con las fotos de los demás
-- tonos. Cada uno se queda con su foto y las generales: se quitan de su
-- galería las fotos principales de sus hermanos (mismo Grupo).
DELETE FROM "ProductImage" pi
USING "Product" p
WHERE pi."productId" = p.id
  AND p."hasVariants" = false
  AND (p."attributes" ->> 'Grupo') IS NOT NULL
  AND (p."imageUrl" IS NULL OR pi."url" <> p."imageUrl")
  AND EXISTS (
    SELECT 1 FROM "Product" s
    WHERE s."brandId" = p."brandId"
      AND s.id <> p.id
      AND (s."attributes" ->> 'Grupo') = (p."attributes" ->> 'Grupo')
      AND s."imageUrl" = pi."url"
  );
