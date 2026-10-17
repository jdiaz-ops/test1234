-- Sin IVA sobre la tarifa de Marcolini (2026-10-17): se factura como
-- persona natural. El IVA por defecto pasa a 0 y lo que todavía no entró a
-- un corte queda sin IVA. Lo que ya se cobró no se toca.
ALTER TABLE "PlatformConfig" ALTER COLUMN "vatPercent" SET DEFAULT 0;
UPDATE "PlatformConfig" SET "vatPercent" = 0;
UPDATE "Commission" SET "platformFeeVatAmount" = 0 WHERE "brandChargeId" IS NULL AND "platformFeeVatAmount" <> 0;
UPDATE "StoreSaleFee" SET "vatAmount" = 0 WHERE "brandChargeId" IS NULL AND "vatAmount" <> 0;
