-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "camaraComercioUrl" TEXT,
ADD COLUMN     "fiscalAddress" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "legalRepId" TEXT,
ADD COLUMN     "legalRepName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rutDocumentUrl" TEXT,
ADD COLUMN     "taxRegime" TEXT,
ADD COLUMN     "tiktokHandle" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "BrandInvoice" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "note" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandInvoice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BrandInvoice" ADD CONSTRAINT "BrandInvoice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
