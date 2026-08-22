-- AlterTable
ALTER TABLE "ChallengeReward" ADD COLUMN     "brandChargeId" TEXT;

-- AddForeignKey
ALTER TABLE "ChallengeReward" ADD CONSTRAINT "ChallengeReward_brandChargeId_fkey" FOREIGN KEY ("brandChargeId") REFERENCES "BrandCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
