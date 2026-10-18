-- Pasos de "lo que falta para vender" marcados a mano por la marca (2026-10-18).
ALTER TABLE "BrandProfile" ADD COLUMN "goLiveChecks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
