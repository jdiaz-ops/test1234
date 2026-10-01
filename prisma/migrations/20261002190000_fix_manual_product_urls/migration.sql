-- Productos de Mi tienda creados antes de que la marca eligiera su link
-- quedaron con "/t/mi-tienda/..." (o con un link anterior). Se rehacen con
-- el link actual de la tienda.
UPDATE "Product" p
SET "url" = '/t/' || b."storefrontSlug" || '/' || p."slug"
FROM "BrandProfile" b
WHERE p."brandId" = b."id"
  AND p."manual" = true
  AND p."slug" IS NOT NULL
  AND b."storefrontSlug" IS NOT NULL;
