-- Marcas creadas sin correo de la dueña + link de acceso de un solo uso
-- (2026-10-18). Ver admin-brand-service.ts.
ALTER TABLE "BrandProfile" ADD COLUMN "ownerPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BrandProfile" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "BrandProfile" ADD COLUMN "accessLinkCreatedAt" TIMESTAMP(3);
ALTER TABLE "BrandProfile" ADD COLUMN "claimedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "BrandProfile_accessTokenHash_key" ON "BrandProfile"("accessTokenHash");
