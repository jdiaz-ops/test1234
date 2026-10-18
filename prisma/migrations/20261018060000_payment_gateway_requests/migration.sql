-- Pasarelas de pago que las marcas usan y Marcolini no tiene (2026-10-18).
CREATE TABLE "PaymentGatewayRequest" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentGatewayRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentGatewayRequest_brandId_gateway_key" ON "PaymentGatewayRequest"("brandId", "gateway");
ALTER TABLE "PaymentGatewayRequest" ADD CONSTRAINT "PaymentGatewayRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
