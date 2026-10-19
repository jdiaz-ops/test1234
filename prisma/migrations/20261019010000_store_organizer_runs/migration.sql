-- CreateEnum
CREATE TYPE "StoreOrganizerRunStatus" AS ENUM ('APPLIED', 'REVERTED');

-- CreateTable
CREATE TABLE "StoreOrganizerRun" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "StoreOrganizerRunStatus" NOT NULL DEFAULT 'APPLIED',
    "source" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "StoreOrganizerRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreOrganizerRun_brandId_createdAt_idx" ON "StoreOrganizerRun"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreOrganizerRun" ADD CONSTRAINT "StoreOrganizerRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
