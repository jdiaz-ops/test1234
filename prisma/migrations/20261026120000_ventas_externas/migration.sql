-- CreateTable
CREATE TABLE "ExternalSale" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerFirstName" TEXT,
    "buyerLastName" TEXT,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "billingIdType" TEXT,
    "billingIdNumber" TEXT,
    "billingName" TEXT,
    "items" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'PRODUCTION',
    "wompiTransactionId" TEXT,
    "einvoiceStatus" "EInvoiceStatus",
    "einvoiceNumber" TEXT,
    "einvoiceUuid" TEXT,
    "einvoiceCufe" TEXT,
    "einvoicePdfUrl" TEXT,
    "einvoiceError" TEXT,
    "einvoiceAttempts" INTEGER NOT NULL DEFAULT 0,
    "einvoiceIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalSale_brandId_createdAt_idx" ON "ExternalSale"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSale_brandId_source_externalId_key" ON "ExternalSale"("brandId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

