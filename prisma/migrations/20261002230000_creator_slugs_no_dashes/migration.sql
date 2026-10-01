-- Vitrinas de creadores sin guiones ("nail-fest" → "nailfest"), igual que
-- las nuevas (ver normalizeSlug en src/lib/creator-identity.ts). Solo si el
-- nombre sin guiones está libre (otro creador, una marca o un link viejo
-- de marca). El link viejo con guion redirige al nuevo (ver src/proxy.ts).
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
BEGIN
  FOR r IN SELECT "id", "storefrontSlug" FROM "CreatorProfile" WHERE "storefrontSlug" LIKE '%-%' LOOP
    candidate := replace(r."storefrontSlug", '-', '');
    IF candidate <> ''
      AND NOT EXISTS (SELECT 1 FROM "CreatorProfile" WHERE "storefrontSlug" = candidate)
      AND NOT EXISTS (SELECT 1 FROM "BrandProfile" WHERE "storefrontSlug" = candidate)
      AND NOT EXISTS (SELECT 1 FROM "BrandSlugRedirect" WHERE "slug" = candidate)
    THEN
      UPDATE "CreatorProfile" SET "storefrontSlug" = candidate WHERE "id" = r."id";
    END IF;
  END LOOP;
END $$;
