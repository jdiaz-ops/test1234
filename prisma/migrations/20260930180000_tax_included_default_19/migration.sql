-- Los precios ya incluyen el IVA; la tasa solo se muestra. 19% = tarifa
-- general de Colombia para las marcas nuevas (las existentes conservan la
-- suya y la cambian en Mi tienda → Configuración).
ALTER TABLE "BrandProfile" ALTER COLUMN "taxRatePercent" SET DEFAULT 19;
