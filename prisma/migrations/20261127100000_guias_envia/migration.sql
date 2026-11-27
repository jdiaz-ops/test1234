-- Guías con Envia desde el pedido (ver envia-service.ts y EnviaConnection
-- en el schema). Solo agrega columnas y una tabla nueva.

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "enviaCarrier" TEXT,
ADD COLUMN     "enviaCostCents" INTEGER,
ADD COLUMN     "enviaLabelAt" TIMESTAMP(3),
ADD COLUMN     "enviaLabelUrl" TEXT,
ADD COLUMN     "enviaService" TEXT,
ADD COLUMN     "enviaStatus" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "EnviaConnection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "webhookSecret" TEXT NOT NULL,
    "lastWebhookAt" TIMESTAMP(3),
    "originName" TEXT NOT NULL,
    "originCompany" TEXT,
    "originPhone" TEXT NOT NULL,
    "originEmail" TEXT,
    "originStreet" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "originCity" TEXT NOT NULL,
    "originPostalCode" TEXT,
    "originReference" TEXT,
    "packageLengthCm" INTEGER NOT NULL DEFAULT 20,
    "packageWidthCm" INTEGER NOT NULL DEFAULT 15,
    "packageHeightCm" INTEGER NOT NULL DEFAULT 10,
    "packageWeightGrams" INTEGER NOT NULL DEFAULT 500,
    "packageContent" TEXT NOT NULL DEFAULT 'Productos para uñas',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnviaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnviaConnection_brandId_key" ON "EnviaConnection"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "EnviaConnection_webhookSecret_key" ON "EnviaConnection"("webhookSecret");

-- AddForeignKey
ALTER TABLE "EnviaConnection" ADD CONSTRAINT "EnviaConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

