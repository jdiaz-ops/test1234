-- Datos que pide una transportadora (correo, cédula, departamento) y la
-- dirección guardada del creador para no llenarla cada vez.
ALTER TABLE "CreatorProfile" ADD COLUMN "savedShipping" JSONB;

ALTER TABLE "SampleRequest" ADD COLUMN "shippingEmail" TEXT;
ALTER TABLE "SampleRequest" ADD COLUMN "shippingDocument" TEXT;
ALTER TABLE "SampleRequest" ADD COLUMN "shippingRegion" TEXT;
