-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "brandChargeId" TEXT;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_brandChargeId_fkey" FOREIGN KEY ("brandChargeId") REFERENCES "BrandCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
