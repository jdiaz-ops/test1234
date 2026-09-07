
-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "customDomainVerificationToken" TEXT,
ADD COLUMN     "customDomainVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_customDomain_key" ON "BrandProfile"("customDomain");

