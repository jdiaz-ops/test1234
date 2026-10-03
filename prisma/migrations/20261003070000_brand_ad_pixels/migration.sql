-- Píxeles de anuncios por marca (Meta y TikTok) para su tienda.
ALTER TABLE "BrandProfile" ADD COLUMN "metaPixelId" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN "tiktokPixelId" TEXT;
