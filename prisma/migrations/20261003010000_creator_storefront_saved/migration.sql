-- Paso "Tu vitrina" listo al guardarla (el título ya no es obligatorio)
ALTER TABLE "CreatorProfile" ADD COLUMN "storefrontSavedAt" TIMESTAMP(3);
