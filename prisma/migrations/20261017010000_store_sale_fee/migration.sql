-- Tarifa de Marcolini sobre toda venta pagada en Mi tienda, tenga o no
-- código de creadora (decisión del 2026-10-17). Con código la tarifa ya va
-- en Commission; sin código queda en esta tabla y entra al corte del día 1.

-- CreateEnum
CREATE TYPE "StoreSaleFeeStatus" AS ENUM ('PENDING', 'REVERSED');

-- CreateTable
CREATE TABLE "StoreSaleFee" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "status" "StoreSaleFeeStatus" NOT NULL DEFAULT 'PENDING',
    "reversedAt" TIMESTAMP(3),
    "brandChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSaleFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSaleFee_orderId_key" ON "StoreSaleFee"("orderId");

-- CreateIndex
CREATE INDEX "StoreSaleFee_brandId_status_idx" ON "StoreSaleFee"("brandId", "status");

-- AddForeignKey
ALTER TABLE "StoreSaleFee" ADD CONSTRAINT "StoreSaleFee_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleFee" ADD CONSTRAINT "StoreSaleFee_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSaleFee" ADD CONSTRAINT "StoreSaleFee_brandChargeId_fkey" FOREIGN KEY ("brandChargeId") REFERENCES "BrandCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
