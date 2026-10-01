-- Conexión directa con Dataico (facturación electrónica)
CREATE TYPE "DataicoEnv" AS ENUM ('PRUEBAS', 'PRODUCCION');
CREATE TYPE "EInvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

CREATE TABLE "DataicoConnection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accountId" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "env" "DataicoEnv" NOT NULL DEFAULT 'PRUEBAS',
    "prefix" TEXT,
    "resolutionNumber" TEXT,
    "nextNumber" INTEGER,
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataicoConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataicoConnection_brandId_key" ON "DataicoConnection"("brandId");
ALTER TABLE "DataicoConnection" ADD CONSTRAINT "DataicoConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreOrder" ADD COLUMN "billingIdType" TEXT,
ADD COLUMN "billingIdNumber" TEXT,
ADD COLUMN "billingName" TEXT,
ADD COLUMN "einvoiceStatus" "EInvoiceStatus",
ADD COLUMN "einvoiceNumber" TEXT,
ADD COLUMN "einvoiceUuid" TEXT,
ADD COLUMN "einvoiceCufe" TEXT,
ADD COLUMN "einvoicePdfUrl" TEXT,
ADD COLUMN "einvoiceError" TEXT,
ADD COLUMN "einvoiceAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "einvoiceIssuedAt" TIMESTAMP(3);
